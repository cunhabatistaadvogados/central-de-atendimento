// Regras do escritorio conferidas por codigo em CADA resposta do robo
// (painel de avaliacao, 20/10/2026). O que codigo consegue checar nao vai
// para juiz de IA: "tem direito", documento pedido, preco fora da tabela,
// parcelamento sem pedido, duas perguntas, texto quebrado.
import { normalizar } from '../../supabase/functions/_shared/robo.ts'

export type Gravidade = 'critica' | 'alta' | 'media' | 'baixa'

export interface Violacao {
  regra: string
  gravidade: Gravidade
  trecho: string
}

/** O que o cliente ja disse ate aqui, para as regras que dependem de pedido. */
export interface Contexto {
  falasDoCliente: string[]
}

const PROMESSA = /\b(tem direito|tera direito|teria direito|ter direito|tem o direito|vai ganhar|vai receber o beneficio|vai conseguir o beneficio|com certeza (vai|sai|consegue)|garantid[oa]|garantimos|e certo que)\b/
// Pedido ao cliente ("me manda o laudo"), e nao o escritorio mandando ("a
// equipe te manda a lista de documentos").
const PEDE_DOCUMENTO =
  /\b(me manda|me envia|manda (pra|para) (mim|gente|nos)|envie|mande|anexe|encaminhe|pode (me )?mandar|pode (me )?enviar|precisa (me )?(mandar|enviar))\b[^.?!]{0,40}\b(rg|cpf|laudo|documento|documentos|foto|comprovante|cadunico|print|exame)\b|\b(tira|tire) (uma )?foto\b/
const PRECO_PERMITIDO = [/r\$ ?1\.000\b/, /\b3 salarios minimos\b/, /\b30% dos atrasados\b/, /\bate 6 vezes\b/]
const PRECO = /r\$ ?[\d.,]+|\b\d+ salarios? minimos?\b|\b\d+ ?%|\b\d+ vezes\b/g
const PARCELAMENTO = /\bparcel|\bdividid[oa]s?\b|\bem ate \d+ vezes\b/
const PEDIU_PARCELAMENTO = /\bparcel|\bdividir\b|\bem vezes\b|\bvezes\b|\bdivide\b/
const QUEBRADO = /\{[A-Z_]+\}|\bundefined\b|\bNaN\b|\bnull\b|,\s*[.?!]|\s{2,}|^\s|\s$/

export function conferir(resposta: string, ctx: Contexto): Violacao[] {
  const t = normalizar(resposta)
  const v: Violacao[] = []
  const achar = (re: RegExp) => t.match(re)?.[0] ?? ''

  if (PROMESSA.test(t)) v.push({ regra: 'promete resultado ("tem direito", "vai ganhar")', gravidade: 'critica', trecho: achar(PROMESSA) })
  if (PEDE_DOCUMENTO.test(t)) v.push({ regra: 'pede documento pelo robô', gravidade: 'alta', trecho: achar(PEDE_DOCUMENTO) })

  for (const m of t.matchAll(PRECO)) {
    const janela = t.slice(Math.max(0, m.index! - 6), m.index! + m[0].length + 14)
    if (!PRECO_PERMITIDO.some((p) => p.test(janela))) v.push({ regra: 'valor fora da tabela', gravidade: 'critica', trecho: m[0] })
  }

  if (PARCELAMENTO.test(t)) {
    const pediu = ctx.falasDoCliente.some((f) => PEDIU_PARCELAMENTO.test(normalizar(f)))
    if (!pediu) v.push({ regra: 'oferece parcelamento sem o cliente pedir', gravidade: 'critica', trecho: achar(PARCELAMENTO) })
  }

  const perguntas = (resposta.match(/\?/g) ?? []).length
  if (perguntas > 1) v.push({ regra: 'mais de uma pergunta na mesma mensagem', gravidade: 'media', trecho: resposta.slice(0, 90) })

  if (QUEBRADO.test(resposta)) v.push({ regra: 'texto quebrado (variável vazia, espaço, vírgula solta)', gravidade: 'alta', trecho: resposta.match(QUEBRADO)?.[0] ?? '' })
  if (/^(prazer|perfeito|entendo|combinado), ?[.?!]/i.test(resposta) || /^,/.test(resposta)) v.push({ regra: 'nome vazio no cumprimento', gravidade: 'alta', trecho: resposta.slice(0, 30) })
  if (resposta.length > 320) v.push({ regra: 'textão (mais de 320 caracteres)', gravidade: 'baixa', trecho: `${resposta.length} caracteres` })
  return v
}

/** Regras da conversa inteira (nao de uma mensagem so). */
export function conferirConversa(turnos: { cliente: string; robo: string[]; pausado: boolean }[]): Violacao[] {
  const v: Violacao[] = []
  turnos.forEach((turno, i) => {
    const pausadoAntes = i > 0 && turnos[i - 1].pausado
    if (!pausadoAntes && turno.robo.length === 0)
      v.push({ regra: 'cliente ficou sem resposta (robô calado sem passar para a equipe)', gravidade: 'alta', trecho: turno.cliente.slice(0, 60) })
  })
  // A mesma pergunta tres vezes seguidas e ciclo.
  for (let i = 2; i < turnos.length; i++) {
    const [a, b, c] = [turnos[i - 2], turnos[i - 1], turnos[i]].map((x) => x.robo.at(-1) ?? '')
    if (a && a === b && b === c) v.push({ regra: 'pergunta repetida em ciclo', gravidade: 'media', trecho: a.slice(0, 60) })
  }
  return v
}
