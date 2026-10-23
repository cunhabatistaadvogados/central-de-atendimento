// Webhook do WhatsApp (Meta). Recebe a mensagem da familia, roda o MESMO
// motor do simulador (_shared/robo.ts), responde e grava tudo.
//
// Sempre devolve 200 depois de validar a assinatura: se devolver erro, a Meta
// reenvia o evento e o robo responderia duas vezes. A idempotencia vem do
// wamid unico na tabela mensagens.
//
// Segredos: WHATSAPP_VERIFY_TOKEN, META_APP_SECRET, WHATSAPP_ACCESS_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ja vem do ambiente.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { anotarComplemento, contornar, contratoComParteFixa, novoEstado, responder, respostaAtrasada, type AgendaDaVez, type EstadoRobo, type Etapa, type GradeDaAgenda } from '../_shared/robo.ts'
import { assinaturaValida, baixarMidia, enviarTexto } from '../_shared/whatsapp.ts'
import { interpretar, type Fala } from '../_shared/interprete.ts'

const ORDEM: Etapa[] = ['novo', 'qualificacao', 'qualificado', 'reuniao', 'contrato', 'contratado']

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

interface MensagemMeta {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  button?: { text: string }
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }
  /** Anuncio de clique para WhatsApp do Meta (so na 1a mensagem que veio dele). */
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; ctwa_clid?: string }
  image?: MidiaMeta
  audio?: MidiaMeta
  video?: MidiaMeta
  document?: MidiaMeta
  sticker?: MidiaMeta
  /** Resposta citada: id da mensagem que a familia arrastou para responder. */
  context?: { id?: string }
  reaction?: { message_id?: string; emoji?: string }
  location?: { latitude?: number; longitude?: number; name?: string; address?: string }
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[]
}

interface MidiaMeta {
  id: string
  mime_type?: string
  caption?: string
  filename?: string
}

type TipoMidia = 'imagem' | 'audio' | 'video' | 'documento' | 'figurinha'
const TIPO_DA_MIDIA: Record<string, TipoMidia> = { image: 'imagem', audio: 'audio', video: 'video', document: 'documento', sticker: 'figurinha' }
// Mesmo rotulo da tela (src/components/Midia.tsx): e o texto da previa na lista.
const ROTULO: Record<TipoMidia, string> = { imagem: '📷 Foto', audio: '🎤 Áudio', video: '🎥 Vídeo', documento: '📄 Documento', figurinha: '🌟 Figurinha' }
const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
}

// Origem do contato novo (etiquetas pedidas pelo Lucas em 21/10/2026). O
// anuncio do Meta traz o referral; o Google nao manda nada, entao vale a
// frase pronta do link da campanha ("vi no Google..."). O robo tambem le a
// origem e corrige depois, se o contato ficou como "anuncio".
function origemDoContato(m: MensagemMeta, texto: string): string {
  if (m.referral) return 'meta'
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/\bgoogle\b/.test(t)) return 'google'
  if (/advogad[oa] previdenci|\bpelo site\b|\bno site\b/.test(t)) return 'site'
  if (/\b(instagram|facebook)\b/.test(t)) return 'meta'
  return 'anuncio'
}

const NOME_DA_ORIGEM: Record<string, string> = { meta: 'anúncio do Meta', google: 'Google', site: 'site', anuncio: 'anúncio' }

interface Conteudo {
  /** O que fica gravado e aparece na tela. */
  texto: string
  /** O que o robo le. Vazio: reacao e figurinha nao sao resposta, o robo nao fala. */
  entrada: string
  midia?: MidiaMeta & { tipo: TipoMidia }
}

function conteudoDaMensagem(m: MensagemMeta): Conteudo {
  const so = (t: string): Conteudo => ({ texto: t, entrada: t })
  if (m.type === 'text') return so(m.text?.body ?? '')
  if (m.type === 'button') return so(m.button?.text ?? '')
  if (m.type === 'interactive') return so(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '')
  const tipo = TIPO_DA_MIDIA[m.type]
  const midia = tipo ? m[m.type as 'image' | 'audio' | 'video' | 'document' | 'sticker'] : undefined
  if (tipo && midia?.id) {
    // O robo segue lendo so "[audio recebido]"/"[arquivo recebido]" (roteiro
    // testado); a legenda fica gravada para a equipe ler.
    const legenda = midia.caption?.trim()
    const texto = legenda || (tipo === 'documento' && midia.filename ? `📄 ${midia.filename}` : ROTULO[tipo])
    const entrada = tipo === 'figurinha' ? '' : tipo === 'audio' ? '[áudio recebido]' : '[arquivo recebido]'
    return { texto, entrada, midia: { ...midia, tipo } }
  }
  if (m.type === 'reaction') return { texto: m.reaction?.emoji ? `Reagiu com ${m.reaction.emoji}` : '', entrada: '' }
  if (m.type === 'location' && m.location) {
    const l = m.location
    const lugar = [l.name, l.address].filter(Boolean).join(' - ')
    return { texto: `📍 Localização${lugar ? `: ${lugar}` : ''}\nhttps://maps.google.com/?q=${l.latitude},${l.longitude}`, entrada: '[arquivo recebido]' }
  }
  if (m.type === 'contacts' && m.contacts?.length) {
    const lista = m.contacts.map((k) => [k.name?.formatted_name, k.phones?.[0]?.phone].filter(Boolean).join(' ')).join('\n')
    return { texto: `👤 Contato: ${lista}`, entrada: '[arquivo recebido]' }
  }
  return { texto: 'Mensagem que a API do WhatsApp não mostra (enquete, visualização única ou outro tipo). Veja no celular.', entrada: '[arquivo recebido]' }
}

// Baixa da Meta e guarda no bucket privado: o link da Meta expira em minutos
// e so abre com o token, a tela nunca conseguiria mostrar direto.
async function guardarMidia(linhaId: string, clienteId: string, midia: MidiaMeta & { tipo: TipoMidia }) {
  const baixada = await baixarMidia(midia.id)
  if (!baixada.ok) {
    await evento(clienteId, 'sistema', `Não consegui baixar a mídia (${midia.tipo}) do WhatsApp: ${baixada.erro}`)
    return
  }
  const mime = (baixada.mime || midia.mime_type || 'application/octet-stream').split(';')[0].trim()
  const ext = EXTENSAO[mime] ?? midia.filename?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase() ?? 'bin'
  const caminho = `${clienteId}/${linhaId}.${ext}`
  const subida = await banco.storage.from('midias').upload(caminho, baixada.bytes, { contentType: mime, upsert: true })
  if (subida.error) {
    await evento(clienteId, 'sistema', `Não consegui guardar a mídia do WhatsApp: ${subida.error.message}`)
    return
  }
  await banco.from('mensagens').update({ midia: caminho }).eq('id', linhaId)
}

/**
 * Grade da tela Agenda e horarios ja tomados por outras familias: reuniao
 * confirmada (data) ou pedida ao robo num horario exato (pedidoEm). O robo so
 * oferece o que a equipe liberou e ninguem pegou (Catiane e Flavia, 22/10/2026).
 */
async function agendaDaVez(clienteId: string): Promise<AgendaDaVez> {
  const [reunioes, config] = await Promise.all([
    banco.from('clientes').select('reuniao').not('reuniao', 'is', null).neq('etapa', 'perdido').neq('id', clienteId),
    banco.from('agenda_config').select('grade').eq('id', 1).maybeSingle(),
  ])
  if (reunioes.error) console.warn('[meta-webhook] horarios ocupados:', reunioes.error.message)
  if (config.error) console.warn('[meta-webhook] grade da agenda:', config.error.message)
  const agora = Date.now()
  const ocupados = (reunioes.data ?? [])
    .map((l: { reuniao: { data?: string; pedidoEm?: string; confirmada?: boolean } | null }) => (l.reuniao?.confirmada ? l.reuniao.data : l.reuniao?.pedidoEm))
    .filter((d): d is string => Boolean(d) && new Date(d as string).getTime() > agora - 3600000)
  // Sem grade salva na tela, o robo usa a padrao (regras da Andreia).
  return { ocupados, grade: (config.data?.grade as GradeDaAgenda | undefined) ?? undefined }
}

// "Nao entendi" das regras: o contador subiu ou o robo passou para a equipe por isso.
function naoEntendeu(antes: EstadoRobo, r: { estado: EstadoRobo; sinais: { tipo: string; motivo?: string }[] }): boolean {
  return r.estado.naoEntendeu > (antes.naoEntendeu ?? 0) || r.sinais.some((s) => s.tipo === 'encaminhar' && /não entendeu/i.test(s.motivo ?? ''))
}

// A pergunta que a familia viu por ultimo: vai para o interprete como contexto.
async function ultimaFalaDoRobo(clienteId: string): Promise<string | null> {
  const { data } = await banco.from('mensagens').select('texto').eq('cliente_id', clienteId).eq('de', 'robo').order('em', { ascending: false }).limit(1).maybeSingle()
  return data?.texto ?? null
}

// O fim da conversa antes das mensagens que chegaram (mais antiga primeiro),
// para o interprete ver o contexto. O nome da familia vai trocado por [nome] (LGPD).
async function falasRecentes(clienteId: string, semIds: Set<string>, nome: string | undefined, pergunta: string): Promise<Fala[]> {
  const { data } = await banco.from('mensagens').select('id, de, texto').eq('cliente_id', clienteId).order('em', { ascending: false }).limit(12)
  const falas: Fala[] = (data ?? [])
    .filter((m) => !semIds.has(m.id))
    .slice(0, 6)
    .reverse()
    .map((m) => ({ de: m.de === 'cliente' ? 'familia' : 'escritorio', texto: semNome(m.texto ?? '', nome) }))
  // A ultima pergunta ja vai a parte: nao repete.
  const ultima = falas.at(-1)
  if (ultima?.de === 'escritorio' && ultima.texto === semNome(pergunta, nome)) falas.pop()
  return falas
}

function semNome(texto: string, nome: string | undefined): string {
  const primeiro = (nome ?? '').trim().split(/\s+/)[0]
  if (!primeiro || primeiro.length < 3) return texto
  const escapado = primeiro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return texto.replace(new RegExp(`(?<![\\p{L}])${escapado}(?![\\p{L}])`, 'giu'), '[nome]')
}

async function evento(clienteId: string, tipo: string, texto: string) {
  await banco.from('eventos').insert({ cliente_id: clienteId, tipo, texto })
}

async function processar(m: MensagemMeta) {
  const conteudo = conteudoDaMensagem(m)
  const texto = conteudo.texto.trim()
  if (!texto) return
  const em = new Date(Number(m.timestamp) * 1000 || Date.now())

  // Cliente por telefone (cria na primeira mensagem).
  let { data: cliente } = await banco.from('clientes').select('*').eq('telefone', m.from).maybeSingle()
  let novo = false
  if (!cliente) {
    const origem = origemDoContato(m, texto)
    const anuncio = m.referral
      ? { titulo: m.referral.headline ?? null, texto: m.referral.body ?? null, link: m.referral.source_url ?? null, id: m.referral.source_id ?? null, tipo: m.referral.source_type ?? null, ctwa_clid: m.referral.ctwa_clid ?? null }
      : null
    const criado = await banco.from('clientes').insert({ telefone: m.from, origem, anuncio, robo: novoEstado() }).select('*').single()
    if (criado.error) {
      // Duas mensagens juntas do mesmo numero novo: a outra criou primeiro.
      // Em 19/10/2026 o erro real era permissao da tabela, e o log so dizia
      // "nao encontrado": agora o motivo do banco vai junto.
      console.warn('[meta-webhook] insert do cliente recusado:', criado.error.message)
      const de_novo = await banco.from('clientes').select('*').eq('telefone', m.from).single()
      if (de_novo.error) throw new Error(`cliente ${m.from}: insert "${criado.error.message}", select "${de_novo.error.message}"`)
      cliente = de_novo.data
    } else {
      cliente = criado.data
      novo = true
      await evento(cliente.id, 'sistema', `Contato chegou pelo ${NOME_DA_ORIGEM[origem]}${anuncio?.titulo ? `: "${anuncio.titulo}"` : ''}`)
    }
  }
  if (!cliente) throw new Error(`cliente ${m.from} nao encontrado nem criado`)

  // Idempotencia: a mesma mensagem da Meta so entra uma vez.
  const gravada = await banco
    .from('mensagens')
    .insert({
      cliente_id: cliente.id,
      de: 'cliente',
      texto,
      wamid: m.id,
      em: em.toISOString(),
      responde_a: m.context?.id ?? (m.type === 'reaction' ? (m.reaction?.message_id ?? null) : null),
      midia_tipo: conteudo.midia?.tipo ?? null,
      midia_nome: conteudo.midia?.filename ?? null,
    })
    .select('id')
    .single()
  if (gravada.error) {
    if (gravada.error.code === '23505') return
    throw gravada.error
  }

  // Baixar a midia nao segura o robo nem a resposta para a Meta: corre junto
  // e termina depois do 200 (EdgeRuntime.waitUntil).
  if (conteudo.midia) {
    const tarefa = guardarMidia(gravada.data.id, cliente.id, conteudo.midia).catch((e) => console.error('[meta-webhook] midia', m.id, e))
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime
    if (runtime) runtime.waitUntil(tarefa)
    else await tarefa
  }

  // Reacao e figurinha: a equipe ve, o robo nao responde. Figurinha como
  // primeiro contato vale um "oi", senao a familia ficaria sem abertura.
  const entrada = conteudo.entrada || (novo && m.type !== 'reaction' ? 'oi' : '')
  if (!entrada) {
    await banco
      .from('clientes')
      .update({ nao_lidas: (cliente.nao_lidas ?? 0) + (m.type === 'reaction' ? 0 : 1), ultima_do_cliente_em: em.toISOString() })
      .eq('id', cliente.id)
    return
  }

  // Uma rajada de mensagens recebe uma resposta so, e uma conversa roda o robo
  // uma vez por vez: em 23/10/2026 a Sabrina mandou 3 mensagens em 14 s, cada
  // uma rodou o robo ao mesmo tempo com o estado velho, e ele seguiu
  // perguntando depois de passar para a equipe. Quem chegou por ultimo
  // responde por todas; o 200 vai antes para a Meta (EdgeRuntime.waitUntil).
  const tarefa = responderNaVez(cliente.id, m.from, gravada.data.id, entrada).catch((e) => console.error('[meta-webhook] robo', m.id, e))
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (runtime) runtime.waitUntil(tarefa)
  else await tarefa
}

// Espera para juntar a rajada ("mais ou menos" / "eu trabalho clt" / "mas o
// liquido e menos" e um pensamento so). Era 4 s; o "não" e "nenhuma" da
// Sabrina vieram com 6 s de diferenca (23/10/2026).
const AGRUPAR_MS = 8000
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

interface Pendente {
  id: string
  em: string
  entrada: string
}

// O que o robo le de uma mensagem gravada (o mesmo de conteudoDaMensagem).
function entradaDaLinha(l: { texto: string | null; midia_tipo: string | null }): string {
  const t = (l.texto ?? '').trim()
  if (l.midia_tipo === 'figurinha') return ''
  if (l.midia_tipo === 'audio') return '[áudio recebido]'
  if (l.midia_tipo) return '[arquivo recebido]'
  if (!t || /^Reagiu com /.test(t)) return ''
  if (/^(📍 Localização|👤 Contato:|Mensagem que a API do WhatsApp não mostra)/u.test(t)) return '[arquivo recebido]'
  return t
}

// Mensagens da familia que o robo ainda nao leu (reacao e figurinha entram
// para serem marcadas como lidas, mas sem entrada).
async function pendentesDoRobo(clienteId: string, msgId: string, entradaDaMsg: string): Promise<Pendente[]> {
  const { data, error } = await banco
    .from('mensagens')
    .select('id, texto, midia_tipo, em')
    .eq('cliente_id', clienteId)
    .eq('de', 'cliente')
    .is('robo_leu_em', null)
    .gte('em', new Date(Date.now() - 30 * 60000).toISOString())
    .order('em')
    .order('id')
    .limit(20)
  if (error) {
    // Sem a coluna (migration nao aplicada): responde so a mensagem dela, como antes.
    console.warn('[meta-webhook] pendentes:', error.message)
    return [{ id: msgId, em: new Date().toISOString(), entrada: entradaDaMsg }]
  }
  // A figurinha do primeiro contato vale "oi": a entrada dela vem de quem chamou.
  return (data ?? []).map((l) => ({ id: l.id, em: l.em, entrada: l.id === msgId ? entradaDaMsg : entradaDaLinha(l) }))
}

// Trava da conversa: update condicional (atomico no Postgres). Vence em 60 s
// se a rodada morrer no meio.
async function pegarAVez(clienteId: string): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    const agora = new Date()
    const { data, error } = await banco
      .from('clientes')
      .update({ robo_ocupado_ate: new Date(agora.getTime() + 60000).toISOString() })
      .eq('id', clienteId)
      .or(`robo_ocupado_ate.is.null,robo_ocupado_ate.lt.${agora.toISOString()}`)
      .select('id')
    if (error) {
      console.warn('[meta-webhook] trava:', error.message)
      return true
    }
    if (data?.length) return true
    await esperar(1000)
  }
  return false
}

async function responderNaVez(clienteId: string, telefone: string, msgId: string, entradaDaMsg: string) {
  await esperar(AGRUPAR_MS)
  // Chegou outra mensagem depois desta: a rodada e dela.
  const ultimaComEntrada = (p: Pendente[]) => p.filter((x) => x.entrada).at(-1)?.id
  if (ultimaComEntrada(await pendentesDoRobo(clienteId, msgId, entradaDaMsg)) !== msgId) return
  if (!(await pegarAVez(clienteId))) {
    await evento(clienteId, 'sistema', 'O robô ficou ocupado demais e não respondeu: confira a conversa.')
    return
  }
  try {
    const pendentes = await pendentesDoRobo(clienteId, msgId, entradaDaMsg)
    if (ultimaComEntrada(pendentes) !== msgId) return
    const { data: cliente, error } = await banco.from('clientes').select('*').eq('id', clienteId).single()
    if (error || !cliente) throw new Error(`cliente ${clienteId}: ${error?.message}`)
    await rodarORobo(cliente, telefone, pendentes)
  } finally {
    await banco.from('clientes').update({ robo_ocupado_ate: null }).eq('id', clienteId)
  }
}

// deno-lint-ignore no-explicit-any
async function rodarORobo(cliente: any, telefone: string, pendentes: Pendente[]) {
  const comEntrada = pendentes.filter((p) => p.entrada)
  // Texto junto com foto/audio: o robo le o texto (a equipe ve o arquivo).
  const textos = comEntrada.map((p) => p.entrada).filter((t) => !/^\[(áudio|arquivo) recebido\]$/.test(t))
  const entrada = textos.length ? textos.join('\n') : comEntrada.at(-1)!.entrada
  const em = new Date(comEntrada.at(-1)!.em)

  const estado: EstadoRobo = cliente.robo?.ficha ? cliente.robo : novoEstado()

  // Sim ou nao solto mandado antes de a familia ver a pergunta nova ("não" e,
  // 6 s depois, "nenhuma"): nao responde a ela. Fica lido, sem resposta.
  const { data: ultimaDoRobo } = await banco.from('mensagens').select('em').eq('cliente_id', cliente.id).eq('de', 'robo').order('em', { ascending: false }).limit(1).maybeSingle()
  if (!estado.pausado && respostaAtrasada(comEntrada.map((p) => ({ em: p.em, texto: p.entrada })), ultimaDoRobo?.em)) {
    await banco.from('clientes').update({ nao_lidas: (cliente.nao_lidas ?? 0) + comEntrada.length, ultima_do_cliente_em: em.toISOString() }).eq('id', cliente.id)
    await banco.from('mensagens').update({ robo_leu_em: new Date().toISOString() }).in('id', pendentes.map((p) => p.id))
    await evento(cliente.id, 'robo', `"${entrada.slice(0, 60).replace(/\n/g, ' / ')}" chegou antes da pergunta nova: o robô não usou como resposta`)
    return
  }

  const agenda = await agendaDaVez(cliente.id)
  let r = responder(estado, entrada, em, agenda)

  // As regras nao entenderam: o interprete (Claude) le o fim da conversa e
  // escolhe: reescrever a resposta (o robo roda de novo), anotar o que
  // completa uma pergunta anterior, ou contornar com uma frase curta e repetir
  // a pergunta. So se nem ele entender (ou ja tiver contornado demais) fica o
  // "nao entendi". Audio e arquivo nao passam (nao ha texto).
  if (naoEntendeu(estado, r) && !/^\[(áudio|arquivo) recebido\]$/.test(entrada)) {
    const pergunta = await ultimaFalaDoRobo(cliente.id)
    if (pergunta) {
      const nome = estado.ficha?.nome
      const antes = await falasRecentes(cliente.id, new Set(pendentes.map((p) => p.id)), nome, pergunta)
      const i = await interpretar(semNome(pergunta, nome), entrada, antes)
      if (i.erro) console.warn('[meta-webhook] interprete:', i.erro)
      const curta = entrada.slice(0, 160).replace(/\n/g, ' / ')
      let feito: typeof r | null = null
      if (i.tipo === 'resposta') {
        const segunda = responder(estado, i.resposta, em, agenda)
        if (!naoEntendeu(estado, segunda)) {
          feito = segunda
          await evento(cliente.id, 'robo', `Intérprete: "${curta}" entendido como "${i.resposta}"`)
        } else {
          // Ela achou que era resposta, mas as regras nao leram: segue a conversa.
          feito = contornar(estado, '', em)
          if (feito) await evento(cliente.id, 'robo', `Intérprete: "${curta}" entendido como "${i.resposta}", mas o robô não leu; repetiu a pergunta`)
        }
      } else if (i.tipo === 'complemento') {
        feito = anotarComplemento(estado, i.resposta, em, i.ponte)
        if (feito) await evento(cliente.id, 'robo', `Intérprete: "${curta}" completa a resposta anterior: ${i.resposta}`)
      } else if (i.tipo === 'contornar') {
        feito = contornar(estado, i.ponte, em, i.duvida || undefined)
        if (feito) await evento(cliente.id, 'robo', `Intérprete contornou "${curta}" com: "${feito.respostas[0]}"`)
      }
      if (feito) r = feito
    }
  }

  let etapa: Etapa = cliente.etapa
  let reuniao = cliente.reuniao
  let origem: string = cliente.origem
  let motivoPerda: string | null = cliente.motivo_perda ?? null
  for (const s of r.sinais) {
    // Origem lida na conversa so troca o "anuncio" sem plataforma.
    if (s.tipo === 'origem' && s.origem && s.origem !== 'anuncio' && origem === 'anuncio') {
      origem = s.origem
      await evento(cliente.id, 'sistema', `Origem: ${NOME_DA_ORIGEM[s.origem] ?? s.origem} (pela mensagem da família)`)
    }
    if (s.tipo === 'duvida') await evento(cliente.id, 'robo', `Dúvida para o advogado: "${s.texto}"`)
    if (s.tipo === 'pendencia_resolvida') {
      await banco.from('pendencias').update({ resolvida: true }).eq('cliente_id', cliente.id).eq('texto', s.texto).eq('resolvida', false)
      await evento(cliente.id, 'robo', `Pendência resolvida pela família: ${s.texto}`)
    }
    // Quem desiste vai para "Perdido" e nao recebe mais retorno automatico (C28).
    if (s.tipo === 'encerrar') {
      etapa = 'perdido'
      motivoPerda = 'Desistiu do pedido'
      await banco.from('pendencias').update({ resolvida: true }).eq('cliente_id', cliente.id).eq('resolvida', false)
      await evento(cliente.id, 'etapa', 'Robô encerrou: a família desistiu')
    }
    if (s.tipo === 'etapa' && etapa !== 'perdido' && ORDEM.indexOf(s.etapa) > ORDEM.indexOf(etapa)) {
      etapa = s.etapa
      await evento(cliente.id, 'etapa', `Robô moveu para ${s.etapa}`)
    }
    if (s.tipo === 'pendencia') {
      await banco.from('pendencias').insert({ cliente_id: cliente.id, texto: s.texto, retorno_em: new Date(em.getTime() + s.dias * 86400000).toISOString() })
      await evento(cliente.id, 'robo', `Pendência: ${s.texto} (retorno em ${s.dias} dia(s))`)
    }
    if (s.tipo === 'encaminhar') await evento(cliente.id, 'robo', `Encaminhado à equipe: ${s.motivo}`)
    if (s.tipo === 'reuniao') {
      reuniao = { quando: s.quando, advogado: 'Dr. André', confirmada: false, ...(s.em ? { pedidoEm: s.em } : {}) }
      const f = r.estado.ficha
      const menor = (f.para === 'filho' || f.para === 'filha') && (f.idade === undefined || f.idade < 18)
      await banco
        .from('contratos')
        .upsert(
          { cliente_id: cliente.id, com_parte_fixa: contratoComParteFixa(f), dados: { menor, nome: f.para === 'proprio' ? (f.nome ?? '') : '', repNome: menor ? (f.nome ?? '') : '' } },
          { onConflict: 'cliente_id', ignoreDuplicates: true },
        )
      await evento(cliente.id, 'robo', `Reunião pedida para ${s.quando}. Contrato preparado em rascunho.`)
    }
  }

  await banco
    .from('clientes')
    .update({
      robo: r.estado,
      nome: cliente.nome || r.estado.ficha.nome || '',
      etapa,
      reuniao,
      origem,
      motivo_perda: motivoPerda,
      nao_lidas: (cliente.nao_lidas ?? 0) + comEntrada.length,
      ultima_do_cliente_em: em.toISOString(),
    })
    .eq('id', cliente.id)
  await banco.from('mensagens').update({ robo_leu_em: new Date().toISOString() }).in('id', pendentes.map((p) => p.id))

  for (const resposta of r.respostas) {
    const envio = await enviarTexto(telefone, resposta)
    await banco.from('mensagens').insert({
      cliente_id: cliente.id,
      de: 'robo',
      texto: resposta,
      wamid: envio.wamid ?? null,
      status_envio: envio.ok ? 'sent' : 'failed',
      erro_envio: envio.erro ?? null,
    })
    if (!envio.ok) {
      // Robo nao conseguiu responder: para e chama a equipe em vez de sumir.
      await banco.from('clientes').update({ robo: { ...r.estado, pausado: true, encaminhado: true, motivoPausa: `Falha no envio: ${envio.erro}` } }).eq('id', cliente.id)
      await evento(cliente.id, 'sistema', `FALHA ao enviar resposta do robô: ${envio.erro}`)
      console.error('[meta-webhook] envio falhou', telefone, envio.erro)
      break
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('ok')

  const cru = await req.text()
  if (!(await assinaturaValida(cru, req.headers.get('x-hub-signature-256')))) {
    console.warn('[meta-webhook] assinatura invalida: confira META_APP_SECRET')
    return new Response('assinatura invalida', { status: 401 })
  }

  try {
    const corpo = JSON.parse(cru)
    for (const entrada of corpo.entry ?? []) {
      for (const mudanca of entrada.changes ?? []) {
        const valor = mudanca.value ?? {}
        for (const st of valor.statuses ?? []) {
          await banco.from('mensagens').update({ status_envio: st.status, erro_envio: st.errors?.[0]?.title ?? null }).eq('wamid', st.id)
        }
        for (const m of (valor.messages ?? []) as MensagemMeta[]) {
          try {
            await processar(m)
          } catch (erro) {
            console.error('[meta-webhook] erro ao processar', m.id, erro)
          }
        }
      }
    }
  } catch (erro) {
    console.error('[meta-webhook] corpo invalido', erro)
  }
  return new Response('ok')
})
