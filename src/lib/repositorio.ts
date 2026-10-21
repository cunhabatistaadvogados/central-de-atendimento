/**
 * Leitura e gravacao dos dados reais no Supabase (projeto LOAS).
 *
 * As telas continuam usando as mesmas acoes do store; no modo real cada acao
 * muda o estado na hora (a tela nao espera a rede) e este arquivo grava a
 * DIFERENCA entre o antes e o depois. Mensagens nunca sao gravadas daqui: as
 * do cliente e do robo entram pelo webhook, as da equipe pela funcao
 * whatsapp-send, que envia de verdade pelo WhatsApp antes de gravar.
 */
import { novoEstado, type EstadoRobo } from '@motor/robo'
import { dadosVazios } from './contrato'
import { supabase } from './supabase'
import type { Cliente, Contrato, DadosContrato, Documentos, Evento, Mensagem, Pendencia } from './tipos'

const DOCS_VAZIOS: Documentos = { rg: false, cpf: false, comprovante: false, cadunico: false, laudo: false }

/**
 * O que a equipe digita na ficha -> numero do WhatsApp no banco (DDI + DDD +
 * numero, so digitos). Sem DDI, e do Brasil. Vazio volta a ser "sem WhatsApp".
 */
export function numeroDoWhatsApp(digitado: string): string | null {
  const d = digitado.replace(/\D/g, '')
  if (!d) return null
  return d.length === 10 || d.length === 11 ? `55${d}` : d
}

/** "5513997414361" -> "(13) 99741-4361"; numero de fora do Brasil fica com +. */
export function formatarTelefone(bruto: string): string {
  const d = bruto.replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4)
    const resto = d.slice(4)
    return resto.length === 9 ? `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}` : `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`
  }
  return `+${d}`
}

interface LinhaCliente {
  id: string
  /** null: contrato importado antes de sabermos o WhatsApp (21/10/2026). */
  telefone: string | null
  nome: string
  origem: Cliente['origem']
  etapa: Cliente['etapa']
  robo: Partial<EstadoRobo> | null
  documentos: Partial<Documentos> | null
  reuniao: Cliente['reuniao'] | null
  cidade: string | null
  nao_lidas: number
  motivo_perda: string | null
  criado_em: string
  atualizado_em: string
  historico?: boolean
}

interface LinhaContrato {
  cliente_id: string
  status: Contrato['status']
  com_parte_fixa: boolean
  ok_advogado: boolean
  dados: Partial<DadosContrato> | null
  gerado_em: string | null
  enviado_em: string | null
  assinado_em: string | null
  arquivo?: string | null
}

function exigir() {
  if (!supabase) throw new Error('Banco do escritório não configurado nesta cópia do sistema.')
  return supabase
}

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>
const PAGINA = 1000

/**
 * Le a tabela INTEIRA em paginas de 1000. O Supabase corta qualquer consulta
 * em 1000 linhas: com o historico do Pixel Hub (22 mil mensagens, 20/10/2026)
 * a tela mostraria so as 1000 mais antigas, sem erro nenhum. Conta primeiro e
 * busca as paginas em paralelo; a ordem tem desempate por id para nenhuma
 * linha cair entre duas paginas.
 */
async function todas<T>(tabela: string, colunas: string, ordem: string, filtro?: (q: any) => any): Promise<T[]> {
  const db = exigir()
  // A contagem total so na primeira pagina: pedida em todas, eram 23 contagens
  // da tabela inteira ao mesmo tempo (20/10/2026).
  const base = (contar: boolean) => {
    // contratos nao tem coluna id: a chave e o cliente_id.
    const q = db
      .from(tabela)
      .select(colunas, contar ? { count: 'exact' } : undefined)
      .order(ordem)
      .order(tabela === 'contratos' ? 'cliente_id' : 'id')
    return filtro ? filtro(q) : q
  }
  const primeira = (await base(true).range(0, PAGINA - 1)) as Awaited<Resposta<T>>
  if (primeira.error) throw new Error(`Não consegui ler o banco (${tabela}): ${primeira.error.message}`)
  const total = primeira.count ?? (primeira.data?.length ?? 0)
  const linhas = [...(primeira.data ?? [])]
  const resto: Promise<Awaited<Resposta<T>>>[] = []
  for (let de = PAGINA; de < total; de += PAGINA) resto.push(Promise.resolve(base(false).range(de, de + PAGINA - 1)) as Promise<Awaited<Resposta<T>>>)
  for (const r of await Promise.all(resto)) {
    if (r.error) throw new Error(`Não consegui ler o banco (${tabela}): ${r.error.message}`)
    linhas.push(...(r.data ?? []))
  }
  return linhas
}

const COLUNAS_MENSAGEM = 'id, cliente_id, de, texto, autor, em, status_envio, erro_envio'

/**
 * So o atendimento de 20/10/2026 em diante. O historico do Pixel Hub (1.767
 * conversas) fica na tela Historico, pedido do Lucas: a Central recomeca
 * zerada. O filtro vai pelo cliente (!inner), porque quem do historico volta
 * a escrever sai dele e chega com as mensagens antigas junto.
 */
const doAtendimento = (q: any) => q.eq('clientes.historico', false)
const comCliente = (colunas: string) => `${colunas}, clientes!inner(historico)`

export async function carregarClientes(): Promise<Cliente[]> {
  // Falha alta e clara: tela vazia por erro silencioso ja custou caro no Marcello.
  const [cl, ms, pe, ev, co] = await Promise.all([
    todas<LinhaCliente>('clientes', '*', 'atualizado_em', (q) => q.eq('historico', false)),
    todas<Record<string, string> & { cliente_id: string }>('mensagens', comCliente(COLUNAS_MENSAGEM), 'em', doAtendimento),
    todas<Record<string, unknown> & { cliente_id: string }>('pendencias', comCliente('*'), 'criada_em', doAtendimento),
    todas<Record<string, string> & { cliente_id: string }>('eventos', comCliente('*'), 'em', doAtendimento),
    todas<LinhaContrato>('contratos', comCliente('*'), 'atualizado_em', doAtendimento),
  ])
  return montarClientes(cl.reverse(), ms, pe, ev, co)
}

/** Uma linha por conversa antiga (view historico_resumo), sem as mensagens. */
export interface ResumoHistorico {
  id: string
  nome: string
  telefone: string
  etapa: Cliente['etapa']
  origem: Cliente['origem']
  motivo_perda: string | null
  criado_em: string
  total: number
  do_cliente: number
  primeira_em: string | null
  ultima_em: string | null
  ultima_texto: string | null
  ultima_de: Mensagem['de'] | null
}

export async function carregarHistorico(): Promise<ResumoHistorico[]> {
  const linhas = await todas<ResumoHistorico>('historico_resumo', '*', 'criado_em')
  return linhas.sort((a, b) => (b.ultima_em ?? b.criado_em).localeCompare(a.ultima_em ?? a.criado_em))
}

/** Tira do historico: o cliente volta para o atendimento, com as mensagens antigas. */
export async function trazerParaOAtendimento(id: string): Promise<void> {
  const { error } = await exigir().from('clientes').update({ historico: false }).eq('id', id)
  if (error) throw new Error(`Não consegui tirar do histórico: ${error.message}`)
}

/** Ids dos clientes alterados desde um instante (checagem leve da rede de seguranca). */
export async function clientesMudadosDesde(desde: string): Promise<string[]> {
  const { data, error } = await exigir().from('clientes').select('id').gt('atualizado_em', desde).limit(1000)
  if (error) throw new Error(`Não consegui ler o banco (clientes): ${error.message}`)
  return (data ?? []).map((l) => (l as { id: string }).id)
}

/** So um cliente: o tempo real atualiza quem mudou, sem reler a base inteira. */
export async function carregarUmCliente(id: string): Promise<Cliente | null> {
  const doCliente = (q: any) => q.eq('cliente_id', id)
  const [cl, ms, pe, ev, co] = await Promise.all([
    todas<LinhaCliente>('clientes', '*', 'atualizado_em', (q) => q.eq('id', id)),
    todas<Record<string, string> & { cliente_id: string }>('mensagens', COLUNAS_MENSAGEM, 'em', doCliente),
    todas<Record<string, unknown> & { cliente_id: string }>('pendencias', '*', 'criada_em', doCliente),
    todas<Record<string, string> & { cliente_id: string }>('eventos', '*', 'em', doCliente),
    todas<LinhaContrato>('contratos', '*', 'atualizado_em', doCliente),
  ])
  return montarClientes(cl, ms, pe, ev, co)[0] ?? null
}

function montarClientes(
  cl: LinhaCliente[],
  ms: (Record<string, string> & { cliente_id: string })[],
  pe: (Record<string, unknown> & { cliente_id: string })[],
  ev: (Record<string, string> & { cliente_id: string })[],
  co: LinhaContrato[],
): Cliente[] {
  const porCliente = <T extends { cliente_id: string }>(linhas: T[]) => {
    const mapa = new Map<string, T[]>()
    for (const l of linhas) {
      const lista = mapa.get(l.cliente_id)
      if (lista) lista.push(l)
      else mapa.set(l.cliente_id, [l])
    }
    return mapa
  }
  const mensagens = porCliente(ms)
  const pendencias = porCliente(pe)
  const eventos = porCliente(ev)
  const contratos = new Map(co.map((c) => [c.cliente_id, c]))

  return cl.map((l) => {
    const robo = { ...novoEstado(), ...(l.robo ?? {}) } as EstadoRobo
    robo.ficha = { ...(l.robo?.ficha ?? {}) }
    const k = contratos.get(l.id)
    return {
      id: l.id,
      nome: l.nome || robo.ficha.nome || '',
      telefone: l.telefone ? formatarTelefone(l.telefone) : '',
      origem: l.origem,
      criadoEm: l.criado_em,
      atualizadoEm: l.atualizado_em,
      etapa: l.etapa,
      robo,
      mensagens: (mensagens.get(l.id) ?? []).map(
        (m): Mensagem => ({
          id: m.id,
          de: m.de as Mensagem['de'],
          texto: m.texto,
          em: m.em,
          autor: m.autor ?? undefined,
          statusEnvio: m.status_envio ?? undefined,
          erroEnvio: m.erro_envio ?? undefined,
        }),
      ),
      pendencias: (pendencias.get(l.id) ?? []).map(
        (p): Pendencia => ({
          id: String(p.id),
          texto: String(p.texto),
          criadaEm: String(p.criada_em),
          retornoEm: String(p.retorno_em),
          resolvida: Boolean(p.resolvida),
        }),
      ),
      eventos: (eventos.get(l.id) ?? []).map((e): Evento => ({ id: e.id, em: e.em, tipo: e.tipo as Evento['tipo'], texto: e.texto })),
      documentos: { ...DOCS_VAZIOS, ...(l.documentos ?? {}) },
      reuniao: l.reuniao ?? undefined,
      contrato: k
        ? {
            status: k.status,
            comParteFixa: k.com_parte_fixa,
            okAdvogado: k.ok_advogado,
            dados: { ...dadosVazios(), ...(k.dados ?? {}) },
            geradoEm: k.gerado_em ?? undefined,
            enviadoEm: k.enviado_em ?? undefined,
            assinadoEm: k.assinado_em ?? undefined,
            arquivo: k.arquivo ?? undefined,
          }
        : undefined,
      cidade: l.cidade ?? undefined,
      naoLidas: l.nao_lidas ?? 0,
      motivoPerda: l.motivo_perda ?? undefined,
      historico: l.historico || undefined,
    }
  })
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Grava no banco o que mudou entre `antes` e `depois` do mesmo cliente. */
export async function gravarDiferenca(antes: Cliente, depois: Cliente): Promise<void> {
  const db = exigir()
  const campos: Record<string, unknown> = {}
  if (antes.nome !== depois.nome) campos.nome = depois.nome
  // WhatsApp preenchido na ficha (contrato que chegou antes do numero).
  if (antes.telefone !== depois.telefone) campos.telefone = numeroDoWhatsApp(depois.telefone)
  if (antes.etapa !== depois.etapa) campos.etapa = depois.etapa
  if (!igual(antes.robo, depois.robo)) campos.robo = depois.robo
  if (!igual(antes.documentos, depois.documentos)) campos.documentos = depois.documentos
  if (!igual(antes.reuniao, depois.reuniao)) campos.reuniao = depois.reuniao ?? null
  if (antes.cidade !== depois.cidade) campos.cidade = depois.cidade ?? null
  if (antes.naoLidas !== depois.naoLidas) campos.nao_lidas = depois.naoLidas
  if (antes.motivoPerda !== depois.motivoPerda) campos.motivo_perda = depois.motivoPerda ?? null

  const tarefas: PromiseLike<{ error: { message: string } | null }>[] = []
  if (Object.keys(campos).length) tarefas.push(db.from('clientes').update(campos).eq('id', depois.id))
  if (depois.contrato && !igual(antes.contrato, depois.contrato)) {
    const k = depois.contrato
    tarefas.push(
      db.from('contratos').upsert(
        {
          cliente_id: depois.id,
          status: k.status,
          com_parte_fixa: k.comParteFixa,
          ok_advogado: k.okAdvogado,
          dados: k.dados,
          gerado_em: k.geradoEm ?? null,
          enviado_em: k.enviadoEm ?? null,
          assinado_em: k.assinadoEm ?? null,
        },
        { onConflict: 'cliente_id' },
      ),
    )
  }
  const idsAntes = new Set(antes.eventos.map((e) => e.id))
  const novos = depois.eventos.filter((e) => !idsAntes.has(e.id))
  if (novos.length) tarefas.push(db.from('eventos').insert(novos.map((e) => ({ id: e.id, cliente_id: depois.id, tipo: e.tipo, texto: e.texto, em: e.em }))))
  for (const p of depois.pendencias) {
    const velha = antes.pendencias.find((x) => x.id === p.id)
    if (velha && velha.resolvida !== p.resolvida) tarefas.push(db.from('pendencias').update({ resolvida: p.resolvida }).eq('id', p.id))
  }

  const resultados = await Promise.all(tarefas)
  const erro = resultados.find((r) => r.error)?.error
  // Numero que ja e de outro cliente: a familia escreveu antes de cadastrarmos
  // o WhatsApp e o robo abriu outra ficha. Juntar as duas e com o Edu.
  if (erro && /clientes_telefone_key|duplicate key/.test(erro.message))
    throw new Error('Esse WhatsApp já está em outra ficha (a família escreveu antes). Peça para juntar as duas.')
  if (erro) throw new Error(`Não consegui salvar no banco: ${erro.message}`)
}

/** Link temporario (5 min) do PDF assinado no bucket privado "contratos". */
export async function linkDoContratoAssinado(caminho: string): Promise<string> {
  const { data, error } = await exigir().storage.from('contratos').createSignedUrl(caminho, 300)
  if (error || !data?.signedUrl) throw new Error(`Não consegui abrir o contrato: ${error?.message ?? 'arquivo não encontrado'}`)
  return data.signedUrl
}

/** Resposta da equipe: a funcao envia pelo WhatsApp, grava e pausa o robo. */
export async function enviarResposta(clienteId: string, texto: string): Promise<void> {
  const db = exigir()
  const { data, error } = await db.functions.invoke('whatsapp-send', { body: { cliente_id: clienteId, texto } })
  if (error) {
    // O corpo do erro da funcao traz o motivo real (ex.: janela de 24h fechada).
    let motivo = error.message
    try {
      const corpo = await (error as { context?: Response }).context?.json()
      if (corpo?.error) motivo = corpo.error
    } catch {
      // sem corpo legivel: fica a mensagem generica
    }
    throw new Error(`O WhatsApp não aceitou o envio: ${motivo}`)
  }
  if (data?.error) throw new Error(`O WhatsApp não aceitou o envio: ${data.error}`)
}
