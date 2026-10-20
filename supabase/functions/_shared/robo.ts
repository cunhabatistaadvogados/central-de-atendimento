/**
 * Motor do atendimento BPC/LOAS da CB&AA no WhatsApp.
 *
 * Arquivo unico, sem import, para rodar igual nos tres lugares: na Edge
 * Function (Deno), no simulador da tela (Vite) e nos testes (Node). Mesmo
 * padrao do sistema do Dr. Marcello: o robo testado e o robo que roda.
 *
 * O roteiro e o do Lucas (CBAA_BPC_LOAS_CRM_Config_WhatsApp_v1.json, v2.5 de
 * 08/10/2026). Regras que vieram do diagnostico das 1.641 conversas e nao
 * podem se perder em ajuste de texto:
 * - 42% sumiam depois da 1a resposta, que era um paragrafo com duas
 *   perguntas. Aqui: no maximo 2 linhas e UMA pergunta por mensagem.
 * - 88% das conversas morriam com mensagem nossa sem horario marcado.
 *   Aqui: qualificou, oferece DOIS horarios proximos, nunca "quando puder".
 * - Nunca dizer que a pessoa "tem direito" ou "vai ganhar": o contrato e de
 *   meio. "Se qualifica para o atendimento" e o que pode.
 * - Nunca pedir CPF, RG ou foto de documento: isso e da equipe, depois.
 * - Honorarios so quando perguntam, e quem pergunta preco vai para a equipe.
 */

export const VERSAO_DO_ROTEIRO = 'v2.5 (Lucas, 08/10/2026) + motor deterministico 19/10/2026'

/** Salario minimo usado na conta da renda por pessoa. Conferir todo janeiro. */
export const SALARIO_MINIMO = 1621

export type Etapa = 'novo' | 'qualificacao' | 'qualificado' | 'reuniao' | 'contrato' | 'contratado' | 'perdido'

export type ParaQuem = 'filho' | 'filha' | 'proprio' | 'familiar'
export type Laudo = 'recente' | 'antigo' | 'sem'
export type CadUnico = 'atualizado' | 'desatualizado' | 'nao'
export type Tratamento = 'SUS' | 'plano' | 'particular' | 'nenhum' | 'outro'

export interface Ficha {
  nome?: string
  para?: ParaQuem
  /** "sua mae", "seu pai"... quando para = familiar */
  quem?: string
  /** pronome da pessoa do beneficio quando nao e o proprio cliente */
  pronome?: 'ele' | 'ela'
  idade?: number
  diagnostico?: string
  laudo?: Laudo
  faseMedica?: 'aceitou' | 'recusou'
  rotina?: string
  tratamento?: Tratamento
  tratamentoTexto?: string
  cadunico?: CadUnico
  pessoasCasa?: number
  rendaCasa?: number
  outrosBeneficios?: 'sim' | 'nao'
  outrosBeneficiosTexto?: string
  pedidoAnterior?: 'nao' | 'negado' | 'em_analise'
  tempoNegado?: string
  cidade?: string
  horario?: string
  origem?: 'anuncio' | 'site'
}

export type Pergunta =
  | 'abertura_quem'
  | 'nome_idade'
  | 'nome'
  | 'idade'
  | 'diagnostico'
  | 'laudo'
  | 'fase_medica'
  | 'fase_medica_recusou'
  | 'rotina'
  | 'tratamento'
  | 'cadunico'
  | 'cadunico_combinado'
  | 'casa_renda'
  | 'pessoas'
  | 'renda'
  | 'outros_beneficios'
  | 'pedido_anterior'
  | 'tempo_negado'
  | 'horario'
  | 'contrato_ok'
  | 'cidade'
  | 'retomar'
  | 'resumo_familia'
  | 'laudo_para_preco'

export interface EstadoRobo {
  ficha: Ficha
  ultimaPergunta: Pergunta | null
  /** pergunta a voltar depois de um desvio (preco, "e golpe?", cidade...) */
  voltarPara: Pergunta | null
  mensagensDoCliente: number
  naoEntendeu: number
  /** robo parou: a equipe assumiu. So a equipe religa. */
  pausado: boolean
  motivoPausa?: string
  encaminhado: boolean
}

export type Sinal =
  | { tipo: 'encaminhar'; motivo: string }
  | { tipo: 'pendencia'; texto: string; dias: number }
  | { tipo: 'etapa'; etapa: Etapa }
  | { tipo: 'reuniao'; quando: string }

export interface Resultado {
  respostas: string[]
  estado: EstadoRobo
  sinais: Sinal[]
}

export function novoEstado(): EstadoRobo {
  return {
    ficha: {},
    ultimaPergunta: null,
    voltarPara: null,
    mensagensDoCliente: 0,
    naoEntendeu: 0,
    pausado: false,
    encaminhado: false,
  }
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** minusculo e sem acento: o cliente escreve "nao", "não", "naum". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8,
  nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
}
const NUM = '(\\d{1,3}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze)'

function numero(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : NUMEROS[token] ?? NaN
}

function capitalizar(nome: string): string {
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase()
}

export function primeiroNome(nome?: string): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? ''
}

export function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const SIM = /^(sim|s|ss|isso|claro|quero|pode|pode ser|ok|okay|beleza|blz|tenho|tem|temos|aceito|bora|vamos|gostaria|com certeza|certo|uhum|aham|fechado|combinado|perfeito|otimo|show|isso mesmo|quero sim|sim sim)\b/
const NAO = /^(nao|n|nunca|ainda nao|agora nao|depois|nenhum|nenhuma|nem|negativo|naum)\b/

function ehSim(t: string): boolean {
  return SIM.test(t) && !/^(nao|n)\b/.test(t)
}
function ehNao(t: string): boolean {
  return NAO.test(t)
}

// ---------------------------------------------------------------------------
// Leitura do que o cliente contou (vale para qualquer mensagem)
// ---------------------------------------------------------------------------

const NAO_E_NOME = new Set([
  'oi', 'ola', 'bom', 'boa', 'sim', 'nao', 'meu', 'minha', 'ele', 'ela', 'e', 'eu', 'tenho', 'tem', 'sou',
  'aqui', 'o', 'a', 'pra', 'para', 'gostaria', 'quero', 'obrigado', 'obrigada', 'dia', 'tarde', 'noite',
  'tudo', 'bem', 'filho', 'filha', 'mae', 'pai', 'avo', 'tia', 'tio', 'responsavel', 'ok', 'certo',
  'gente', 'pessoal', 'dr', 'doutor', 'doutora', 'quanto', 'qual', 'como', 'preciso', 'estou', 'to',
  'moro', 'mora', 'somos', 'ja', 'so', 'mas', 'entao', 'que', 'isso', 'esse', 'essa', 'uma', 'um',
  'vou', 'vamos', 'pode', 'claro', 'beleza', 'blz', 'hoje', 'amanha', 'manha', 'meio', 'autista',
])

function extrairNome(original: string, perguntouNome: boolean): string | undefined {
  const explicito = original.match(
    /(?:meu nome [eé]|me chamo|aqui [eé] (?:a |o )?|eu sou (?:a |o )?|sou (?:a |o )?)\s*([A-Za-zÀ-ÿ]{2,})/i,
  )
  if (explicito && !NAO_E_NOME.has(normalizar(explicito[1]))) return capitalizar(explicito[1])
  if (!perguntouNome) return undefined
  const primeiro = original.trim().match(/^([A-Za-zÀ-ÿ]{2,})/)
  if (primeiro && !NAO_E_NOME.has(normalizar(primeiro[1]))) return capitalizar(primeiro[1])
  return undefined
}

const FAMILIA_ELA: Record<string, string> = {
  mae: 'sua mãe', avo: 'sua avó', irma: 'sua irmã', tia: 'sua tia', esposa: 'sua esposa', sogra: 'sua sogra',
}
const FAMILIA_ELE: Record<string, string> = {
  pai: 'seu pai', vo: 'seu avô', irmao: 'seu irmão', tio: 'seu tio', marido: 'seu marido', esposo: 'seu esposo',
  sogro: 'seu sogro', neto: 'seu neto', sobrinho: 'seu sobrinho', enteado: 'seu enteado',
}

function extrairParaQuem(t: string): Pick<Ficha, 'para' | 'quem' | 'pronome'> | undefined {
  if (/\b(minha filha|minha menina|da minha filha|pra minha filha|para minha filha)\b/.test(t)) return { para: 'filha', pronome: 'ela' }
  if (/\b(meu filho|meu menino|meu bebe|meus filhos|do meu filho|pra meu filho|pro meu filho|meu garoto|crianca)\b/.test(t))
    return { para: 'filho', pronome: 'ele' }
  if (/\b(minha neta|minha sobrinha|minha enteada)\b/.test(t)) {
    const q = t.match(/minha (neta|sobrinha|enteada)/)![1]
    return { para: 'familiar', quem: `sua ${q}`, pronome: 'ela' }
  }
  for (const [chave, quem] of Object.entries(FAMILIA_ELA)) {
    if (new RegExp(`\\b(minha|da minha|pra minha|para minha) ${chave}\\b`).test(t)) return { para: 'familiar', quem, pronome: 'ela' }
  }
  for (const [chave, quem] of Object.entries(FAMILIA_ELE)) {
    if (new RegExp(`\\b(meu|do meu|pro meu|pra meu|para meu|para o meu) ${chave}\\b`).test(t)) return { para: 'familiar', quem, pronome: 'ele' }
  }
  if (/\b(pra mim|para mim|pra eu|eu mesm[oa]|e meu|e pra mim|sou eu|minha aposentadoria|sou idos[oa]|tenho \d{2} anos)\b/.test(t))
    return { para: 'proprio' }
  if (/\bfilh[oa]\b/.test(t)) return { para: 'filho', pronome: 'ele' }
  return undefined
}

function extrairIdade(t: string, perguntouIdade: boolean): number | undefined {
  const anos = t.match(new RegExp(`\\b${NUM}\\s*(?:anos?|aninhos?)\\b`))
  if (anos) {
    const n = numero(anos[1])
    if (!Number.isNaN(n) && n < 120) return n
  }
  if (/\b\d{1,2}\s*mes(es)?\b/.test(t) || /\b(bebe|recem nascid)/.test(t)) return 0
  if (perguntouIdade) {
    // So algarismo, ou o numero por extenso sozinho ("seis"): "falar com UMA
    // pessoa" tinha virado 1 ano de idade.
    const solto = t.match(/(?:^|\s|,)(\d{1,3})(?:$|\s|,|\.)/) ?? t.match(new RegExp(`^${NUM}$`))
    if (solto) {
      const n = numero(solto[1])
      if (!Number.isNaN(n) && n < 120) return n
    }
  }
  return undefined
}

const DIAGNOSTICOS: [RegExp, string][] = [
  [/\b(autis|tea\b|espectro autista|transtorno do espectro)/, 'Autismo (TEA)'],
  [/\b(sindrome de down|down\b)/, 'Síndrome de Down'],
  [/\bparalisia cerebral\b/, 'Paralisia cerebral'],
  [/\btdah\b/, 'TDAH'],
  [/\bepilep/, 'Epilepsia'],
  [/\b(esquizofren|bipolar|depress)/, 'Transtorno mental'],
  [/\b(cadeirante|deficiencia fisica|amput)/, 'Deficiência física'],
  [/\b(cego|cegueira|baixa visao|deficiencia visual)/, 'Deficiência visual'],
  [/\b(surd|deficiencia auditiva)/, 'Deficiência auditiva'],
  [/\b(deficiencia intelectual|atraso (no )?desenvolvimento|atraso global)/, 'Deficiência intelectual / atraso'],
  [/\b(microcefal|hidrocefal)/, 'Microcefalia / hidrocefalia'],
  [/\b(cancer|tumor|oncolog)/, 'Câncer'],
]

function extrairDiagnostico(t: string): string | undefined {
  for (const [padrao, nome] of DIAGNOSTICOS) if (padrao.test(t)) return nome
  return undefined
}

function extrairLaudo(t: string, perguntouLaudo: boolean): Laudo | undefined {
  const falaDeLaudo = perguntouLaudo || /\blaudo/.test(t)
  if (!falaDeLaudo) return undefined
  if (/\b(sem laudo|nao tem laudo|nao temos laudo|nao tenho laudo|ainda nao tem|nunca teve|esta na fila|aguardando consulta)\b/.test(t)) return 'sem'
  if (/\b(antigo|velho|vencido|desatualizado|de 20(0\d|1\d|2[0-4])|faz (\d|dois|tres|quatro|cinco) anos|mais de (um|1) ano|de anos atras)\b/.test(t))
    return 'antigo'
  if (perguntouLaudo && ehNao(t)) return 'sem'
  if (/\b(recente|novo|desse ano|deste ano|este ano|esse ano|mes passado|ano passado nao|atualizado|de 2025|de 2026)\b/.test(t)) return 'recente'
  if (/\b(tem laudo|tenho laudo|temos laudo|com laudo|ja tem laudo|laudo de autismo|laudo do medico)\b/.test(t)) return 'recente'
  if (perguntouLaudo && ehSim(t)) return 'recente'
  return undefined
}

function extrairTratamento(t: string, perguntou: boolean): { tratamento: Tratamento; texto: string } | undefined {
  if (/\b(sus|posto|ubs|caps|apae|ame\b|hospital publico|prefeitura)\b/.test(t)) return { tratamento: 'SUS', texto: 'SUS' }
  if (/\b(plano|convenio|unimed|amil|bradesco saude|sulamerica|hapvida|notredame)\b/.test(t)) return { tratamento: 'plano', texto: 'Plano de saúde' }
  if (/\bparticular\b/.test(t)) return { tratamento: 'particular', texto: 'Particular' }
  if (perguntou && (ehNao(t) || /\b(nao faz|nenhum|nada)\b/.test(t))) return { tratamento: 'nenhum', texto: 'Sem acompanhamento' }
  if (perguntou && t.length > 2) return { tratamento: 'outro', texto: t }
  return undefined
}

function extrairCadUnico(t: string, perguntou: boolean): CadUnico | undefined {
  const fala = perguntou || /\b(cad ?unico|cadastro unico|cras)\b/.test(t)
  if (!fala) return undefined
  if (/\b(desatualiz\w*|vencid\w*|faz tempo|precisa atualizar|nao (esta|ta) atualizado|antigo)\b/.test(t)) return 'desatualizado'
  if (/\b(nao tem|nao temos|nao tenho|nunca fiz|nunca fizemos|o que e|que e isso|nao sei o que)\b/.test(t)) return 'nao'
  if (perguntou && ehNao(t)) return 'nao'
  if (/\b(atualizado|em dia|tenho|temos|tem sim|fiz|fizemos)\b/.test(t) || (perguntou && ehSim(t))) return 'atualizado'
  return undefined
}

function valorEmReais(bruto: string): number {
  // "1.500" -> 1500 ; "1500,50" -> 1500.5 ; "1,5" (mil) tratado fora
  const limpo = bruto.replace(/\./g, '').replace(',', '.')
  return Number(limpo)
}

function extrairRenda(t: string, perguntou: boolean): number | undefined {
  if (/\b(sem renda|nenhuma renda|ninguem trabalha|renda zero|nao tem renda|nao temos renda|ganha nada|nao ganho nada|zero)\b/.test(t)) return 0
  const reais = t.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/)
  if (reais) return valorEmReais(reais[1])
  const mil = t.match(/\b(\d+(?:[.,]\d+)?)\s*mil\b/)
  if (mil) return Number(mil[1].replace(',', '.')) * 1000
  const escrito = t.match(/\b([\d.]+(?:,\d{1,2})?)\s*(reais|conto|pila)\b/)
  if (escrito) return valorEmReais(escrito[1])
  if (/\b(meio salario)\b/.test(t)) return SALARIO_MINIMO / 2
  const salarios = t.match(new RegExp(`\\b${NUM}\\s*salario`))
  if (salarios) return numero(salarios[1]) * SALARIO_MINIMO
  if (/\bum salario\b|\bsalario minimo\b/.test(t)) return SALARIO_MINIMO
  if (perguntou) {
    const grandes = [...t.matchAll(/\b(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,\d{1,2})?\b/g)].map((m) => valorEmReais(m[1]))
    const valor = grandes.find((v) => v >= 100)
    if (valor !== undefined) return valor
  }
  return undefined
}

function extrairPessoas(t: string, perguntou: boolean): number | undefined {
  const padroes = [
    new RegExp(`\\b${NUM}\\s*(?:pessoas|moradores|na casa|em casa|ao todo|no total)\\b`),
    new RegExp(`\\bsomos\\s*${NUM}\\b`),
    new RegExp(`\\bmoram\\s*${NUM}\\b`),
    new RegExp(`\\bmora(?:mos)?\\s*(?:em|so)?\\s*${NUM}\\b`),
  ]
  for (const p of padroes) {
    const m = t.match(p)
    if (m) {
      const n = numero(m[1])
      if (!Number.isNaN(n) && n > 0 && n <= 20) return n
    }
  }
  if (/\b(moro sozinh|so eu|eu sozinh)/.test(t)) return 1
  if (/\b(eu e (ele|ela)|so nos dois|nos dois)\b/.test(t)) return 2
  if (perguntou) {
    const pequeno = t.match(/(?:^|\s)(\d{1,2})(?:\s|,|$)(?!\s*(mil|reais))/)
    if (pequeno) {
      const n = Number(pequeno[1])
      if (n > 0 && n <= 20) return n
    }
  }
  return undefined
}

function extrairOutrosBeneficios(t: string, perguntou: boolean): { v: 'sim' | 'nao'; texto?: string } | undefined {
  const qual = t.match(/\b(aposentad\w*|pensao|auxilio[- ]doenca|auxilio|bpc|loas|bolsa familia)\b/)
  if (perguntou) {
    if (ehNao(t) || /\b(ninguem|nenhum)\b/.test(t)) return { v: 'nao' }
    if (qual || ehSim(t)) return { v: 'sim', texto: qual?.[1] }
    return undefined
  }
  if (/\b(recebe|ganha|tem) (aposentadoria|pensao)\b/.test(t)) return { v: 'sim', texto: qual?.[1] }
  return undefined
}

function extrairPedidoAnterior(t: string, perguntou: boolean): Ficha['pedidoAnterior'] | undefined {
  if (/\b(negad\w*|indeferid\w*|negaram|nao aprovaram|recusaram|nao passou)\b/.test(t)) return 'negado'
  if (/\b(em analise|esperando resposta|aguardando o inss|ainda nao saiu|ta em analise|esta em analise)\b/.test(t)) return 'em_analise'
  if (perguntou && (ehNao(t) || /\b(nunca pedi|nunca pedimos|primeira vez)\b/.test(t))) return 'nao'
  if (/\b(nunca pedi|nunca pedimos|nunca demos entrada)\b/.test(t)) return 'nao'
  return undefined
}

/** Le tudo o que der da mensagem. A pergunta feita deixa a leitura mais solta. */
export function lerMensagem(original: string, ficha: Ficha, pergunta: Pergunta | null): Ficha {
  const t = normalizar(original)
  const nova: Ficha = { ...ficha }
  const perguntou = (...p: Pergunta[]) => pergunta !== null && p.includes(pergunta)

  if (!nova.nome) {
    const nome = extrairNome(original, perguntou('abertura_quem', 'nome_idade', 'nome'))
    if (nome) nova.nome = nome
  }
  if (!nova.para) {
    const para = extrairParaQuem(t)
    if (para) Object.assign(nova, para)
  }
  if (nova.idade === undefined) {
    const idade = extrairIdade(t, perguntou('nome_idade', 'idade'))
    if (idade !== undefined) nova.idade = idade
  }
  if (nova.para === undefined && nova.idade !== undefined && nova.idade >= 65 && /\b(tenho|eu tenho)\b/.test(t)) nova.para = 'proprio'
  if (!nova.diagnostico) {
    const d = extrairDiagnostico(t)
    if (d) nova.diagnostico = d
    else if (perguntou('diagnostico') && t.length > 2 && !ehNao(t)) nova.diagnostico = original.trim().slice(0, 140)
  }
  if (!nova.origem && /advogad[oa] previdenciari|vim pelo site|pelo site/.test(t)) nova.origem = 'site'
  if (!nova.laudo) {
    const l = extrairLaudo(t, perguntou('laudo', 'laudo_para_preco'))
    if (l) nova.laudo = l
  }
  if (!nova.rotina && perguntou('rotina') && t.length > 1) nova.rotina = original.trim().slice(0, 240)
  if (!nova.tratamento) {
    const tr = extrairTratamento(t, perguntou('tratamento'))
    if (tr && (perguntou('tratamento') || tr.tratamento !== 'outro')) {
      // "faz terapia no CAPS" respondendo a rotina tambem conta.
      if (perguntou('tratamento') || /\b(sus|caps|ubs|apae|plano|convenio|particular)\b/.test(t)) {
        nova.tratamento = tr.tratamento
        nova.tratamentoTexto = tr.texto
      }
    }
  }
  if (!nova.cadunico) {
    const c = extrairCadUnico(t, perguntou('cadunico'))
    if (c) nova.cadunico = c
  }
  const falaDeCasa = perguntou('casa_renda', 'pessoas', 'renda') || /\b(moram|pessoas|renda|ganh|salario|reais|r\$)/.test(t)
  if (falaDeCasa) {
    if (nova.pessoasCasa === undefined) {
      const p = extrairPessoas(t, perguntou('casa_renda', 'pessoas'))
      if (p !== undefined) nova.pessoasCasa = p
    }
    if (nova.rendaCasa === undefined) {
      const r = extrairRenda(t, perguntou('casa_renda', 'renda'))
      if (r !== undefined) nova.rendaCasa = r
    }
  }
  if (!nova.outrosBeneficios) {
    const o = extrairOutrosBeneficios(t, perguntou('outros_beneficios'))
    if (o) {
      nova.outrosBeneficios = o.v
      if (o.texto) nova.outrosBeneficiosTexto = o.texto
    }
  }
  if (!nova.pedidoAnterior) {
    const p = extrairPedidoAnterior(t, perguntou('pedido_anterior'))
    if (p) nova.pedidoAnterior = p
  }
  if (!nova.tempoNegado && perguntou('tempo_negado') && t.length > 0) nova.tempoNegado = original.trim().slice(0, 80)
  if (!nova.cidade && perguntou('cidade') && t.length > 1) nova.cidade = original.trim().slice(0, 60)
  return nova
}

// ---------------------------------------------------------------------------
// Contas sobre a ficha
// ---------------------------------------------------------------------------

export function ehIdoso(f: Ficha): boolean {
  return f.idade !== undefined && f.idade >= 65 && f.para !== 'filho' && f.para !== 'filha'
}

export function rendaPorPessoa(f: Ficha): number | undefined {
  if (f.rendaCasa === undefined || !f.pessoasCasa) return undefined
  return f.rendaCasa / f.pessoasCasa
}

/**
 * "Respostas boas" do roteiro: deficiencia ou 65+, renda baixa, laudo ou
 * disposicao para a fase medica. Renda baixa aqui e ate meio salario por
 * pessoa: a regra e 1/4, mas ha excecoes que so o advogado avalia, e o robo
 * nunca da veredito. Isto escolhe o TOM do fechamento, nao quem e atendido.
 */
export function respostasBoas(f: Ficha): boolean {
  const perfil = ehIdoso(f) || Boolean(f.diagnostico)
  const rpp = rendaPorPessoa(f)
  const rendaBaixa = rpp === undefined || rpp <= SALARIO_MINIMO / 2
  const laudoOk = ehIdoso(f) || f.laudo === 'recente' || f.faseMedica === 'aceitou'
  return perfil && rendaBaixa && laudoOk
}

/** Versao do contrato: com valor fixo de R$ 1.000 so quando NAO tem laudo proprio recente. */
export function contratoComParteFixa(f: Ficha): boolean {
  if (ehIdoso(f)) return false
  return f.laudo !== 'recente'
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

function sobre(f: Ficha) {
  if (f.para === 'proprio') return { quem: 'você', ele: 'você', dele: 'seu', Ele: 'Você', tem: 'você tem' }
  if (f.para === 'filha') return { quem: 'sua filha', ele: 'ela', dele: 'dela', Ele: 'Ela', tem: 'tem sua filha' }
  if (f.para === 'familiar') {
    const ele = f.pronome ?? 'ela'
    return { quem: f.quem ?? 'a pessoa', ele, dele: ele === 'ele' ? 'dele' : 'dela', Ele: capitalizar(ele), tem: `tem ${f.quem ?? 'a pessoa'}` }
  }
  return { quem: 'seu filho', ele: 'ele', dele: 'dele', Ele: 'Ele', tem: 'tem seu filho' }
}

function textoDaPergunta(p: Pergunta, f: Ficha): string {
  const s = sobre(f)
  switch (p) {
    case 'abertura_quem':
      return f.nome
        ? 'O benefício seria para você, para seu filho(a) ou para outra pessoa da família?'
        : 'Me conta seu nome e o que está acontecendo: é benefício do INSS para você ou para alguém da família?'
    case 'nome_idade':
      return f.para === 'proprio' ? 'Me conta seu nome e quantos anos você tem?' : `Me conta seu nome e quantos anos ${s.tem}?`
    case 'nome':
      return 'E qual o seu nome?'
    case 'idade':
      return f.para === 'proprio' ? 'Quantos anos você tem?' : `Quantos anos ${s.tem}?`
    case 'diagnostico':
      return f.para === 'proprio' ? 'E qual é o diagnóstico, e desde quando?' : `E qual é o diagnóstico ${s.dele}, e desde quando?`
    case 'laudo':
      return `${s.Ele} tem laudo do médico com o diagnóstico, feito no último ano?`
    case 'laudo_para_preco':
      return `${s.Ele} já tem laudo do médico?`
    case 'fase_medica':
      return `Entendo${f.nome ? ', ' + primeiroNome(f.nome) : ''}. Pelo SUS o laudo demora mesmo. O escritório tem um médico parceiro que atende por videochamada e, se for o caso, faz o laudo com o detalhe que o INSS pede. Quer saber como funciona?`
    case 'fase_medica_recusou':
      return 'Tudo bem. Enquanto isso, tente a consulta pelo SUS ou pelo plano. Posso te chamar daqui a uma semana para ver se conseguiu?'
    case 'rotina':
      return f.para === 'proprio'
        ? 'Como é a sua rotina: precisa de ajuda nas coisas do dia, faz terapia ou toma remédio?'
        : `Como é a rotina ${s.dele}: precisa de ajuda nas coisas do dia, faz terapia ou toma remédio?`
    case 'tratamento':
      return 'O acompanhamento é pelo SUS ou por plano/particular?'
    case 'cadunico':
      return 'A família tem o CadÚnico (o cadastro do CRAS) atualizado?'
    case 'cadunico_combinado':
      return 'Sem problema. É feito no CRAS da sua cidade, de graça, com RG, CPF e comprovante de endereço. Dá para fazer essa semana?'
    case 'casa_renda':
      return 'Quantas pessoas moram na casa e qual a renda de todo mundo por mês, mais ou menos?'
    case 'pessoas':
      return 'E quantas pessoas moram na casa, contando você?'
    case 'renda':
      return 'E a renda de todo mundo junto, por mês, mais ou menos?'
    case 'outros_beneficios':
      return 'Alguém da casa já recebe aposentadoria, pensão ou outro benefício do INSS?'
    case 'pedido_anterior':
      return 'Vocês já pediram o BPC no INSS alguma vez?'
    case 'tempo_negado':
      return 'Acontece muito e não encerra o assunto. O advogado vê se cabe recurso ou ação. Faz quanto tempo que negaram?'
    case 'cidade':
      return 'Atende sim. O atendimento é online e o pedido no INSS vale para todo o Brasil. Em qual cidade você mora?'
    default:
      return ''
  }
}

/** Ordem do roteiro, pulando o que ja foi respondido. null = hora de encaminhar. */
export function proximaPergunta(f: Ficha): Pergunta | null {
  if (!f.para) return 'abertura_quem'
  if (!f.nome && f.idade === undefined) return 'nome_idade'
  if (!f.nome) return 'nome'
  if (f.idade === undefined) return 'idade'
  if (!ehIdoso(f)) {
    if (!f.diagnostico) return 'diagnostico'
    if (!f.laudo) return 'laudo'
    if ((f.laudo === 'sem' || f.laudo === 'antigo') && !f.faseMedica) return 'fase_medica'
    if (!f.rotina) return 'rotina'
    if (!f.tratamento) return 'tratamento'
  }
  if (!f.cadunico) return 'cadunico'
  if (f.pessoasCasa === undefined && f.rendaCasa === undefined) return 'casa_renda'
  if (f.pessoasCasa === undefined) return 'pessoas'
  if (f.rendaCasa === undefined) return 'renda'
  if (!f.outrosBeneficios) return 'outros_beneficios'
  if (!f.pedidoAnterior) return 'pedido_anterior'
  if (f.pedidoAnterior === 'negado' && !f.tempoNegado) return 'tempo_negado'
  return null
}

// ---------------------------------------------------------------------------
// Horario comercial e opcoes de horario
// ---------------------------------------------------------------------------

/** Brasil sem horario de verao desde 2019: UTC-3 fixo serve na Edge Function. */
function relogioDeSantos(agora: Date) {
  const local = new Date(agora.getTime() - 3 * 3600 * 1000)
  return { hora: local.getUTCHours(), dia: local.getUTCDay() }
}

export function emHorarioComercial(agora: Date): boolean {
  const { hora, dia } = relogioDeSantos(agora)
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18
}

/** "amanha" so quando amanha e dia util; sexta a noite e fim de semana viram "segunda". */
function proximoDiaUtil(agora: Date): string {
  const { dia } = relogioDeSantos(agora)
  return dia === 5 || dia === 6 ? 'segunda' : 'amanhã'
}

export function opcoesDeHorario(agora: Date): { texto: string; opcoes: [string, string] } {
  const { hora } = relogioDeSantos(agora)
  const proximo = proximoDiaUtil(agora)
  if (emHorarioComercial(agora) && hora < 16) {
    return { texto: `hoje à tarde ou ${proximo} de manhã`, opcoes: ['hoje à tarde', `${proximo} de manhã`] }
  }
  return { texto: `${proximo} de manhã, 9h ou 10h`, opcoes: [`${proximo} às 9h`, `${proximo} às 10h`] }
}

function lerHorario(t: string, agora: Date): string {
  const { opcoes } = opcoesDeHorario(agora)
  const hora = t.match(/\b(\d{1,2})(?:h|:(\d{2})| horas)/)
  const base = /\bhoje\b/.test(t) ? 'hoje' : /\b(amanha|segunda)\b/.test(t) ? opcoes[1].split(' ')[0] : ''
  if (hora) {
    const h = `${Number(hora[1])}h${hora[2] && hora[2] !== '00' ? hora[2] : ''}`
    return base ? `${base} às ${h}` : `às ${h}`
  }
  if (/\b(10|dez)\b/.test(t) && opcoes[1].includes('10h')) return opcoes[1]
  if (/\b(9|nove)\b/.test(t) && opcoes[0].includes('9h')) return opcoes[0]
  if (/\b(tarde)\b/.test(t) && /\bhoje\b/.test(t)) return 'hoje à tarde'
  if (/\bmanha\b/.test(t)) return opcoes[1].includes('manhã') ? opcoes[1] : opcoes[0]
  if (/\btarde\b/.test(t)) return opcoes[0].includes('tarde') ? opcoes[0] : `${proximoDiaUtil(agora)} à tarde`
  if (/\bhoje\b/.test(t)) return opcoes[0]
  if (/\b(amanha|segunda)\b/.test(t)) return opcoes[1]
  return opcoes[0]
}

// ---------------------------------------------------------------------------
// Desvios: preco, "e golpe?", "e robo?", pedir pessoa...
// ---------------------------------------------------------------------------

const HONORARIOS_COM_LAUDO = 'São 3 salários mínimos e 30% dos atrasados. Você só paga no final, quando o benefício sair. Posso pedir para a equipe te chamar e explicar os detalhes?'
const HONORARIOS_SEM_LAUDO = 'São R$ 1.000 fixos, mais 3 salários mínimos e 30% dos atrasados. Você só paga no final, quando o benefício sair. Posso pedir para a equipe te chamar e explicar os detalhes?'

type Desvio =
  | { tipo: 'responde_e_volta'; texto: string; proxima?: Pergunta }
  | { tipo: 'encaminha'; texto: string; motivo: string }
  | { tipo: 'pendencia'; texto: string; pendencia: string; dias: number; proxima: Pergunta }
  | { tipo: 'pergunta_laudo_para_preco' }

function desvio(t: string, f: Ficha, agora: Date): Desvio | null {
  const { texto: horarios } = opcoesDeHorario(agora)
  if (/^\[(audio|arquivo) recebido\]/.test(t)) return { tipo: 'responde_e_volta', texto: 'Recebi, mas não consegui abrir. Me conta por escrito?' }
  if (/\b(e|eh|vc e|voce e|isso e|to falando com|estou falando com)\s*(um |uma )?(robo|bot|maquina|ia)\b|\brobo\?|inteligencia artificial/.test(t))
    return { tipo: 'responde_e_volta', texto: 'Aqui é o atendimento automático da equipe CB&AA, e uma pessoa assume já já. Posso continuar?' }
  if (/\b(falar|conversar) com (uma pessoa|alguem|atendente|um humano|humano|o advogado|advogad|o doutor|doutor)|\bme liga\b|\bpode(m)? (me )?ligar\b|\bquero ligar\b|\bliga(r)? pra mim\b/.test(t))
    return { tipo: 'encaminha', texto: 'Combinado, já aviso a equipe agora.', motivo: 'Pediu para falar com uma pessoa' }
  if (/\b(1\.?000|mil reais)\b.*\b(de que|pra que|para que|por que|porque)\b|\bparte fixa\b/.test(t))
    return { tipo: 'encaminha', texto: `É a parte fixa do contrato; a equipe detalha tudo por escrito antes de assinar. ${capitalizar(horarios)} é melhor para te chamarem?`, motivo: 'Dúvida sobre o valor fixo' }
  if (/\bparcel|\bdividir\b|\bem vezes\b/.test(t))
    return { tipo: 'encaminha', texto: 'Dá sim: os 3 salários mínimos podem ser divididos em até 6 vezes, e só começam depois que o benefício sair. Posso pedir para a equipe te chamar?', motivo: 'Pediu parcelamento' }
  if (/\b(caro|carissimo|nao (tenho|consigo|vou conseguir) (como )?pagar|sem dinheiro|nao tenho dinheiro|muito dinheiro)\b/.test(t))
    return { tipo: 'encaminha', texto: 'Entendo. Isso a equipe combina com você, com calma. Manhã ou tarde é melhor para te chamarem?', motivo: 'Objeção de preço' }
  if (/\b(quanto (custa|cobra|cobram|e|fica|vou pagar|sai)|valor|preco|honorario|cobram|tem custo|e pago|e gratis|gratuito|de graca|quanto voces)\b/.test(t)) {
    if (ehIdoso(f) || f.laudo === 'recente') return { tipo: 'encaminha', texto: HONORARIOS_COM_LAUDO, motivo: 'Perguntou preço' }
    if (f.laudo === 'sem' || f.laudo === 'antigo') return { tipo: 'encaminha', texto: HONORARIOS_SEM_LAUDO, motivo: 'Perguntou preço' }
    return { tipo: 'pergunta_laudo_para_preco' }
  }
  if (/\b(golpe|confiavel|e verdade|e serio|fraude|sao de onde|voces sao de onde|sao quem|existe mesmo)\b/.test(t))
    return {
      tipo: 'responde_e_volta',
      texto: 'Somos o escritório Cunha, Batista & Advogados, OAB/SP 9.894, com sede em Santos/SP, e atendemos famílias em todo o Brasil. Pode conferir no site https://cunhabatistaadv.com/ e no Instagram @cunhabatistaadvogados. Quer que eu continue?',
    }
  if (/\b(outro estado|outra cidade|muito longe|fora de sao paulo|atende(m)? (em|no|na|fora|outros?|longe|online|pela internet))\b/.test(t))
    return { tipo: 'responde_e_volta', texto: textoDaPergunta('cidade', f), proxima: 'cidade' }
  if (/\b(falar|ver|conversar|decidir|combinar) com (o |a )?(meu|minha) (marido|esposa|esposo|mulher|companheir\w*)\b/.test(t))
    return {
      tipo: 'pendencia',
      texto: 'Claro, é uma decisão de vocês. Quer que eu mande um resumo do que falamos para verem juntos? Te chamo em 3 dias?',
      pendencia: 'decisão em família',
      dias: 3,
      proxima: 'resumo_familia',
    }
  if (/\b(meus dados|o que (voces )?fazem com|privacidade|lgpd|seguro passar)\b/.test(t))
    return { tipo: 'responde_e_volta', texto: 'Só a equipe do escritório vê, para analisar o seu caso. A política de privacidade está no nosso site. Posso continuar?' }
  if (/\bbolsa familia\b.*\b(pode|atrapalha|perde|corta|tira)\b|\b(pode|posso|atrapalha)\b.*\bbolsa familia\b/.test(t))
    return { tipo: 'responde_e_volta', texto: 'Isso o advogado confere no seu caso. Me diz quantas pessoas moram na casa?', proxima: 'pessoas' }
  return null
}

export function resumoDaFicha(f: Ficha): string {
  const s = sobre(f)
  const linhas: string[] = []
  if (f.para) linhas.push(`Para: ${f.para === 'proprio' ? 'o(a) próprio(a)' : s.quem}${f.idade !== undefined ? `, ${f.idade} anos` : ''}`)
  if (f.diagnostico) linhas.push(`Diagnóstico: ${f.diagnostico}`)
  if (f.laudo) linhas.push(`Laudo: ${f.laudo === 'recente' ? 'recente' : f.laudo === 'antigo' ? 'antigo' : 'ainda não tem'}`)
  if (f.cadunico) linhas.push(`CadÚnico: ${f.cadunico === 'atualizado' ? 'atualizado' : f.cadunico === 'desatualizado' ? 'precisa atualizar' : 'fazer no CRAS'}`)
  if (f.pessoasCasa !== undefined) linhas.push(`Moram na casa: ${f.pessoasCasa}`)
  if (f.rendaCasa !== undefined) linhas.push(`Renda da casa: ${dinheiro(f.rendaCasa)}`)
  return linhas.join('\n')
}

// ---------------------------------------------------------------------------
// O turno
// ---------------------------------------------------------------------------

function reconhecimento(antes: Ficha, depois: Ficha, respondida: Pergunta | null): string {
  if (!antes.nome && depois.nome) return `Prazer, ${primeiroNome(depois.nome)}.`
  if (respondida === 'cadunico' && depois.cadunico === 'atualizado') return 'Ótimo.'
  if (respondida === 'rotina' || respondida === 'diagnostico') return 'Entendo.'
  if (respondida === 'cadunico_combinado' || respondida === 'fase_medica_recusou' || respondida === 'cidade') return 'Combinado.'
  return ''
}

function juntar(...partes: string[]): string {
  return partes.filter(Boolean).join(' ')
}

/**
 * Um turno: a mensagem do cliente entra, as respostas do robo saem, junto
 * com os sinais para o sistema (etapa, pendencia, encaminhar). Nunca lanca:
 * mensagem que o motor nao entende vira "nao entendi" e, na segunda vez,
 * encaminhamento - conversa nunca fica sem dono.
 */
export function responder(estadoAnterior: EstadoRobo, mensagem: string, agora: Date = new Date()): Resultado {
  const estado: EstadoRobo = { ...estadoAnterior, ficha: { ...estadoAnterior.ficha } }
  const sinais: Sinal[] = []
  const respostas: string[] = []
  const t = normalizar(mensagem)
  const primeira = estado.mensagensDoCliente === 0
  estado.mensagensDoCliente += 1

  if (estado.pausado) return { respostas, estado, sinais }
  if (primeira) sinais.push({ tipo: 'etapa', etapa: 'qualificacao' })

  const encaminhar = (texto: string, motivo: string, etapa: Etapa = 'qualificado') => {
    respostas.push(texto)
    sinais.push({ tipo: 'encaminhar', motivo })
    if (!estado.encaminhado) sinais.push({ tipo: 'etapa', etapa })
    estado.encaminhado = true
    estado.pausado = true
    estado.motivoPausa = motivo
    estado.ultimaPergunta = null
    return { respostas, estado, sinais }
  }

  // Fase de fechamento: o cliente escolheu o horario.
  if (estado.ultimaPergunta === 'horario') {
    const quando = lerHorario(t, agora)
    estado.ficha.horario = quando
    sinais.push({ tipo: 'reuniao', quando })
    sinais.push({ tipo: 'etapa', etapa: 'reuniao' })
    estado.ultimaPergunta = 'contrato_ok'
    respostas.push(
      `Combinado, ${quando}. Para não perder tempo, a equipe já te manda o contrato e a lista de documentos antes da conversa. Pode ser?`,
    )
    return { respostas, estado, sinais }
  }
  if (estado.ultimaPergunta === 'contrato_ok') {
    respostas.push(`Perfeito${estado.ficha.nome ? ', ' + primeiroNome(estado.ficha.nome) : ''}. A equipe já te chama por aqui com o contrato e a lista de documentos.`)
    sinais.push({ tipo: 'encaminhar', motivo: `Reunião ${estado.ficha.horario ?? ''}: enviar contrato e lista de documentos`.trim() })
    estado.pausado = true
    estado.motivoPausa = 'Reunião marcada: equipe envia contrato e documentos'
    estado.ultimaPergunta = null
    return { respostas, estado, sinais }
  }

  const antes = estado.ficha
  const perguntaFeita = estado.ultimaPergunta
  estado.ficha = lerMensagem(mensagem, estado.ficha, perguntaFeita)

  // Desvios primeiro: quem pergunta preco quer fechar. Mensagem de desvio nao
  // responde a pergunta feita: le de novo sem a pergunta, senao "quanto
  // custa?" virava a "rotina" da crianca.
  let d = desvio(t, estado.ficha, agora)
  if (d) {
    estado.ficha = lerMensagem(mensagem, antes, null)
    d = desvio(t, estado.ficha, agora) ?? d
  }
  const aprendeuAlgo = JSON.stringify(antes) !== JSON.stringify(estado.ficha)
  if (d) {
    estado.naoEntendeu = 0
    if (d.tipo === 'encaminha') return encaminhar(d.texto, d.motivo)
    if (d.tipo === 'pergunta_laudo_para_preco') {
      estado.voltarPara = estado.ultimaPergunta
      estado.ultimaPergunta = 'laudo_para_preco'
      respostas.push(textoDaPergunta('laudo_para_preco', estado.ficha))
      return { respostas, estado, sinais }
    }
    if (d.tipo === 'pendencia') {
      sinais.push({ tipo: 'pendencia', texto: d.pendencia, dias: d.dias })
      estado.voltarPara = estado.ultimaPergunta
      estado.ultimaPergunta = d.proxima
      respostas.push(d.texto)
      return { respostas, estado, sinais }
    }
    // Pergunta feita ja na primeira mensagem ("atendem em Minas?") tambem e
    // respondida: ignorar e seguir o roteiro fazia a resposta seguinte
    // ("Belo Horizonte") ser lida como nome. Caso real do teste de 19/10/2026.
    if (d.proxima) {
      estado.voltarPara = estado.ultimaPergunta
      estado.ultimaPergunta = d.proxima
    } else if (estado.ultimaPergunta !== 'retomar') {
      estado.voltarPara = estado.ultimaPergunta
      estado.ultimaPergunta = 'retomar'
    }
    respostas.push(primeira ? `Oi! Que bom que você chamou. ${d.texto}` : d.texto)
    return { respostas, estado, sinais }
  }

  // Preco pedido antes de sabermos do laudo: agora responde.
  if (perguntaFeita === 'laudo_para_preco') {
    if (estado.ficha.laudo === 'recente') return encaminhar(HONORARIOS_COM_LAUDO, 'Perguntou preço')
    if (estado.ficha.laudo) return encaminhar(HONORARIOS_SEM_LAUDO, 'Perguntou preço')
  }

  // Respostas que so confirmam e seguem.
  if (perguntaFeita === 'fase_medica') {
    if (ehSim(t) || /\b(como funciona|quero saber|me explica|explica)\b/.test(t)) {
      estado.ficha.faseMedica = 'aceitou'
      sinais.push({ tipo: 'pendencia', texto: 'documentos básicos para a fase médica', dias: 1 })
      const { texto: horarios } = opcoesDeHorario(agora)
      estado.encaminhado = true
      sinais.push({ tipo: 'encaminhar', motivo: 'Aceitou a fase médica parceira' })
      sinais.push({ tipo: 'etapa', etapa: 'qualificado' })
      estado.ultimaPergunta = 'horario'
      respostas.push(
        `Funciona assim: o advogado confere seus documentos básicos (RG, CPF, comprovante de endereço e CadÚnico), o contrato é assinado e aí a equipe agenda a consulta. Seu caso se qualifica para o atendimento com o nosso especialista. ${capitalizar(horarios)} é melhor para te chamarem?`,
      )
      return { respostas, estado, sinais }
    }
    if (ehNao(t)) {
      estado.ficha.faseMedica = 'recusou'
      sinais.push({ tipo: 'pendencia', texto: 'laudo médico', dias: 7 })
      estado.ultimaPergunta = 'fase_medica_recusou'
      respostas.push(textoDaPergunta('fase_medica_recusou', estado.ficha))
      return { respostas, estado, sinais }
    }
  }
  if (perguntaFeita === 'resumo_familia') {
    estado.ultimaPergunta = estado.voltarPara
    estado.voltarPara = null
    if (ehSim(t)) {
      respostas.push(`Segue o resumo para verem juntos:\n${resumoDaFicha(estado.ficha)}`)
      respostas.push('Combinado, te chamo em 3 dias. Se decidirem antes, é só me chamar aqui.')
      // Espera a familia, nao a equipe: nao entra na fila de "esperando equipe".
      estado.encaminhado = false
      estado.pausado = true
      estado.motivoPausa = 'Decisão em família: retorno em 3 dias'
      return { respostas, estado, sinais }
    }
    respostas.push('Tudo bem. Te chamo em 3 dias, combinado?')
    estado.pausado = true
    estado.motivoPausa = 'Decisão em família: retorno em 3 dias'
    return { respostas, estado, sinais }
  }

  // CadUnico que falta: orienta, marca pendencia e segue as perguntas.
  if (estado.ficha.cadunico && estado.ficha.cadunico !== 'atualizado' && !antes.cadunico) {
    sinais.push({ tipo: 'pendencia', texto: estado.ficha.cadunico === 'nao' ? 'inscrição no CadÚnico' : 'atualizar o CadÚnico', dias: 7 })
    estado.ultimaPergunta = 'cadunico_combinado'
    respostas.push(
      estado.ficha.cadunico === 'nao'
        ? textoDaPergunta('cadunico_combinado', estado.ficha)
        : 'Sem problema. A atualização é feita no CRAS da sua cidade, de graça, com RG, CPF e comprovante de endereço. Dá para fazer essa semana?',
    )
    return { respostas, estado, sinais }
  }

  // Nada aproveitavel numa resposta que precisava de conteudo.
  const respondeuSoConfirmando = ['retomar', 'cadunico_combinado', 'fase_medica_recusou', 'cidade', 'laudo_para_preco'].includes(perguntaFeita ?? '')
  if (!primeira && !aprendeuAlgo && !respondeuSoConfirmando) {
    estado.naoEntendeu += 1
    if (estado.naoEntendeu >= 2) {
      return encaminhar('Vou pedir para alguém da equipe te chamar aqui, tá bem?', 'O robô não entendeu duas vezes', 'qualificacao')
    }
    respostas.push('Desculpa, não entendi direito. Pode me explicar com outras palavras?')
    return { respostas, estado, sinais }
  }
  estado.naoEntendeu = 0

  const proxima = proximaPergunta(estado.ficha)
  const ack = primeira ? 'Oi! Que bom que você chamou.' : reconhecimento(antes, estado.ficha, perguntaFeita)

  if (proxima === null) {
    // Qualificacao completa: fecha com dois horarios.
    const nome = primeiroNome(estado.ficha.nome)
    const { texto: horarios } = opcoesDeHorario(agora)
    const fora = emHorarioComercial(agora) ? '' : ' A equipe confirma logo cedo.'
    const texto = respostasBoas(estado.ficha)
      ? `${nome}, pelo que você me contou, seu caso se qualifica sim para o atendimento com o nosso especialista em BPC, o Dr. André. Vamos marcar: ${horarios} é melhor para você?${fora}`
      : `${nome}, vou passar seu caso para o advogado olhar com cuidado, porque cada detalhe conta. ${capitalizar(horarios)} é melhor para te chamarem?${fora}`
    sinais.push({ tipo: 'encaminhar', motivo: respostasBoas(estado.ficha) ? 'Qualificação completa' : 'Qualificação completa: advogado avalia' })
    sinais.push({ tipo: 'etapa', etapa: 'qualificado' })
    estado.encaminhado = true
    estado.ultimaPergunta = 'horario'
    respostas.push(texto)
    return { respostas, estado, sinais }
  }

  estado.ultimaPergunta = proxima
  estado.voltarPara = null
  respostas.push(juntar(ack, textoDaPergunta(proxima, estado.ficha)))
  return { respostas, estado, sinais }
}

/**
 * Retornos automaticos (regua). {NOME} e {PENDENCIA} como no CRM do Lucas.
 *
 * O de 23h sem resposta cai DENTRO da janela de 24h do WhatsApp: vai como
 * texto livre. O de pendencia cai fora (3 a 7 dias): so sai como modelo
 * aprovado pela Meta. O texto abaixo e o do modelo "retorno_pendencia"
 * (Utilidade, pt_BR) enviado em 19/10/2026. A primeira versao, "Passando para
 * saber como esta", a Meta avisou que rejeitaria como Utilidade e cobraria
 * como Marketing: por isso fala em "atualizacao do seu atendimento". Mudar
 * este texto exige mandar um modelo novo para aprovacao.
 */
export const FOLLOWUP_SEM_RESPOSTA = 'Oi, {NOME}! Vi que você chamou sobre o BPC/LOAS e a gente não terminou de conversar. Quer continuar daqui?'
export const MODELO_RETORNO_PENDENCIA = 'retorno_pendencia'
export const FOLLOWUP_PENDENCIA = 'Olá, {NOME}. Atualização do seu atendimento de BPC/LOAS com o escritório Cunha Batista: ainda está pendente {PENDENCIA}. Você conseguiu resolver ou precisa de ajuda da equipe?'

export function preencherFollowup(modelo: string, nome: string | undefined, pendencia = ''): string {
  return modelo.replace('{NOME}', primeiroNome(nome) || 'tudo bem').replace('{PENDENCIA}', pendencia)
}
