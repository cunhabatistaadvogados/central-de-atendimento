import { contratoComParteFixa, ehIdoso, normalizar, novoEstado, primeiroNome, responder, temLaudo, type Etapa, type Ficha, type Sinal } from '@motor/robo'
import { dadosVazios } from './contrato'
import { ESCRITORIO, ORIGENS, etapa as infoEtapa } from './escritorio'
import type { Cliente, Contrato, Evento, Mensagem, Origem } from './tipos'

/** Publico da campanha (Lucas, 21/10/2026): pela frase da 1a mensagem ou pelo que a ficha ja sabe. */
export function publicos(f: Ficha): ('Autista' | 'Idoso')[] {
  const p: ('Autista' | 'Idoso')[] = []
  if (f.campanha === 'autista' || /Autismo/.test(f.diagnostico ?? '')) p.push('Autista')
  if (f.campanha === 'idoso' || f.area === 'idoso' || ehIdoso(f)) p.push('Idoso')
  return p
}

/** Laudo como a equipe le: de qualquer ano conta como "tem" (D1 do Raio-X). */
export function textoDoLaudo(f: Ficha): string | undefined {
  if (temLaudo(f)) return `Tem${f.laudoAno ? `, de ${f.laudoAno}` : ''}`
  if (f.laudo === 'nao_sei') return 'Não sabe (sem valores até a equipe ver)'
  if (f.laudo === 'sem') return 'Não tem'
  return undefined
}

/** uuid: o mesmo id serve na demonstracao e como chave no banco real. */
export function id(): string {
  return crypto.randomUUID()
}

function evento(tipo: Evento['tipo'], texto: string, em: string): Evento {
  return { id: id(), tipo, texto, em }
}

const ORDEM: Etapa[] = ['novo', 'qualificacao', 'qualificado', 'reuniao', 'contrato', 'contratado']

/** Etapa so anda para frente pelo robo; voltar ou perder e decisao da equipe. */
function avanca(atual: Etapa, nova: Etapa): boolean {
  if (atual === 'perdido') return false
  return ORDEM.indexOf(nova) > ORDEM.indexOf(atual)
}

export function novoCliente(telefone: string, origem: Origem, em: string, nome = ''): Cliente {
  return {
    id: id(),
    nome,
    telefone,
    origem,
    criadoEm: em,
    atualizadoEm: em,
    etapa: 'novo',
    robo: novoEstado(),
    mensagens: [],
    pendencias: [],
    eventos: [evento('sistema', `Contato chegou pelo ${(ORIGENS[origem] ?? origem).toLowerCase()}`, em)],
    documentos: { rg: false, cpf: false, comprovante: false, cadunico: false, laudo: false },
    naoLidas: 0,
  }
}

function somarDias(iso: string, dias: number): string {
  return new Date(new Date(iso).getTime() + dias * 86400000).toISOString()
}

/**
 * Contrato ja comeca preenchido com o que a conversa contou: versao (com ou
 * sem valor fixo, pelo laudo), menor ou nao, nome de quem assina. A equipe
 * so completa documento e endereco, que o robo nunca pede.
 */
export function rascunhoDoContrato(c: Cliente): Contrato {
  const f = c.robo.ficha
  const menor = (f.para === 'filho' || f.para === 'filha') && (f.idade === undefined || f.idade < 18)
  const dados = dadosVazios()
  dados.menor = menor
  if (menor) {
    dados.repNome = c.nome
    dados.repParentesco = 'genitora'
    dados.nacionalidade = f.para === 'filha' ? 'brasileira' : 'brasileiro'
  } else if (f.para === 'proprio') {
    dados.nome = c.nome
  }
  return { status: 'rascunho', comParteFixa: contratoComParteFixa(f), okAdvogado: false, dados }
}

export function aplicarSinais(c: Cliente, sinais: Sinal[], em: string): Cliente {
  let cli = c
  for (const s of sinais) {
    if (s.tipo === 'etapa' && avanca(cli.etapa, s.etapa)) {
      cli = { ...cli, etapa: s.etapa, eventos: [...cli.eventos, evento('etapa', `Robô moveu para ${infoEtapa(s.etapa).nome}`, em)] }
    }
    if (s.tipo === 'pendencia') {
      cli = {
        ...cli,
        pendencias: [...cli.pendencias, { id: id(), texto: s.texto, criadaEm: em, retornoEm: somarDias(em, s.dias), resolvida: false }],
        eventos: [...cli.eventos, evento('robo', `Pendência: ${s.texto} (retorno em ${s.dias} dia${s.dias > 1 ? 's' : ''})`, em)],
      }
    }
    if (s.tipo === 'encaminhar') {
      cli = { ...cli, eventos: [...cli.eventos, evento('robo', `Encaminhado à equipe: ${s.motivo}`, em)] }
    }
    if (s.tipo === 'duvida') {
      cli = { ...cli, eventos: [...cli.eventos, evento('robo', `Dúvida para o advogado: "${s.texto}"`, em)] }
    }
    if (s.tipo === 'pendencia_resolvida') {
      cli = {
        ...cli,
        pendencias: cli.pendencias.map((p) => (p.texto === s.texto ? { ...p, resolvida: true } : p)),
        eventos: [...cli.eventos, evento('robo', `Pendência resolvida pela família: ${s.texto}`, em)],
      }
    }
    // Origem lida na conversa so troca o "anuncio" sem plataforma.
    if (s.tipo === 'origem' && s.origem && s.origem !== 'anuncio' && cli.origem === 'anuncio') {
      cli = { ...cli, origem: s.origem, eventos: [...cli.eventos, evento('sistema', `Origem: ${ORIGENS[s.origem] ?? s.origem} (pela mensagem da família)`, em)] }
    }
    // Quem desiste vai para "Perdido" e nao recebe mais retorno automatico (C28).
    if (s.tipo === 'encerrar') {
      cli = {
        ...cli,
        etapa: 'perdido',
        motivoPerda: 'Desistiu do pedido',
        pendencias: cli.pendencias.map((p) => ({ ...p, resolvida: true })),
        eventos: [...cli.eventos, evento('etapa', 'Robô encerrou: a família desistiu', em)],
      }
    }
    if (s.tipo === 'reuniao') {
      cli = {
        ...cli,
        reuniao: { quando: s.quando, advogado: ESCRITORIO.advogadoDoBpc, confirmada: false, ...(s.em ? { pedidoEm: s.em } : {}) },
        contrato: cli.contrato ?? rascunhoDoContrato(cli),
        eventos: [...cli.eventos, evento('robo', `Reunião pedida para ${s.quando}. Contrato preparado em rascunho.`, em)],
      }
    }
  }
  return cli
}

/** Mensagem do cliente chega: grava, roda o robo, grava as respostas. */
export function receberDoCliente(c: Cliente, texto: string, em: string): Cliente {
  const msg: Mensagem = { id: id(), de: 'cliente', texto, em }
  const r = responder(c.robo, texto, new Date(em))
  const nome = c.nome || r.estado.ficha.nome || ''
  const emResposta = new Date(new Date(em).getTime() + 25000).toISOString()
  const respostas: Mensagem[] = r.respostas.map((t, i) => ({
    id: id(),
    de: 'robo',
    texto: t,
    em: new Date(new Date(emResposta).getTime() + i * 4000).toISOString(),
  }))
  let cli: Cliente = {
    ...c,
    nome,
    robo: r.estado,
    mensagens: [...c.mensagens, msg, ...respostas],
    atualizadoEm: respostas.at(-1)?.em ?? em,
    naoLidas: c.naoLidas + 1,
  }
  cli = aplicarSinais(cli, r.sinais, em)
  if (r.estado.pausado && !c.robo.pausado) {
    cli = { ...cli, eventos: [...cli.eventos, evento('robo', `Robô pausado: ${r.estado.motivoPausa ?? 'equipe assume'}`, em)] }
  }
  return cli
}

export function enviarComoEquipe(c: Cliente, texto: string, autor: string, em: string): Cliente {
  const assumiu = !c.robo.pausado
  return {
    ...c,
    robo: { ...c.robo, pausado: true, motivoPausa: assumiu ? `${autor} assumiu a conversa` : c.robo.motivoPausa },
    mensagens: [...c.mensagens, { id: id(), de: 'equipe', texto, em, autor }],
    atualizadoEm: em,
    naoLidas: 0,
    eventos: assumiu ? [...c.eventos, evento('equipe', `${autor} assumiu a conversa`, em)] : c.eventos,
  }
}

/** Esperando a equipe: robo parado e a ultima palavra nao e nossa. */
const PALAVRAS_DE_AGRADECIMENTO = new Set(
  'ok okk okay blz beleza ta bom certo certinho combinado obrigado obrigada obrigadao obg brigado brigada muito muitissimo valeu vlw show perfeito otimo entendi entendido amem deus abencoe abencoa tmj tudo joia'.split(' '),
)

/** Mensagem que nao pede resposta: "Ok", "Muito obrigado!", "Tá bom 🙏", reacao. Midia nunca conta. */
export function soAgradece(m: Mensagem): boolean {
  if (m.midiaTipo && m.midiaTipo !== 'figurinha') return false
  if (/^Reagiu com /.test(m.texto) || m.midiaTipo === 'figurinha') return true
  const palavras = normalizar(m.texto)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  // So emoji (sem palavra nenhuma) tambem e confirmacao; frase longa nunca e.
  if (palavras.length > 6) return false
  return palavras.every((p) => PALAVRAS_DE_AGRADECIMENTO.has(p))
}

export function esperandoEquipe(c: Cliente): boolean {
  if (c.etapa === 'perdido' || c.etapa === 'contratado') return false
  const ultima = c.mensagens.at(-1)
  if (!ultima) return false
  if (!c.robo.pausado) return false
  const ultimaDaEquipe = [...c.mensagens].reverse().find((m) => m.de === 'equipe')
  const ultimaDoCliente = [...c.mensagens].reverse().find((m) => m.de === 'cliente')
  if (!ultimaDoCliente) return false
  if (ultimaDaEquipe && ultimaDaEquipe.em > ultimaDoCliente.em) return false
  // A equipe marcou como resolvida e o cliente nao escreveu de novo.
  if (c.robo.resolvidoAte && ultimaDoCliente.em <= c.robo.resolvidoAte) return false
  // Depois da resposta da equipe o cliente so agradeceu ou confirmou ("Ok",
  // "Obrigado", um polegar): nao precisa de resposta (Sr. Cicero, 22/10/2026).
  // Sem resposta da equipe ainda, um "ok" continua esperando: ninguem atendeu.
  if (ultimaDaEquipe) {
    const depois = c.mensagens.filter((m) => m.de === 'cliente' && m.em > ultimaDaEquipe.em && (!c.robo.resolvidoAte || m.em > c.robo.resolvidoAte))
    if (depois.length && depois.every((m) => soAgradece(m))) return false
  }
  // Pausa por "decisao em familia" espera a familia, nao a equipe: so conta
  // se o robo passou a bola ou se o cliente falou depois da ultima resposta.
  return c.robo.encaminhado || ultima.de === 'cliente'
}

export function desde(c: Cliente): string | undefined {
  return [...c.mensagens].reverse().find((m) => m.de === 'cliente')?.em
}

export function nomeCurto(c: Cliente): string {
  return primeiroNome(c.nome) || 'Sem nome'
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter((x) => /^[A-Za-zÀ-ÿ]/.test(x))
  // Sem nome ainda o avatar recebe o telefone: mostra os dois ultimos digitos.
  if (!p.length) return nome.replace(/\D/g, '').slice(-2) || '?'
  return ((p[0][0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/**
 * Horarios ja tomados (ISO): reuniao confirmada ou horario exato pedido ao
 * robo. O mesmo calculo do webhook, para a tela mostrar o que o robo oferece.
 */
export function horariosOcupados(clientes: Cliente[], exceto?: string): string[] {
  const agora = Date.now()
  return clientes
    .filter((c) => c.id !== exceto && c.reuniao && c.etapa !== 'perdido')
    .map((c) => (c.reuniao!.confirmada ? c.reuniao!.data : c.reuniao!.pedidoEm))
    .filter((d): d is string => Boolean(d) && new Date(d as string).getTime() > agora - 3600000)
}

/** Outro cliente com reuniao nos mesmos 30 minutos (para avisar antes de confirmar). */
export function conflitoDeHorario(clientes: Cliente[], iso: string, exceto: string, duracaoMin = 30): Cliente | undefined {
  const ms = new Date(iso).getTime()
  const dur = duracaoMin * 60000
  return clientes.find((c) => {
    if (c.id === exceto || !c.reuniao || c.etapa === 'perdido') return false
    const d = c.reuniao.confirmada ? c.reuniao.data : c.reuniao.pedidoEm
    if (!d) return false
    const o = new Date(d).getTime()
    return o < ms + dur && ms < o + dur
  })
}

/** "sexta-feira, 23/10, às 9h" no horario de Brasilia, para a mensagem a familia. */
export function dataDaReuniao(iso: string): string {
  const d = new Date(iso)
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...o })
  const min = Number(f({ minute: 'numeric' }))
  return `${f({ weekday: 'long' })}, ${f({ day: '2-digit', month: '2-digit' })}, às ${Number(f({ hour: 'numeric', hour12: false }))}h${min ? String(min).padStart(2, '0') : ''}`
}

/** WhatsApp para a familia quando a equipe confirma, remarca ou desmarca. */
export function mensagemDaReuniao(c: Cliente, tipo: 'confirmada' | 'remarcada' | 'desmarcada', iso: string): string {
  const nome = primeiroNome(c.nome)
  const ola = nome ? `Olá, ${nome}.` : 'Olá.'
  if (tipo === 'desmarcada') return `${ola} Precisamos desmarcar a reunião com o ${ESCRITORIO.advogadoDoBpc} de ${dataDaReuniao(iso)}. A equipe já te chama para combinar um novo horário.`
  return `${ola} Sua reunião com o ${ESCRITORIO.advogadoDoBpc} está ${tipo} para ${dataDaReuniao(iso)}. Ele vai te chamar por chamada de vídeo aqui no WhatsApp.`
}
