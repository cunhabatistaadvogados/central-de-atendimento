/**
 * Motor do atendimento BPC/LOAS da CB&AA no WhatsApp.
 *
 * Arquivo unico, sem import, para rodar igual nos tres lugares: na Edge
 * Function (Deno), no simulador da tela (Vite) e nos testes (Node). Mesmo
 * padrao do sistema do Dr. Marcello: o robo testado e o robo que roda.
 *
 * O roteiro e o do Lucas, pacote v3.2 de 21/10/2026 ("Resposta ao Raio-X":
 * CBAA_BPC_LOAS_CRM_Config_WhatsApp_v1.json, com a area BPC/LOAS Idoso), mais
 * os quatro ajustes do idoso que ele aprovou por mensagem no mesmo dia. O
 * v2.5 saiu de uso. Regras que vieram das 1.641 conversas e do Raio-X e nao
 * podem se perder em ajuste de texto:
 * - 42% sumiam depois da 1a resposta, que era um paragrafo com duas
 *   perguntas. Aqui: no maximo 2 linhas e UMA pergunta por mensagem.
 * - 88% das conversas morriam com mensagem nossa sem horario marcado.
 *   Aqui: qualificou, oferece DOIS horarios proximos, nunca "quando puder".
 * - Nunca dizer que a pessoa "tem direito" ou "vai ganhar": o contrato e de
 *   meio. "Se qualifica sim para o atendimento" so no fechamento limpo, sem
 *   impedimento (ja recebe beneficio; menos de 65 anos sem deficiencia).
 * - Pergunta da familia nunca vira dado da ficha: vira duvida para o advogado.
 * - Nunca pedir CPF, RG, foto de documento ou senha: isso e da equipe, depois.
 * - Honorarios so quando perguntam, e quem pergunta preco vai para a equipe.
 * - A Mary se apresenta como da CB&AA, sem dizer que e automatica (decisao do
 *   Lucas em 21/10/2026: "nao parecer IA"; o item 2.4 da Recomendacao CFOAB
 *   001/2024 pede esse aviso e o escritorio assumiu o risco). Se perguntarem
 *   se e robo, ela NUNCA nega; quem pede uma pessoa vai na hora para a equipe
 *   (item 4.3). Antes da 1a pergunta de saude, o aviso de privacidade (LGPD).
 */

export const VERSAO_DO_ROTEIRO = 'v3.2 (Lucas, 21/10/2026: resposta ao Raio-X, area do idoso e ajustes do idoso) + motor deterministico'

/** Salario minimo usado na conta da renda por pessoa. Conferir todo janeiro. */
export const SALARIO_MINIMO = 1621

/**
 * Pagina de agendamento do Google Agenda do Dr. Andre ("faz pelo rapido",
 * Lucas em 21/10/2026). Vazio: o robo oferece os dois horarios e a equipe
 * confirma, como antes. Com o link, depois que a pessoa escolhe o periodo o
 * robo manda a pagina para ela marcar o horario exato (o Google ja cria a
 * videochamada).
 */
export const LINK_AGENDA: string = ''

export type Etapa = 'novo' | 'qualificacao' | 'qualificado' | 'reuniao' | 'contrato' | 'contratado' | 'perdido'

export type ParaQuem = 'filho' | 'filha' | 'proprio' | 'familiar'
/** 'recente' e 'antigo' sao do roteiro v2.5 (fichas antigas no banco): os dois contam como "tem laudo" (D1 do Raio-X). */
export type Laudo = 'tem' | 'sem' | 'nao_sei' | 'recente' | 'antigo'
export type CadUnico = 'atualizado' | 'desatualizado' | 'nao'
export type Tratamento = 'SUS' | 'plano' | 'particular' | 'nenhum' | 'outro'
/** Por onde a familia chegou. 'anuncio' = anuncio sem saber a plataforma (o padrao antigo). */
export type Origem = 'meta' | 'google' | 'site' | 'anuncio'
/** Publico da campanha que a equipe quer separar (Lucas, 21/10/2026). */
export type Campanha = 'autista' | 'idoso'

export interface Ficha {
  nome?: string
  para?: ParaQuem
  /** "sua mae", "seu pai"... quando para = familiar */
  quem?: string
  /** pronome da pessoa do beneficio quando nao e o proprio cliente */
  pronome?: 'ele' | 'ela'
  idade?: number
  /** area do roteiro: a do idoso vem do gatilho da mensagem ("idoso", "65 anos") */
  area?: 'bpc' | 'idoso'
  diagnostico?: string
  /** "e pela idade", "nao tenho doenca": sem deficiencia (menos de 65 vai ao advogado, sem laudo nem medico) */
  semDeficiencia?: boolean
  laudo?: Laudo
  /** ano do laudo, como a familia contou: o robo nao decide se serve (D1) */
  laudoAno?: number
  /** 'explicada' = quis saber como funciona, sem dizer que quer */
  faseMedica?: 'aceitou' | 'recusou' | 'explicada'
  rotina?: string
  tratamento?: Tratamento
  tratamentoTexto?: string
  cadunico?: CadUnico
  pessoasCasa?: number
  /** quem mora na casa, como a familia contou: a lei so conta parte dos parentes, o advogado confere */
  casaTexto?: string
  rendaCasa?: number
  /** a renda como a familia contou (de quem e de que tipo) */
  rendaTexto?: string
  /** a propria pessoa do beneficio ja recebe beneficio do INSS (o BPC, em regra, nao acumula) */
  beneficioProprio?: 'sim' | 'nao'
  beneficioProprioTexto?: string
  /** alguem da casa recebe aposentadoria, pensao ou BPC */
  outrosBeneficios?: 'sim' | 'nao'
  outrosBeneficiosTexto?: string
  /** pensao ou aposentadoria contada sem dizer de quem: o robo pergunta "Quem recebe?" */
  beneficioCitado?: string
  /** idoso: CNH, CIN ou titulo com digital (Portaria DIRBEN/INSS 1.347/2026) */
  biometria?: 'sim' | 'nao'
  /** 'sim' = ja pediu, ainda sem saber se negaram */
  pedidoAnterior?: 'nao' | 'negado' | 'em_analise' | 'sim'
  tempoNegado?: string
  /** dias desde a negativa, quando deu para ler ("faz 10 dias", "semana passada") */
  diasNegado?: number
  cidade?: string
  horario?: string
  origem?: Origem
  campanha?: Campanha
  /** perguntas da familia que so o advogado responde (#DUVIDA) */
  duvidas?: string[]
  /** observacoes para a equipe: renda que a LOAS nao conta, "sem apoio da familia"... */
  anotacoes?: string[]
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
  /** do v2.5 (estados antigos no banco): casa e renda numa pergunta so */
  | 'casa_renda'
  | 'casa'
  | 'pessoas'
  | 'renda'
  | 'renda_simples'
  | 'beneficio_proprio'
  | 'quem_recebe'
  | 'outros_beneficios'
  | 'biometria'
  | 'pedido_anterior'
  | 'pedido_resultado'
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
  /** a frase de privacidade antes da 1a pergunta de saude ja foi dita */
  avisoSaude?: boolean
  /** como o robo fechou: 'cuidado' = com impedimento, o advogado olha antes de qualquer contrato */
  fechamento?: 'limpo' | 'fraco' | 'cuidado'
  /** pediu preco e parcelamento juntos antes de sabermos do laudo */
  parcelasPedidas?: boolean
  /** a equipe marcou a conversa como resolvida ate esta mensagem do cliente (ISO); so a tela usa */
  resolvidoAte?: string
  /** os dois horarios oferecidos (ISO), para ler a escolha na proxima mensagem */
  ofertas?: string[]
}

export type Sinal =
  | { tipo: 'encaminhar'; motivo: string }
  | { tipo: 'pendencia'; texto: string; dias: number }
  | { tipo: 'pendencia_resolvida'; texto: string }
  | { tipo: 'etapa'; etapa: Etapa }
  | { tipo: 'reuniao'; quando: string; /** ISO do horario exato oferecido (9h, 10h...), quando houver */ em?: string }
  | { tipo: 'duvida'; texto: string }
  | { tipo: 'encerrar'; motivo: string }
  | { tipo: 'origem'; origem?: Origem; campanha?: Campanha }

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

/**
 * Robo religado pela equipe. Zera o "nao entendi": senao a primeira mensagem
 * que ele nao entender depois de religado ja vai direto para a equipe (numero
 * do Lucas, 23/10/2026: contador ficou em 2 desde o dia 21).
 */
export function religar(estado: EstadoRobo): EstadoRobo {
  return { ...estado, pausado: false, motivoPausa: undefined, encaminhado: false, naoEntendeu: 0 }
}

/**
 * A familia ainda respondia a pergunta anterior: "Da para ir ao CRAS essa
 * semana?" "Nao" "Quem mora com ele?" "Somente na proxima" (Sabrina,
 * 23/10/2026). Quem percebe e o interprete, que ve as ultimas mensagens; o
 * robo anota para a equipe e repete a pergunta atual, sem contar "nao entendi".
 * Devolve null quando nao ha pergunta simples para repetir.
 */
export function anotarComplemento(estadoAnterior: EstadoRobo, complemento: string, agora: Date = new Date()): Resultado | null {
  const p = estadoAnterior.ultimaPergunta
  if (estadoAnterior.pausado || !p || p === 'retomar' || p === 'horario' || !complemento.trim()) return null
  const nota = `Completou a resposta anterior: ${complemento.trim().slice(0, 160)}`
  const anotacoes = estadoAnterior.ficha.anotacoes ?? []
  const ficha: Ficha = { ...estadoAnterior.ficha, anotacoes: anotacoes.includes(nota) ? anotacoes : [...anotacoes, nota] }
  const estado: EstadoRobo = { ...estadoAnterior, ficha, mensagensDoCliente: estadoAnterior.mensagensDoCliente + 1 }
  return { respostas: [`Entendi, anotado. ${textoDaPergunta(p, ficha, agora)}`], estado, sinais: [] }
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/**
 * Minusculo, sem acento e sem as abreviacoes do WhatsApp: o cliente escreve
 * "nao", "não", "naum", "n"; "vc", "q", "qro" (as familias simuladas de
 * 21/10/2026 mostraram "qro" virando o nome "Qro" e "quanto vcs cobra" sem
 * resposta).
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bvcs\b/g, 'voces')
    .replace(/\bvc\b/g, 'voce')
    .replace(/\bq\b/g, 'que')
    .replace(/\bpq\b/g, 'porque')
    .replace(/\b(tb|tbm)\b/g, 'tambem')
    .replace(/\bqro\b/g, 'quero')
    .replace(/\bmsm\b/g, 'mesmo')
    .replace(/\bcmg\b/g, 'comigo')
    .replace(/\bn\b/g, 'nao')
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18,
  dezenove: 19, vinte: 20,
}
const NUM_ALT = `\\d{1,3}|${Object.keys(NUMEROS).join('|')}`
const NUM = `(${NUM_ALT})`

function numero(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : NUMEROS[token] ?? NaN
}

function capitalizar(nome: string): string {
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase()
}

function maiuscula(frase: string): string {
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}

export function primeiroNome(nome?: string): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? ''
}

export function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const SIM = /^(sim|s|ss|isso|claro|quero|pode|pode ser|ok|okay|beleza|blz|tenho|tem|temos|aceito|bora|vamos|gostaria|com certeza|certo|uhum|aham|fechado|combinado|perfeito|otimo|show|isso mesmo|quero sim|sim sim)\b/
const NAO = /^(nao|n|nunca|ainda nao|agora nao|depois|nenhum|nenhuma|nem|negativo|naum)\b/

/** "nao sei", "n sei", "nao lembro": nao e "nao". */
const NAO_SEI = /\b(nao|n) (sei|lembro|tenho certeza)\b|\bsei la\b/

// "ja falei que pode", "ja disse que nao": a resposta vem depois da queixa.
const JA_FALEI = /^(ja (falei|disse|respondi)( que)?|como (eu )?(falei|disse))[,.]?\s*/

function ehSim(t: string): boolean {
  const r = t.replace(JA_FALEI, '')
  return SIM.test(r) && !/^(nao|n)\b/.test(r)
}
function ehNao(t: string): boolean {
  return NAO.test(t.replace(JA_FALEI, ''))
}

/**
 * A familia perguntou (e pergunta nunca vira dado): "?", "ne" no fim, "sera
 * que", "queria saber se", "da ou nao da", "quanto tempo eu tenho" (perguntas
 * sem "?" das familias simuladas de 21/10/2026).
 */
function ehPergunta(original: string, t: string): boolean {
  return (
    /\?/.test(original) ||
    /\b(ne|neh)\s*$/.test(t) ||
    /^(e verdade que)\b/.test(t) ||
    /\b(sera que|(queria|quero|gostaria de) saber se|(da|serve|pode|consegue|vale|tem) ou nao( da| serve| pode| tem)?|ou (tem|precisa) que|quanto tempo (eu )?(tenho|tem|demora|leva)|qual o prazo|tem prazo|pode ir no meu lugar|vai por mim|pra que (voce|voces)|por que (voce|voces) quer)\b/.test(t)
  )
}

// ---------------------------------------------------------------------------
// Leitura do que o cliente contou (vale para qualquer mensagem)
// ---------------------------------------------------------------------------

// "Sou de Santos", "sou cuidadora", "sou o pai" nao sao nomes (C23).
const NAO_E_NOME = new Set([
  'oi', 'ola', 'bom', 'boa', 'sim', 'nao', 'meu', 'minha', 'ele', 'ela', 'e', 'eu', 'tenho', 'tem', 'sou',
  'aqui', 'o', 'a', 'pra', 'para', 'gostaria', 'quero', 'obrigado', 'obrigada', 'dia', 'tarde', 'noite',
  'tudo', 'bem', 'filho', 'filha', 'mae', 'pai', 'avo', 'vo', 'tia', 'tio', 'responsavel', 'ok', 'certo',
  'gente', 'pessoal', 'dr', 'doutor', 'doutora', 'quanto', 'qual', 'como', 'preciso', 'estou', 'to',
  'moro', 'mora', 'somos', 'ja', 'so', 'mas', 'entao', 'que', 'isso', 'esse', 'essa', 'uma', 'um',
  'vou', 'vamos', 'pode', 'claro', 'beleza', 'blz', 'hoje', 'amanha', 'manha', 'meio', 'autista',
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'cuidador', 'cuidadora', 'cliente', 'aposentado',
  'aposentada', 'idoso', 'idosa', 'irma', 'irmao', 'esposa', 'esposo', 'marido', 'neto', 'neta', 'sobrinho',
  'sobrinha', 'tutor', 'tutora', 'mesmo', 'mesma', 'daqui', 'la', 'casado', 'casada', 'solteiro', 'solteira',
  'viuvo', 'viuva', 'desempregado', 'desempregada', 'nova', 'novo', 'paciente', 'deficiente', 'cadeirante',
  'sozinho', 'sozinha', 'abandonado', 'abandonada', 'doente', 'pela', 'pelo', 'por', 'com', 'sem', 'porque',
  'pq', 'q', 'vc', 'voce', 'voces', 'senhor', 'senhora', 'dona', 'seu', 'sua', 'ninguem', 'nada', 'nunca',
  'ainda', 'tambem', 'agora', 'faz', 'fiz', 'genitora', 'madrasta', 'padrasto', 'cuido', 'vi', 'queria',
  'ta', 'tava', 'estava', 'kkk', 'kkkk', 'rs', 'sobre', 'loas', 'bpc', 'beneficio', 'boa', 'querida', 'querido',
  'moca', 'vim', 'venho', 'olha', 'entendi', 'opa', 'eae', 'salve', 'alo', 'cade', 'fui', 'foi', 'tive',
  'esta', 'vai', 'nem', 'negaram', 'pedimos', 'pedi', 'atualizado', 'nenhum', 'nenhuma', 'pelo', 'gov',
])

function extrairNome(original: string, perguntouNome: boolean): string | undefined {
  const explicito = original.match(
    /(?:meu nome [eé]|me chamo|aqui [eé] (?:a |o )?|eu sou (?:a |o )?|sou (?:a |o )?)\s*(?:(?:dona|seu|sr\.?|sra\.?)\s+)?([A-Za-zÀ-ÿ]{2,})/i,
  )
  if (explicito && !NAO_E_NOME.has(normalizar(explicito[1]))) return capitalizar(explicito[1])
  if (!perguntouNome) return undefined
  // A 1a palavra so e nome quando a resposta tem cara de nome: "Ana, ele tem
  // 6", "Marcos", "Ana Souza", "Ana e ele tem 6". "Vi o anuncio", "queria
  // saber", "ta bom pode" viraram "Vi", "Queria" e "Ta" (21/10/2026).
  // Nome completo sozinho: "Rodrigo Guilherme Da Costa", "Maria da Silva"
  // (familia real de 22/10/2026). Ate 6 palavras, "da/de/do/dos/das" no meio,
  // e nenhuma palavra pode ser das que nao sao nome ("queria saber mais").
  const palavras = original.trim().replace(/[.!]+$/, '').split(/\s+/)
  const ligacao = /^(da|de|do|dos|das|e)$/i
  if (
    palavras.length >= 2 &&
    palavras.length <= 6 &&
    palavras.every((p) => /^[A-Za-zÀ-ÿ']{2,}$/.test(p)) &&
    !ligacao.test(palavras[0]) &&
    !ligacao.test(palavras[palavras.length - 1]) &&
    palavras.filter((p) => !ligacao.test(p)).every((p) => !NAO_E_NOME.has(normalizar(p)))
  )
    return palavras.map((p) => (ligacao.test(p) ? p.toLowerCase() : capitalizar(p))).join(' ')
  const curta = original.trim().match(/^([A-Za-zÀ-ÿ]{2,})(?:\s+[A-Za-zÀ-ÿ]{2,})?\s*$/)
  const primeiro = curta ?? original.trim().match(/^(?:(?:dona|seu|sr\.?|sra\.?)\s+)?([A-Za-zÀ-ÿ]{2,})(?=\s*[,.;!:]|\s+e\s+(?:ele|ela|eu|tenho|minha|meu|o|a)\b)/i)
  if (primeiro && !NAO_E_NOME.has(normalizar(primeiro[1]))) return capitalizar(primeiro[1])
  return undefined
}

// "Boa tarde, minha filha" e "e ele, minha filha" chamam a atendente, nao
// falam da beneficiaria (Dona Lucia, familia F07 de 21/10/2026).
function semVocativo(t: string): string {
  return t.replace(/(?<!\b(?:pra|pro|para|pras|pros|da|de|do|na|no|com|e|a|o|ao|que|so|minha|meu|sua|seu|nossa|nosso)\s)\b(minha filha|querida|querido|moca|meu bem)(?=\s*[?!,.]|\s*$)/g, ' ')
}

const FAMILIA_ELA: Record<string, string> = {
  mae: 'sua mãe', avo: 'sua avó', irma: 'sua irmã', tia: 'sua tia', esposa: 'sua esposa', sogra: 'sua sogra',
}
const FAMILIA_ELE: Record<string, string> = {
  pai: 'seu pai', vo: 'seu avô', irmao: 'seu irmão', tio: 'seu tio', marido: 'seu marido', esposo: 'seu esposo',
  sogro: 'seu sogro', neto: 'seu neto', sobrinho: 'seu sobrinho', enteado: 'seu enteado',
}

function extrairParaQuem(texto: string): Pick<Ficha, 'para' | 'quem' | 'pronome'> | undefined {
  const t = semVocativo(texto)
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

// "faz 8 meses", "desde os 2 anos", "laudo de 2 anos atras": tempo, nunca idade (C24).
const TEMPO_ANTES = /\b(faz|fazem|ha|a|desde|desde os|desde as|durante|por|mais de|menos de|cerca de|uns|umas|quase|ja faz)\s*$/
const TEMPO_DEPOIS = /^\s*(atras|que|q|pra ca|de (tratamento|espera|fila))\b/
const SUJEITO =
  '(ele|ela|meu filho|minha filha|o menino|a menina|minha mae|meu pai|minha avo|meu avo|minha vo|meu vo|meu marido|minha esposa|meu esposo|meu irmao|minha irma|meu neto|minha neta|meu sobrinho|minha sobrinha|minha sogra|meu sogro|a crianca|o bebe)'

function extrairIdade(t: string, perguntouIdade: boolean, para?: ParaQuem): number | undefined {
  // "tenho 30 anos e meu filho tem 5": a idade e da pessoa do beneficio.
  const doSujeito = t.match(
    new RegExp(`\\b${SUJEITO}\\s+(?:ja |hoje |agora )?(?:tem|vai fazer|fez|completou|completa|esta com|ta com|e de)\\s+(?<n>${NUM_ALT})(?<u>\\s*(?:anos?|aninhos?|mes(?:es)?))?\\b(?!\\s*(?:pessoas|mil|reais|filhos|irmaos|salario|%|dias|semanas))`),
  )
  if (doSujeito?.groups) {
    if (/mes/.test(doSujeito.groups.u ?? '')) return 0
    const n = numero(doSujeito.groups.n)
    if (!Number.isNaN(n) && n < 120) return n
  }
  const candidatos: { n: number; deQuemEscreve: boolean }[] = []
  for (const m of t.matchAll(new RegExp(`\\b(?<n>${NUM_ALT})\\s*(?<u>anos?|aninhos?|mes(?:es)?)\\b`, 'g'))) {
    const antes = t.slice(0, m.index)
    const depois = t.slice((m.index ?? 0) + m[0].length)
    if (TEMPO_ANTES.test(antes) || TEMPO_DEPOIS.test(depois)) continue
    const n = /^mes/.test(m.groups!.u) ? 0 : numero(m.groups!.n)
    if (Number.isNaN(n) || n >= 120) continue
    candidatos.push({ n, deQuemEscreve: /\b(eu )?tenho\s*$/.test(antes) })
  }
  const outraPessoa = para !== undefined && para !== 'proprio'
  const validos = outraPessoa ? candidatos.filter((c) => !c.deQuemEscreve) : candidatos
  if (validos.length) return validos[0].n
  if (/\b(bebe|recem nascid)/.test(t) && outraPessoa) return 0
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

// "Suspeita", "a creche acha", "na fila do neuro": sem diagnostico fechado e sem laudo (C17).
const INVESTIGACAO =
  /\b(suspeit\w*|investiga\w*|em avaliacao|(creche|escola|professora) (acha|disse|falou|desconfia)|na fila (do|da|pro|pra|de) \w+|aguardando (consulta|avaliacao|diagnostico|o neuro)|ainda nao (tem|fechou|fecharam|temos) (o )?diagnostico|sem diagnostico|nao tem diagnostico|(acho|acha|achamos|a gente acha) que (ele |ela )?(e|tem|seja)|desconfi\w*)\b/
// "E pela idade", "nao tenho doenca": sem deficiencia (C16).
const SEM_DEFICIENCIA =
  /\b((e|eh) (so )?pela idade|so (a|pela) idade|por causa da idade|(nao|nenhuma|sem) (tenho |tem |temos )?(nenhuma )?(doenca|deficiencia|problema de saude)|nao (sou|e|eh) doente|(sou|e|eh) saudavel|nao tem nada|nao tenho nada)\b/

const GATILHO_IDOSO = /\b(idos[oa]s?|idoz[oa]s?|65 anos|terceira idade|bpc (do |de )?idos[oa]|loas (do |de |da )?idos[oa])\b/

function extrairOrigem(t: string): Origem | undefined {
  if (/\bgoogle\b/.test(t)) return 'google'
  if (/\b(vim|venho|cheguei|achei|vi) (pelo|no|atraves do) site\b|\bpelo site\b|\bno site\b|advogad[oa] previdenciari/.test(t)) return 'site'
  if (/\b(instagram|insta|facebook|face)\b/.test(t)) return 'meta'
  if (/\banuncio\b/.test(t)) return 'anuncio'
  return undefined
}

function extrairLaudo(t: string, perguntouLaudo: boolean): { laudo: Laudo; ano?: number } | undefined {
  const falaDeLaudo = perguntouLaudo || /\blaudo/.test(t)
  if (!falaDeLaudo) return undefined
  const ano = t.match(/\b(19[89]\d|20[0-4]\d)\b/)
  if (!ano && (NAO_SEI.test(t) || /\bacho que (tem|sim|nao)\b/.test(t))) return { laudo: 'nao_sei' }
  // "laudo nao tenho nao" virou "tem" (familia F10, 21/10/2026): negacao em qualquer ordem.
  if (/\b(sem laudo|nao tem laudo|nao temos laudo|nao tenho laudo|ainda nao tem|ainda nao|nunca teve|nunca fez|esta na fila|ta na fila|na fila|aguardando consulta|nao tem ainda|nao temos ainda|nao (tenho|tem|temos)|(tenho|tem|temos) nao)\b/.test(t))
    return { laudo: 'sem' }
  if (perguntouLaudo && ehNao(t)) return { laudo: 'sem' }
  // Laudo de qualquer ano = tem laudo; o advogado confere se serve (D1, C22).
  if (ano) return { laudo: 'tem', ano: Number(ano[1]) }
  if (/\b(tem laudo|tenho laudo|temos laudo|com laudo|ja tem laudo|laudo de|laudo do medico|laudo medico|laudado|laudada)\b/.test(t)) return { laudo: 'tem' }
  if (perguntouLaudo && (ehSim(t) || /\b(tem|temos|tenho)\b/.test(t))) return { laudo: 'tem' }
  if (/\b(antigo|velho|vencido|desatualizado|recente|novo|desse ano|deste ano|ano passado)\b/.test(t)) return { laudo: 'tem' }
  return undefined
}

function extrairTratamento(t: string, perguntou: boolean, livre: boolean): { tratamento: Tratamento; texto: string } | undefined {
  if (/\b(sus|posto|ubs|caps|apae|ame\b|hospital publico|prefeitura)\b/.test(t)) return { tratamento: 'SUS', texto: 'SUS' }
  if (/\b(plano|convenio|unimed|amil|bradesco saude|sulamerica|hapvida|notredame)\b/.test(t)) return { tratamento: 'plano', texto: 'Plano de saúde' }
  if (/\bparticular\b/.test(t)) return { tratamento: 'particular', texto: 'Particular' }
  if (perguntou && (ehNao(t) || /\b(nao faz|nenhum|nada)\b/.test(t))) return { tratamento: 'nenhum', texto: 'Sem acompanhamento' }
  if (perguntou && livre && t.length > 2) return { tratamento: 'outro', texto: t }
  return undefined
}

function extrairCadUnico(t: string, perguntou: boolean, anoAtual: number): CadUnico | undefined {
  const fala = perguntou || /\b(cad ?unico|cadastro unico|cras)\b/.test(t)
  if (!fala) return undefined
  if (/\b(o q(ue)? (e|eh) (isso|esse)|oq (e|eh)|que (e|eh) isso|nao sei o que (e|eh)|nunca ouvi)\b/.test(t)) return 'nao'
  if (/\b(desatualiz\w*|vencid\w*|faz (muito )?tempo|precisa atualizar|nao (esta|ta) atualizado|antigo|velho)\b/.test(t)) return 'desatualizado'
  // "fiz faz uns 3 anos": 2 anos ou mais e desatualizado (C26).
  const anos = t.match(new RegExp(`\\b(?:(?:faz|ha|tem|de|a)\\s+)?(?:uns |umas |quase |mais de )?(?<n>${NUM_ALT})\\s*anos?\\b`))
  if (anos?.groups) {
    const n = numero(anos.groups.n)
    if (!Number.isNaN(n)) return n >= 2 ? 'desatualizado' : 'atualizado'
  }
  // So ano com cara de data ("em 2023", "fiz 2022"): "ela ganha 2000" e salario, nao ano.
  const doAno = t.match(/\b(?:em|de|no ano de|desde|fiz|feito|atualizei|atualizado)\s+(20[0-3]\d)\b/)
  if (doAno) return anoAtual - Number(doAno[1]) >= 2 ? 'desatualizado' : 'atualizado'
  if (/\b(nao tem|nao temos|nao tenho|nunca fiz|nunca fizemos|nunca teve)\b/.test(t)) return 'nao'
  if (perguntou && ehNao(t)) return 'nao'
  if (/\b(atualizado|atualizei|atualizamos|em dia|tenho|temos|tem sim|tem|fiz|fizemos|esse ano|este ano|ano passado|mes passado)\b/.test(t) || (perguntou && ehSim(t)))
    return 'atualizado'
  return undefined
}

const CENTENAS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600,
  setecentos: 700, oitocentos: 800, novecentos: 900,
}
const DEZENAS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 }
const CENTENA_ALT = Object.keys(CENTENAS).join('|')
const DEZENA_ALT = Object.keys(DEZENAS).join('|')

function valorEmReais(bruto: string): number {
  // "1.500" -> 1500 ; "1500,50" -> 1500.5
  return Number(bruto.replace(/\./g, '').replace(',', '.'))
}

function centena(palavra?: string, dezena?: string): number {
  if (!palavra) return 0
  if (/^\d+$/.test(palavra)) return Number(palavra)
  return (CENTENAS[palavra] ?? 0) + (dezena ? DEZENAS[dezena] ?? 0 : 0)
}

/**
 * Todos os valores em dinheiro da mensagem, somados: "meu marido ganha 1500
 * e eu faco bico de 300" = 1800 (C25). Cada pedaco lido sai do texto para
 * nao contar duas vezes.
 */
function somarDinheiro(t: string, perguntou: boolean): number | undefined {
  let s = ` ${t} `
  const valores: number[] = []
  const tirar = (re: RegExp, conta: (m: RegExpMatchArray) => number) => {
    for (const m of s.matchAll(re)) {
      const v = conta(m)
      if (!Number.isNaN(v)) valores.push(v)
    }
    s = s.replace(re, ' ')
  }
  tirar(new RegExp(`\\b(?<n>${NUM_ALT})\\s*salarios?(?:\\s*minimos?)?(?<meio>\\s*e\\s*meio)?\\b`, 'g'), (m) => numero(m.groups!.n) * SALARIO_MINIMO + (m.groups!.meio ? SALARIO_MINIMO / 2 : 0))
  tirar(/\bmeio salario( minimo)?\b/g, () => SALARIO_MINIMO / 2)
  tirar(/\bsalario minimo\b/g, () => SALARIO_MINIMO)
  tirar(/r\$\s*(\d[\d.]*(?:,\d{1,2})?)/g, (m) => valorEmReais(m[1]))
  tirar(new RegExp(`\\b(?<n>\\d+(?:[.,]\\d+)?|${NUM_ALT})\\s*mil(?:\\s*e\\s*(?<c>${CENTENA_ALT}|\\d{3})(?:\\s*e\\s*(?<d>${DEZENA_ALT}))?)?\\b`, 'g'), (m) => {
    const n = /^\d/.test(m.groups!.n) ? Number(m.groups!.n.replace(',', '.')) : numero(m.groups!.n)
    return n * 1000 + centena(m.groups!.c, m.groups!.d)
  })
  tirar(new RegExp(`\\bmil(?:\\s*e\\s*(?<c>${CENTENA_ALT}|\\d{3})(?:\\s*e\\s*(?<d>${DEZENA_ALT}))?)?\\b`, 'g'), (m) => 1000 + centena(m.groups!.c, m.groups!.d))
  tirar(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?\s*(reais|conto|pila|por mes|mensais|mensal|no mes)\b/g, (m) => valorEmReais(m[1]))
  tirar(new RegExp(`\\b(?<c>${CENTENA_ALT})(?:\\s*e\\s*(?<d>${DEZENA_ALT}))?\\s*(reais|conto|pila)\\b`, 'g'), (m) => centena(m.groups!.c, m.groups!.d))
  tirar(/\b(?:ganha|ganho|ganhamos|ganham|recebe|recebo|recebemos|recebem|entra|entram|renda (?:de|e)|salario de|uns|umas|bico de|tira|tiro)\s*(?:r\$)?\s*(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,\d{1,2})?\b/g, (m) => valorEmReais(m[1]))
  // "a unica renda e o BPC da minha mae, 1621": o valor vem depois de renda ou do beneficio.
  // Ano ("pensao desde 2020") nao e dinheiro.
  const naoEAno = (m: RegExpMatchArray) => (/\b(desde|em|ano|de)\s+(19|20)\d\d$/.test(m[0]) ? NaN : valorEmReais(m[1]))
  tirar(/\brenda\b[^.;!?\d]{0,40}?(\d{1,3}(?:\.\d{3})+|\d{3,6})\b(?!\s*(?:anos|dias|meses))/g, naoEAno)
  tirar(/\b(?:aposentad\w*|pensao|bpc|loas|beneficio|salario|faxina|bico)\b[^.;!?\d]{0,25}?(\d{1,3}(?:\.\d{3})+|\d{3,6})\b(?!\s*(?:anos|dias|meses))/g, naoEAno)
  if (perguntou) {
    tirar(/\b(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,\d{1,2})?\b(?!\s*(?:anos|pessoas|meses|dias|%))/g, (m) => valorEmReais(m[1]))
    tirar(new RegExp(`\\b(?<c>${CENTENA_ALT})(?:\\s*e\\s*(?<d>${DEZENA_ALT}))?\\b`, 'g'), (m) => centena(m.groups!.c, m.groups!.d))
  }
  const validos = valores.filter((v) => v > 0)
  if (!validos.length) return undefined
  // "um salario cada", "os dois com 1 salario": a mesma renda de duas pessoas
  // (familias F01 e F07 de 21/10/2026 ficaram com metade da renda).
  if (validos.length === 1) {
    const quantos = /\b(os|as) tres\b/.test(t) ? 3 : /\b(os|as|nos) (dois|duas)\b|\bambos\b|\beu e (o|a|meu|minha)\b/.test(t) ? 2 : 0
    if (/\bcada( um| uma)?\b(?! (mes|semana|ano|dia))/.test(t)) return validos[0] * Math.max(2, quantos)
    if (quantos && /\b(um|1) salario/.test(t)) return validos[0] * quantos
  }
  return validos.reduce((a, b) => a + b, 0)
}

// "nada", "nao tenho renda" = renda zero. "Fui abandonado", "ninguem me
// ajuda" NAO: viram anotacao e a pergunta simples da renda (Lucas, item 2).
const RENDA_ZERO =
  /\b(sem renda|nenhuma renda|ninguem trabalha|renda zero|nao tem renda|nao temos renda|nao tenho renda|ganha nada|nao ganho nada|nao ganhamos nada|nao entra nada|nao entra dinheiro|nao tenho nenhuma renda|zero)\b/
const ABANDONO = /\b(fui abandonad[oa]|me abandonaram|abandonaram (ela|ele|eu)|ninguem (me )?ajuda|nao tenho ninguem|nao tem ninguem|sem apoio|vivo de ajuda)\b/

function extrairRenda(t: string, perguntou: boolean): number | undefined {
  const valor = somarDinheiro(t, perguntou)
  if (valor !== undefined) return valor
  // "Minha mae nao tem renda" fala da pessoa, nao da casa (familia F02): so
  // vale como renda da casa respondendo a pergunta da renda.
  if (RENDA_ZERO.test(t)) return perguntou || !/\b(ela|ele|mae|pai|avo|vo)\b[^.;!?]{0,40}\b(nao tem|nao ganha|nao recebe|sem) (nenhuma )?(renda|nada|dinheiro)\b/.test(t) ? 0 : undefined
  if (perguntou && /^(nada|nadinha|zero|nenhuma|nenhum|nao entra nada)\b/.test(t)) return 0
  return undefined
}

const PARENTES = 'mae|pai|avo|vo|marido|esposa|esposo|companheir[oa]|irmao|irma|filho|filha|sogro|sogra|tio|tia|neto|neta|padrasto|madrasta|cunhad[oa]|genro|nora'

/** Quem mora na casa, contando a lista ("eu, o pai dele e a irma") quando nao vem o numero. */
function contarCasa(texto: string, perguntou: boolean, f: Ficha): number | undefined {
  // "os pais dele nao moram com a gente", "eu nao moro la": quem nao mora nao conta (F01, F07).
  const t = texto
    .split(/[.;,]/)
    .filter((parte) => !/\bnao (mora|moram|moro|vive|vivem|vivo)\b/.test(parte))
    .join(',')
    .replace(/\b(comigo|cmg)\b/g, 'eu')
  const padroes = [
    new RegExp(`\\b${NUM}\\s*(?:pessoas|moradores|na casa|em casa|ao todo|no total)\\b`),
    new RegExp(`\\bsomos\\s*(?:em\\s*)?${NUM}\\b`),
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
  if (/\b(moro sozinh[oa]|mora sozinh[oa]|vivo sozinh[oa]|vive sozinh[oa]|eu sozinh[oa]|so eu(?! e))\b/.test(t)) return 1
  // "Sou sozinho", "estou sozinha", "moro so" (Cicero e outro idoso, 22/10/2026).
  // "mora so a mae e eu" nao: depois do "so" vem quem mora junto.
  if (/\b(sou|estou|esta|fico|fica|moro|mora|vivo|vive)\s+(sozinh[oa]|so)\b(?!\s+(eu|ele|ela|com|a|o|as|os|minha|meu|nos|n[oó]s|e)\b)/.test(t)) return 1
  if (!perguntou) return undefined
  // Resposta curta a "Quem mora com voce?": "Sozinho", "Ninguem", "So eu mesmo".
  if (/^\W*(sozinh[oa]|ninguem|nenhum[a]?|so eu|eu so|apenas eu|somente eu|ninguem mora comigo|nao mora ninguem|nao tem ninguem)( mesmo)?\W*$/.test(t)) return 1
  // "ja falei, 4": o numero sozinho responde a pergunta da casa.
  const solto = t.match(/(?:^|\s|,)(\d{1,2})(?=\s*$|\s*[,.]|\s+(?!anos|reais|mil|meses|dias|salario))/)
  if (solto && !/\d{3,}/.test(t)) {
    const n = Number(solto[1])
    if (n > 0 && n <= 20) return n
  }
  let n = 0
  let resto = t
  for (const m of t.matchAll(new RegExp(`\\b(?<n>${NUM_ALT})\\s+(?:filhos|filhas|irmaos|irmas|netos|netas|criancas|sobrinhos|sobrinhas)\\b`, 'g'))) {
    n += numero(m.groups!.n)
    resto = resto.replace(m[0], ' ')
  }
  if (/\b(meus pais|os pais|pais dele|pais dela)\b/.test(resto)) {
    n += 2
    resto = resto.replace(/\b(meus pais|os pais|pais dele|pais dela)\b/g, ' ')
  }
  // Plural sem numero ("meus filhos"): nao da para contar, pergunta quantos.
  if (/\b(filhos|filhas|irmaos|irmas|netos|netas|criancas|sobrinhos|avos)\b/.test(resto)) return undefined
  const pessoas =
    resto.match(new RegExp(`\\b(eu|ele|ela|${PARENTES}|mulher|prim[oa]|sobrinh[oa]|enteado|enteada|bebe|namorad[oa]|irm[ao]zinh[oa]|irmaozinho|filhinh[oa]|netinh[oa]|nenem)\\b`, 'g')) ?? []
  n += pessoas.length
  if (/\bnos dois\b/.test(resto)) n += 2
  if (n === 0) return undefined
  // A pessoa do beneficio mora na casa: conta se a lista nao a citou.
  const chave = f.para === 'familiar' ? normalizar((f.quem ?? '').split(' ')[1] ?? '') : f.para === 'filho' ? 'filho' : f.para === 'filha' ? 'filha' : ''
  const citou =
    f.para === 'proprio' ? /\beu\b/.test(resto) : new RegExp(`\\b(${f.pronome ?? 'ele'}|${chave || 'x-x'}|menino|menina|crianca|bebe)\\b`).test(resto)
  if (!citou) n += 1
  return n <= 20 ? n : undefined
}

const QUAL_BENEFICIO = /\b(aposentadoria|aposentad[oa]s?|pensao( por morte)?|pensionista|auxilio[- ]doenca|auxilio[- ]acidente|auxilio|beneficio por incapacidade|bpc|loas|seguro[- ]desemprego)\b/

// "Estamos todos desempregados" na pergunta do beneficio quer dizer que nao recebe (teste do Lucas, 21/10/2026).
const SEM_TRABALHO = /\b(desempregad[oa]s?|sem (emprego|trabalho|trabalhar)|ninguem trabalha|vivemos de bicos?|(faz|faco|fazemos|fazendo) bicos?)\b/

/** O pronome ou o parente que aponta a pessoa do beneficio na frase. */
function refBeneficiario(f: Ficha): RegExp {
  if (f.para === 'proprio') return /\b(eu|recebo|sou aposentad[oa]|sou pensionista|ganho)\b/
  const chave = f.para === 'familiar' ? normalizar((f.quem ?? '').split(' ')[1] ?? '') : f.para === 'filha' ? 'filha' : 'filho'
  const pronome = f.pronome ?? (f.para === 'filha' ? 'ela' : 'ele')
  return new RegExp(`\\b(${pronome} (ja )?(recebe|ganha|tem|e|eh|ta|esta)|(minha|meu|a|o) ${chave}|${pronome} mesm[oa]|(pensao|aposentadoria|beneficio|bpc|loas) d${pronome === 'ela' ? 'ela' : 'ele'}|o proprio|a propria)\\b`)
}

/** Parentes que NAO sao a pessoa do beneficio (para "minha mae", a mae fica de fora). */
function outrosParentes(f: Ficha): string {
  const chave = f.para === 'familiar' ? normalizar((f.quem ?? '').split(' ')[1] ?? '') : ''
  return PARENTES.split('|')
    .filter((p) => p !== chave && !(f.para === 'filho' && p === 'filho') && !(f.para === 'filha' && p === 'filha'))
    .join('|')
}

function refOutraPessoa(f: Ficha): RegExp {
  const parentes = outrosParentes(f)
  const eu = f.para === 'proprio' ? '' : '|eu (recebo|sou aposentad[oa]|ganho)'
  return new RegExp(`\\b((meu|minha|o|a|do|da) (${parentes})|(${parentes}) d(ele|ela)|outra pessoa|alguem da casa${eu})\\b`)
}

/**
 * Item 4 do Lucas: a PROPRIA pessoa do beneficio ja recebe? (o BPC, em
 * regra, nao acumula). Beneficio de outra pessoa da casa e outra coisa.
 */
function lerBeneficioProprio(t: string, f: Ficha, perguntou: boolean): { proprio?: 'sim' | 'nao'; texto?: string; outro?: string } | undefined {
  const qual = t.match(QUAL_BENEFICIO)?.[1]
  const doBenef = refBeneficiario(f).test(t)
  const deOutro = refOutraPessoa(f).test(t)
  if (perguntou) {
    if (NAO_SEI.test(t)) return undefined
    if (ehNao(t) || /\b(nao recebe|nenhum|ninguem|nada|so (o )?bolsa familia)\b/.test(t)) return { proprio: 'nao', outro: deOutro && qual ? qual : undefined }
    if (SEM_TRABALHO.test(t) && !qual) return { proprio: 'nao' }
    // Bolsa Familia pode ser recebido junto com o BPC: nao e impedimento.
    if (/\bbolsa familia\b/.test(t) && !qual) return { proprio: 'nao' }
    if (deOutro && !doBenef) return { proprio: 'nao', outro: qual ?? 'benefício' }
    if (/\b(na casa|em casa|a gente)\b/.test(t) && !doBenef) return undefined
    if (doBenef || ehSim(t) || qual || /\brecebe\b/.test(t)) return { proprio: 'sim', texto: qual }
    return undefined
  }
  if (!qual) return undefined
  // Solto (sem a pergunta), so com o beneficio colado na pessoa: "ela ja e aposentada".
  const beneficio = '(a |uma |o |um )?(aposentad\\w*|pensao|pensionista|auxilio|bpc|loas)'
  const chave = f.para === 'familiar' ? normalizar((f.quem ?? '').split(' ')[1] ?? '') : f.para === 'filha' ? 'filha' : 'filho'
  const pronome = f.pronome ?? (f.para === 'filha' ? 'ela' : 'ele')
  const ligadoAoBenef =
    f.para === 'proprio'
      ? /\b(sou aposentad[oa]|sou pensionista|recebo (a |uma )?(aposentadoria|pensao|auxilio|bpc|loas)|ja recebo|tenho aposentadoria)\b/.test(t)
      : new RegExp(`\\b((${pronome}|(minha|meu|a|o) ${chave}) (ja )?(recebe|ganha|e|eh|tem) ${beneficio}|(pensao|aposentadoria|beneficio|bpc|loas) d${pronome})\\b`).test(t)
  if (ligadoAoBenef) return { proprio: 'sim', texto: qual }
  return undefined
}

/** Beneficio de outra pessoa da casa, dito na renda ou solto ("o BPC da minha mae, 1621"). */
function lerBeneficioDaCasa(t: string, f: Ficha): string | undefined {
  const outro = refOutraPessoa(f).source
  const perto = new RegExp(`${outro}[^.;!?]{0,30}\\b(?<b>aposentad\\w*|pensao|pensionista|bpc|loas|auxilio)|\\b(?<b2>aposentadoria|pensao|bpc|loas|auxilio) (da|do|de) (minha|meu|sua|seu|o|a)?\\s*(${outrosParentes(f)})\\b`)
  const m = t.match(perto)
  if (m) return m.groups?.b ?? m.groups?.b2 ?? 'benefício'
  // "a aposentadoria dele" quando o beneficio e para ela (e o contrario).
  const doBenef = f.para === 'proprio' ? '' : f.pronome ?? (f.para === 'filha' ? 'ela' : 'ele')
  const outroPronome = doBenef === 'ela' ? 'ele' : doBenef === 'ele' ? 'ela' : '(ele|ela)'
  const pronome = t.match(new RegExp(`\\b(aposentadoria|pensao|bpc|loas|beneficio|auxilio) d${outroPronome}\\b`))
  return pronome ? pronome[1] : undefined
}

function extrairPedidoAnterior(t: string, perguntou: boolean, perguntouResultado: boolean): Ficha['pedidoAnterior'] | undefined {
  if (/\b(negad\w*|indeferid\w*|negaram|negou|nao aprovaram|nao aprovou|recusaram|nao passou|barrad\w*|cortaram|cortado)\b/.test(t)) return 'negado'
  if (/\b(em analise|esperando (a )?resposta|aguardando (o inss|resposta|a resposta)|ainda nao saiu|ta em analise|esta em analise|em andamento)\b/.test(t)) return 'em_analise'
  // "E o INSS negou, ou ainda esta em analise?": "sim" e negou.
  if (perguntouResultado && ehSim(t)) return 'negado'
  if (perguntouResultado && ehNao(t)) return 'em_analise'
  if (perguntou && (ehNao(t) || /\b(nunca pedi|nunca pedimos|primeira vez)\b/.test(t))) return 'nao'
  if (/\b(nunca pedi|nunca pedimos|nunca demos entrada|nunca entramos)\b/.test(t)) return 'nao'
  if (perguntou && (ehSim(t) || /\b(ja pedi|ja pedimos|pedimos|pedi|demos entrada|dei entrada)\b/.test(t))) return 'sim'
  return undefined
}

/** Dias desde a negativa: "faz 10 dias", "semana passada", "mes passado". */
function diasDesde(t: string, perguntou: boolean): number | undefined {
  if (!perguntou && !/\b(faz|ha|uns|umas|semana passada|mes passado|ontem|anteontem|recente\w*|esse mes|este mes|ano passado|atras)\b/.test(t)) return undefined
  if (/\bhoje\b/.test(t)) return 0
  if (/\banteontem\b/.test(t)) return 2
  if (/\bontem\b/.test(t)) return 1
  if (/\b(essa semana|esta semana)\b/.test(t)) return 3
  if (/\bsemana passada\b/.test(t)) return 7
  // "Mes passado" pode ser 15 ou 45 dias: na duvida, vale o prazo (prioridade).
  if (/\b(mes passado|esse mes|este mes)\b/.test(t)) return 25
  if (/\bano passado\b/.test(t)) return 365
  if (/\b(recente\w*|faz pouco|agora pouco|uns dias|poucos dias)\b/.test(t)) return 10
  const m = t.match(new RegExp(`\\b(?<n>${NUM_ALT}|meio)\\s*(?<u>dias?|semanas?|mes(?:es)?|anos?)\\b`))
  if (!m?.groups) return undefined
  const n = m.groups.n === 'meio' ? 0.5 : numero(m.groups.n)
  if (Number.isNaN(n)) return undefined
  const u = m.groups.u
  return Math.round(n * (u.startsWith('dia') ? 1 : u.startsWith('semana') ? 7 : u.startsWith('mes') ? 30 : 365))
}

// Correcao da familia: "na verdade sao 3", "hoje ele tem 19" (C27).
const CORRECAO = /\b(na verdade|corrigindo|correcao|errei|me enganei|quis dizer|falei errado|digitei errado|escrevi errado|hoje (ele|ela) tem|agora (ele|ela) tem)\b/
// A familia explica o arquivo que mandou: isso nao e resposta da pergunta (familia F09).
const SOBRE_ARQUIVO = /\b(foto|print|arquivo|pdf|imagem|mandei|enviei|te mandei|vc ver|voce ver)\b/
const TEMPO = new RegExp(`\\b(?:faz |ha )?(?:uns |umas )?(?:${NUM_ALT}|meio) (?:dias?|semanas?|mes(?:es)?|anos?)\\b|\\b(?:semana passada|mes passado|ano passado|ontem|anteontem|hoje|recentemente|recente)\\b`)

export const NOTA_LOAS_14 =
  'A renda inclui aposentadoria ou BPC de até 1 salário mínimo de outra pessoa da casa. Se essa pessoa for idosa (65+) ou com deficiência, pela LOAS (art. 20, §14) esse valor não entra na conta do INSS. Conferir.'
export const NOTA_SEM_APOIO = 'Sem apoio da família: a pessoa contou que foi abandonada ou que ninguém ajuda.'
export const NOTA_PARENTES =
  'Na casa há parente que a LOAS pode não contar (genro, nora, filho casado, avós, tios): conferir quem entra na conta da renda.'
export const NOTA_APRENDIZ = 'A renda inclui salário de aprendiz ou bolsa de estágio, que pela LOAS não entra na conta do INSS. Conferir.'
export const NOTA_MELHORA =
  'A família contou que o médico prevê melhora em menos de 2 anos: para o BPC, a deficiência é impedimento de 2 anos ou mais. O advogado confere.'

/** Le tudo o que der da mensagem. A pergunta feita deixa a leitura mais solta. */
export function lerMensagem(original: string, ficha: Ficha, pergunta: Pergunta | null, agora: Date = new Date(), primeira = false): Ficha {
  const t = normalizar(original)
  const nova: Ficha = { ...ficha }
  const perguntou = (...p: Pergunta[]) => pergunta !== null && p.includes(pergunta)
  const corrigindo = CORRECAO.test(t)
  // Pergunta da familia nunca vira texto da ficha (C01).
  const livre = !ehPergunta(original, t)
  const anotar = (nota: string) => {
    if (!(nova.anotacoes ?? []).includes(nota)) nova.anotacoes = [...(nova.anotacoes ?? []), nota]
  }

  // "meu nome e Camila" vale mesmo depois de um nome lido errado (familias F01 e F02).
  if (!nova.nome || /\b(meu nome (e|eh)|me chamo)\b/.test(t)) {
    const nome = extrairNome(original, perguntou('abertura_quem', 'nome_idade', 'nome'))
    if (nome) nova.nome = nome
  }
  if (!nova.para) {
    const para = extrairParaQuem(t)
    if (para) Object.assign(nova, para)
  }
  // A area sai da 1a mensagem (pacote v3.2): "minha mae recebe o loas de
  // idosa" no meio da conversa nao faz do irmao autista um idoso (F01).
  if (primeira && !nova.area && GATILHO_IDOSO.test(t)) nova.area = 'idoso'
  if (!nova.origem) {
    const o = extrairOrigem(t)
    if (o) nova.origem = o
  }
  if (primeira && !nova.campanha) {
    if (/\b(autis\w*|tea)\b/.test(t)) nova.campanha = 'autista'
    else if (GATILHO_IDOSO.test(t)) nova.campanha = 'idoso'
  }
  if (nova.idade === undefined || corrigindo) {
    const idade = extrairIdade(t, perguntou('nome_idade', 'idade'), nova.para)
    if (idade !== undefined) nova.idade = idade
  }
  if (nova.para === undefined && nova.idade !== undefined && nova.idade >= 65 && /\b(tenho|eu tenho)\b/.test(t)) nova.para = 'proprio'

  const crianca = nova.para === 'filho' || nova.para === 'filha'
  const d = extrairDiagnostico(t)
  const falaDeSaude = perguntou('diagnostico', 'laudo') || Boolean(d) || /\b(diagnostic\w*|neuro\w*|psiquiatr\w*|laudo)\b/.test(t)
  if (!nova.diagnostico && !nova.semDeficiencia) {
    if (SEM_DEFICIENCIA.test(t) && !d) nova.semDeficiencia = true
    else if (falaDeSaude && INVESTIGACAO.test(t)) {
      nova.diagnostico = `Em investigação${d ? `: ${d}` : ''}`
      if (!nova.laudo) nova.laudo = 'sem'
    } else if (d) nova.diagnostico = d
    else if (perguntou('diagnostico') && livre && ehNao(t)) {
      if (!crianca) nova.semDeficiencia = true
      else {
        nova.diagnostico = 'Em investigação (ainda sem diagnóstico)'
        if (!nova.laudo) nova.laudo = 'sem'
      }
    }
  } else if (nova.diagnostico && !nova.diagnostico.startsWith('Em investigação') && !temLaudo(nova) && INVESTIGACAO.test(t) && falaDeSaude) {
    // "a gente acha que e autista" e depois "ta na fila do neuro" (F06).
    nova.diagnostico = `Em investigação: ${nova.diagnostico}`
    if (!nova.laudo) nova.laudo = 'sem'
  } else if (nova.diagnostico && !crianca && SEM_DEFICIENCIA.test(t) && !d && !DIAGNOSTICOS.some(([, nome]) => nova.diagnostico === nome)) {
    // "nao sou doente" corrige um texto solto gravado como diagnostico (F10).
    nova.diagnostico = undefined
    nova.semDeficiencia = true
  }
  if (!nova.laudo || corrigindo || perguntou('laudo', 'laudo_para_preco')) {
    const l = extrairLaudo(t, perguntou('laudo', 'laudo_para_preco'))
    if (l) {
      nova.laudo = l.laudo
      if (l.ano) nova.laudoAno = l.ano
    }
  }
  // "tem sim" e logo "de 2024 do neuro": o ano picado e do laudo, nao a rotina (F01).
  const anoSolto = t.match(/\b(19[89]\d|20[0-4]\d)\b/)
  if (temLaudo(nova) && !nova.laudoAno && anoSolto && (perguntou('rotina', 'laudo') || /\b(laudo|neuro\w*|medic\w*|psiquiatr\w*)\b/.test(t)) && !/\b(ganh|reais|r\$|renda)/.test(t))
    nova.laudoAno = Number(anoSolto[1])
  if (!nova.tratamento) {
    const tr = extrairTratamento(t, perguntou('tratamento'), livre)
    // "faz terapia no CAPS" respondendo a rotina tambem conta.
    if (tr && tr.tratamento !== 'outro' && (perguntou('tratamento') || /\b(sus|caps|ubs|apae|plano|convenio|particular)\b/.test(t))) {
      nova.tratamento = tr.tratamento
      nova.tratamentoTexto = tr.texto
    }
  }
  // CadUnico: vale a ultima resposta (Lucas, item 2).
  if (!nova.cadunico || perguntou('cadunico') || /\b(cad ?unico|cadastro unico)\b/.test(t)) {
    const c = extrairCadUnico(t, perguntou('cadunico'), agora.getUTCFullYear())
    if (c) nova.cadunico = c
  }

  const falaDeCasa = perguntou('casa', 'casa_renda', 'pessoas') || /\b(moram|moramos|mora|somos|pessoas|sozinh)/.test(t)
  if (falaDeCasa && (nova.pessoasCasa === undefined || corrigindo || perguntou('casa', 'pessoas'))) {
    const p = contarCasa(t, perguntou('casa', 'casa_renda', 'pessoas'), nova)
    if (p !== undefined) nova.pessoasCasa = p
    const falaDeGente = p !== undefined || new RegExp(`\\b(eu|ele|ela|comigo|mora\\w*|casa|${PARENTES}|mulher)\\b`).test(t)
    if (perguntou('casa', 'casa_renda') && livre && falaDeGente) nova.casaTexto = original.trim().slice(0, 160)
    if (/\b(genro|nora|casad[oa]|avo|avos|vo|tio|tia|prim[oa]|cunhad[oa])\b/.test(t)) anotar(NOTA_PARENTES)
    // Filho casado que mora com a mae idosa: a esposa dele e nora dela (F02).
    if (nova.para === 'familiar' && /\b(minha (esposa|mulher)|meu marido|sou casad[oa])\b/.test(t)) anotar(NOTA_PARENTES)
  }
  const falaDeRenda = perguntou('renda', 'renda_simples', 'casa_renda') || /\b(renda|ganh\w*|salario|reais|r\$|entra|recebe\w*|mil|valor|bico|faxina)\b/.test(t)
  if (falaDeRenda && (nova.rendaCasa === undefined || corrigindo || perguntou('renda', 'renda_simples'))) {
    const r = extrairRenda(t, perguntou('renda', 'renda_simples', 'casa_renda'))
    if (r !== undefined) {
      nova.rendaCasa = r
      if (livre) nova.rendaTexto = original.trim().slice(0, 160)
    }
  } else if (falaDeRenda && nova.rendaCasa !== undefined && !JA_FALEI.test(t) && /\b(ganho|ganha|faco|faz|trabalho|trabalha|faxina|bico|salario|tambem|tb)\b/.test(t)) {
    // Mensagem picada: a 2a renda chega depois da pergunta ("eu faco faxina uns 700", F04).
    const mais = somarDinheiro(t, false)
    if (mais !== undefined && !/\b(aposentad|pensao|bpc|loas)/.test(t)) {
      nova.rendaCasa += mais
      nova.rendaTexto = `${nova.rendaTexto ? `${nova.rendaTexto} | ` : ''}${original.trim().slice(0, 120)}`
    }
  }
  if (/\b(aprendiz|estagi\w*|jovem aprendiz)\b/.test(t) && falaDeRenda) anotar(NOTA_APRENDIZ)
  if (ABANDONO.test(t)) anotar(NOTA_SEM_APOIO)
  if (/\bmelhor(a|o|ar|e)\b[^.]{0,30}\b(meses|mes|ano)\b|\b(meses|mes)\b[^.]{0,30}\bmelhor(a|o|ar|e)\b/.test(t) && !crianca) anotar(NOTA_MELHORA)

  if (perguntou('quem_recebe')) {
    if (refOutraPessoa(nova).test(t) || /\b(outra pessoa|outro|outra)\b/.test(t)) {
      nova.beneficioProprio = 'nao'
      nova.outrosBeneficios = 'sim'
      nova.outrosBeneficiosTexto = original.trim().slice(0, 120)
    } else if (/\b(ele|ela|eu|mesm[oa]|propri[oa]|dele|dela)\b/.test(t) || ehSim(t)) nova.beneficioProprio = 'sim'
  } else if (!nova.beneficioProprio || perguntou('beneficio_proprio')) {
    const b = lerBeneficioProprio(t, nova, perguntou('beneficio_proprio'))
    if (b?.proprio) {
      nova.beneficioProprio = b.proprio
      if (b.texto) nova.beneficioProprioTexto = b.texto
    }
    if (b?.outro && !nova.outrosBeneficios) {
      nova.outrosBeneficios = 'sim'
      nova.outrosBeneficiosTexto = b.outro
    }
  }
  if (perguntou('outros_beneficios')) {
    if (ehNao(t) || /\b(ninguem|nenhum|so (o )?bolsa familia)\b/.test(t) || (SEM_TRABALHO.test(t) && !QUAL_BENEFICIO.test(t))) nova.outrosBeneficios = 'nao'
    else if (QUAL_BENEFICIO.test(t) || ehSim(t)) {
      nova.outrosBeneficios = 'sim'
      nova.outrosBeneficiosTexto = livre ? original.trim().slice(0, 120) : t.match(QUAL_BENEFICIO)?.[1]
    }
  } else if (!nova.outrosBeneficios) {
    const b = lerBeneficioDaCasa(t, nova)
    if (b) {
      nova.outrosBeneficios = 'sim'
      nova.outrosBeneficiosTexto = livre ? original.trim().slice(0, 120) : b
    }
  }
  // Pensao ou aposentadoria contada sem dizer de quem: a proxima pergunta e
  // "Quem recebe?", nao a pergunta do beneficio de novo (F11).
  const semDono = t.match(/\b(aposentadoria|aposentad[oa]|pensao( por morte)?|pensionista|auxilio[- ]doenca|auxilio)\b/)
  if (semDono && !nova.beneficioProprio && !nova.beneficioCitado && !perguntou('beneficio_proprio', 'quem_recebe') && nova.outrosBeneficios !== 'sim')
    nova.beneficioCitado = semDono[1]
  // Item 3 do Lucas: so a anotacao na ficha, a fala do robo nao muda.
  if (nova.outrosBeneficios === 'sim' && /\b(aposentad\w*|bpc|loas)\b/.test(t) && /\b(um salario|1 salario|salario minimo|1\.?621)\b/.test(t)) anotar(NOTA_LOAS_14)

  if (!nova.biometria && perguntou('biometria') && livre) {
    if ((ehNao(t) || /\b(nao|nenhum|nenhuma|sem digital)\b/.test(t)) && !/\b(tem sim|tenho sim)\b/.test(t)) nova.biometria = 'nao'
    else if (ehSim(t) || /\b(cnh|cin|titulo|identidade nova|carteira de motorista|digital)\b/.test(t)) nova.biometria = 'sim'
  }
  if (!nova.pedidoAnterior || nova.pedidoAnterior === 'sim' || perguntou('pedido_anterior', 'pedido_resultado')) {
    const p = extrairPedidoAnterior(t, perguntou('pedido_anterior'), perguntou('pedido_resultado'))
    if (p && !(p === 'sim' && nova.pedidoAnterior && nova.pedidoAnterior !== 'sim')) nova.pedidoAnterior = p
  }
  if (nova.pedidoAnterior === 'negado' && !nova.tempoNegado) {
    const dias = diasDesde(t, perguntou('tempo_negado'))
    if (dias !== undefined) {
      nova.diasNegado = dias
      nova.tempoNegado = t.match(TEMPO)?.[0] ?? original.split('?')[0].trim().slice(0, 80)
    } else if (perguntou('tempo_negado') && livre && t.length > 0) nova.tempoNegado = original.trim().slice(0, 80)
  }

  // Texto livre (diagnostico, rotina, tratamento, cidade) so quando a
  // mensagem nao trouxe outro dado e nao fala do arquivo mandado: "moro
  // sozinho, ganho 300" virou diagnostico e "ja pedimos e negaram" virou
  // rotina (familias F10 e F04 de 21/10/2026).
  const soDado = (f: Ficha) => JSON.stringify({ ...f, anotacoes: undefined, casaTexto: undefined, rendaTexto: undefined, tratamento: undefined, tratamentoTexto: undefined, campanha: undefined, origem: undefined, laudoAno: undefined })
  const trouxeOutroDado = soDado(nova) !== soDado(ficha)
  const textoLivre = livre && !trouxeOutroDado && !SOBRE_ARQUIVO.test(t) && t.length > 2
  if (textoLivre) {
    if (!nova.diagnostico && !nova.semDeficiencia && perguntou('diagnostico')) nova.diagnostico = original.trim().slice(0, 140)
    else if (!nova.rotina && perguntou('rotina')) nova.rotina = original.trim().slice(0, 240)
    else if (!nova.tratamento && perguntou('tratamento')) {
      nova.tratamento = 'outro'
      nova.tratamentoTexto = t
    } else if (!nova.cidade && perguntou('cidade')) nova.cidade = original.trim().slice(0, 60)
  }
  return nova
}

// ---------------------------------------------------------------------------
// Contas sobre a ficha
// ---------------------------------------------------------------------------

export function ehIdoso(f: Ficha): boolean {
  return f.idade !== undefined && f.idade >= 65 && f.para !== 'filho' && f.para !== 'filha'
}

/** Laudo de qualquer ano conta como "tem laudo" (D1); 'recente' e 'antigo' vem do v2.5. */
export function temLaudo(f: Ficha): boolean {
  return f.laudo === 'tem' || f.laudo === 'recente' || f.laudo === 'antigo'
}

/** Estimativa: o robo soma tudo o que a familia contou; quem entra na conta e o advogado que ve (C20). */
export function rendaPorPessoa(f: Ficha): number | undefined {
  if (f.rendaCasa === undefined || !f.pessoasCasa) return undefined
  return f.rendaCasa / f.pessoasCasa
}

/**
 * Fechamento limpo ou nao. Limpo: deficiencia ou 65+, sem impedimento, renda
 * que nao e alta e um caminho para o laudo. Renda alta aqui e mais de meio
 * salario por pessoa: a regra e 1/4, mas ha excecoes que so o advogado
 * avalia, e o robo nunca da veredito. Isto escolhe o TOM do fechamento, nao
 * quem e atendido.
 */
export function respostasBoas(f: Ficha): boolean {
  if (f.beneficioProprio === 'sim') return false
  if (f.semDeficiencia && !ehIdoso(f)) return false
  const perfil = ehIdoso(f) || Boolean(f.diagnostico)
  const rpp = rendaPorPessoa(f)
  const rendaBaixa = rpp === undefined || rpp <= SALARIO_MINIMO / 2
  const laudoOk = ehIdoso(f) || temLaudo(f) || f.laudo === 'nao_sei' || f.faseMedica !== 'recusou'
  return perfil && rendaBaixa && laudoOk
}

/**
 * Versao do contrato. O valor fixo de R$ 1.000 so existe quando a pessoa NAO
 * tem laudo e vai pela fase medica parceira (D1): laudo de qualquer ano e
 * contrato sem valor fixo. Idoso nao passa por pericia: sempre sem.
 */
export function contratoComParteFixa(f: Ficha): boolean {
  if (ehIdoso(f)) return false
  return f.laudo === 'sem' && f.faseMedica !== 'recusou'
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

function sobre(f: Ficha) {
  if (f.para === 'proprio') return { quem: 'você', ele: 'você', dele: 'sua', Ele: 'Você', tem: 'você tem', avalia: 'te avalia' }
  if (f.para === 'filha') return { quem: 'sua filha', ele: 'ela', dele: 'dela', Ele: 'Ela', tem: 'tem sua filha', avalia: 'avalia sua filha' }
  if (f.para === 'familiar') {
    const ele = f.pronome ?? 'ela'
    const quem = f.quem ?? 'a pessoa'
    return { quem, ele, dele: ele === 'ele' ? 'dele' : 'dela', Ele: capitalizar(ele), tem: `tem ${quem}`, avalia: `avalia ${quem}` }
  }
  return { quem: 'seu filho', ele: 'ele', dele: 'dele', Ele: 'Ele', tem: 'tem seu filho', avalia: 'avalia seu filho' }
}

const PERGUNTAS_DE_SAUDE: Pergunta[] = ['diagnostico', 'laudo', 'laudo_para_preco', 'fase_medica', 'rotina', 'tratamento']

function textoDaPergunta(p: Pergunta, f: Ficha, agora: Date): string {
  const s = sobre(f)
  const proprio = f.para === 'proprio'
  const idoso = ehIdoso(f)
  switch (p) {
    case 'abertura_quem':
      if (f.area === 'idoso') return 'O benefício do idoso é para você ou para algum familiar?'
      if (f.nome) return 'O benefício seria para você, para seu filho(a) ou para outra pessoa da família?'
      if (f.origem === 'site') return 'Me conta seu nome e o que está acontecendo: é benefício do INSS para você ou para alguém da família?'
      return 'Me conta seu nome e para quem seria o benefício?'
    case 'nome_idade':
      // Idoso sem saber para quem: o nome ja dito nao e pedido de novo (teste do Edu, 21/10/2026).
      if (!f.para) return f.nome ? 'Quantos anos tem a pessoa que precisa do benefício?' : 'Me conta seu nome e quantos anos tem a pessoa que precisa do benefício?'
      return proprio ? 'Me conta seu nome e quantos anos você tem?' : `Me conta seu nome e quantos anos ${s.tem}?`
    case 'nome':
      return 'E qual o seu nome?'
    case 'idade':
      return proprio ? 'Quantos anos você tem?' : `Quantos anos ${s.tem}?`
    case 'diagnostico':
      if (f.para === 'filho' || f.para === 'filha') return `Qual o diagnóstico ${s.dele}, e desde quando?`
      return `${s.Ele} tem alguma doença ou deficiência, e desde quando?`
    case 'laudo':
      return `${s.Ele} tem laudo do médico com o diagnóstico, e de que ano é?`
    case 'laudo_para_preco':
      return `${s.Ele} já tem laudo do médico?`
    case 'fase_medica':
      return `Entendo${f.nome ? ', ' + primeiroNome(f.nome) : ''}. Pelo SUS o laudo demora mesmo. O escritório tem um médico parceiro que atende por videochamada, ${s.avalia} e, se for o caso, emite o laudo. Quer saber como funciona?`
    case 'fase_medica_recusou':
      return 'Posso te chamar daqui a uma semana para ver se conseguiu?'
    case 'rotina':
      return proprio
        ? 'Como é a sua rotina: precisa de ajuda nas coisas do dia, faz terapia ou toma remédio?'
        : `Como é a rotina ${s.dele}: precisa de ajuda nas coisas do dia, faz terapia ou toma remédio?`
    case 'tratamento':
      return 'O acompanhamento é pelo SUS ou por plano/particular?'
    case 'cadunico':
      return `A família tem o CadÚnico, ${idoso ? 'aquele' : 'o'} cadastro do CRAS, atualizado nos últimos 2 anos?`
    case 'cadunico_combinado':
      return 'Dá para ir ao CRAS essa semana?'
    case 'casa_renda':
    case 'casa':
      if (proprio) return 'Quem mora com você na mesma casa?'
      return f.para === 'familiar' ? `Quem mora com ${s.ele} na mesma casa?` : `Quem mora com ${s.ele} na mesma casa? (pai, mãe, irmãos...)`
    case 'pessoas':
      return `E quantas pessoas são ao todo na casa, contando ${s.ele}?`
    case 'renda':
      return 'E quanto entra de dinheiro na casa por mês, somando todo mundo, mais ou menos?'
    case 'renda_simples':
      return `E quanto entra de dinheiro por mês ${f.pessoasCasa === 1 ? `para ${s.ele}` : 'na casa'}, mais ou menos? Se não entra nada, pode dizer "nada".`
    case 'beneficio_proprio':
      return idoso ? `${s.Ele} já recebe aposentadoria, pensão ou outro benefício do INSS?` : `${s.Ele} já recebe algum benefício do INSS, como pensão ou aposentadoria?`
    case 'quem_recebe':
      return `Quem recebe: ${s.ele} ou outra pessoa da casa?`
    case 'outros_beneficios':
      return 'Alguém da casa recebe aposentadoria, pensão ou BPC, e de quanto, mais ou menos?'
    case 'biometria':
      return `${s.Ele} tem CNH, a identidade nova (CIN) ou título de eleitor com digital cadastrada?`
    case 'pedido_anterior':
      return idoso ? `${s.Ele} já pediu esse benefício no INSS alguma vez?` : 'Vocês já pediram o BPC no INSS alguma vez?'
    case 'pedido_resultado':
      return 'E o INSS negou, ou ainda está em análise?'
    case 'tempo_negado':
      return 'Faz quanto tempo que negaram?'
    case 'horario':
      return `Só para confirmar: prefere ${opcoesDeHorario(agora).texto}?`
    case 'contrato_ok':
      return 'A equipe pode te mandar o contrato e a lista de documentos antes da conversa?'
    case 'cidade':
      return idoso && !proprio ? `Em qual cidade ${s.ele} mora?` : 'Em qual cidade você mora?'
    case 'resumo_familia':
      return 'Quer que eu mande um resumo do que falamos para verem juntos?'
    default:
      return ''
  }
}

function antesDoPedido(f: Ficha): Pergunta | null {
  if (!f.pedidoAnterior) return 'pedido_anterior'
  if (f.pedidoAnterior === 'sim') return 'pedido_resultado'
  return null
}

/** Ordem do roteiro, pulando o que ja foi respondido. null = hora de encaminhar. */
export function proximaPergunta(f: Ficha): Pergunta | null {
  if (!f.para) return f.area === 'idoso' && (!f.nome || f.idade === undefined) ? 'nome_idade' : 'abertura_quem'
  if (!f.nome && f.idade === undefined) return 'nome_idade'
  if (!f.nome) return 'nome'
  if (f.idade === undefined) return 'idade'
  // Negativa no INSS corre prazo de recurso: o tempo vem antes do resto.
  if (f.pedidoAnterior === 'negado' && !f.tempoNegado) return 'tempo_negado'
  const casaPrimeiro = (): Pergunta | null => {
    if (f.pessoasCasa === undefined) return f.casaTexto ? 'pessoas' : 'casa'
    if (f.rendaCasa === undefined) return 'renda'
    if (!f.beneficioProprio) return f.beneficioCitado ? 'quem_recebe' : 'beneficio_proprio'
    if (!f.outrosBeneficios && f.pessoasCasa > 1 && f.rendaCasa > 0) return 'outros_beneficios'
    return null
  }
  if (ehIdoso(f)) {
    // Ordem do idoso (area BPC/LOAS Idoso): sem diagnostico, laudo nem rotina.
    const casa = casaPrimeiro()
    if (casa) return casa
    if (!f.cadunico) return 'cadunico'
    if (!f.biometria && (f.idade ?? 0) <= 80) return 'biometria'
    return antesDoPedido(f)
  }
  if (f.semDeficiencia) return null
  if (!f.diagnostico) return 'diagnostico'
  if (!f.laudo) return 'laudo'
  if (f.laudo === 'sem' && !f.faseMedica) return 'fase_medica'
  if (!f.rotina) return 'rotina'
  if (!f.tratamento) return 'tratamento'
  if (!f.cadunico) return 'cadunico'
  return casaPrimeiro() ?? antesDoPedido(f)
}

/** A pergunta ainda espera resposta? (perguntas de etapa, como horario, sempre esperam) */
function aindaFalta(p: Pergunta, f: Ficha): boolean {
  switch (p) {
    case 'abertura_quem':
      return !f.para
    case 'nome_idade':
      return !f.nome || f.idade === undefined
    case 'nome':
      return !f.nome
    case 'idade':
      return f.idade === undefined
    case 'diagnostico':
      return !f.diagnostico && !f.semDeficiencia
    case 'laudo':
      return !f.laudo
    case 'fase_medica':
      return !f.faseMedica
    case 'rotina':
      return !f.rotina
    case 'tratamento':
      return !f.tratamento
    case 'cadunico':
      return !f.cadunico
    case 'casa':
    case 'casa_renda':
    case 'pessoas':
      return f.pessoasCasa === undefined
    case 'renda':
    case 'renda_simples':
      return f.rendaCasa === undefined
    case 'beneficio_proprio':
    case 'quem_recebe':
      return !f.beneficioProprio
    case 'outros_beneficios':
      return !f.outrosBeneficios
    case 'biometria':
      return !f.biometria
    case 'pedido_anterior':
      return !f.pedidoAnterior
    case 'pedido_resultado':
      return f.pedidoAnterior === 'sim'
    case 'tempo_negado':
      return !f.tempoNegado
    default:
      return true
  }
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

/** Grade de horarios do Dr. Andre: a equipe configura na tela Agenda. */
export interface GradeDaAgenda {
  /** dia da semana ("0" domingo a "6" sabado) -> inicios "HH:MM", hora de Santos */
  horarios: Record<string, string[]>
  /** toda semana: faixa "HH:MM" fechada naquele dia */
  bloqueiosSemanais: { dia: number; de: string; ate: string; motivo?: string }[]
  /** datas especificas fechadas (ISO): viagem, audiencia, folga */
  bloqueios: { inicio: string; fim: string; motivo?: string }[]
  duracaoMin: number
  /** minutos minimos entre a conversa e o horario oferecido */
  antecedenciaMin: number
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** "08:00" ate "11:00" de `passo` em `passo` minutos, cabendo a reuniao inteira antes do fim. */
export function horariosEntre(de: string, ate: string, passo: number): string[] {
  const lista: string[] = []
  for (let m = minutos(de); m + passo <= minutos(ate); m += passo) lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return lista
}

/**
 * Regras da Andreia (22/10/2026): manha das 8h as 11h, tarde a partir das
 * 13h40, terca 15h-16h fechado. Cada entrevista dura 30 minutos (Edu).
 */
export const GRADE_PADRAO: GradeDaAgenda = {
  horarios: Object.fromEntries(['1', '2', '3', '4', '5'].map((d) => [d, [...horariosEntre('08:00', '11:00', 30), ...horariosEntre('13:40', '17:10', 30)]])),
  bloqueiosSemanais: [{ dia: 2, de: '15:00', ate: '16:00', motivo: 'Compromisso fixo do Dr. André' }],
  bloqueios: [],
  duracaoMin: 30,
  antecedenciaMin: 120,
}

/** O que quem chama `responder` sabe da agenda: a grade e os horarios ja tomados (ISO). */
export interface AgendaDaVez {
  grade?: GradeDaAgenda
  ocupados?: string[]
}

// Contexto da chamada (responder e sincrono): grade, horarios tomados por
// outras familias e a oferta feita a esta familia, para nao carregar parametro
// por todas as funcoes que oferecem horario. Antes o robo oferecia "amanha 9h
// ou 10h" a todo mundo (Catiane e Flavia, 22/10/2026).
let gradeDaVez: GradeDaAgenda = GRADE_PADRAO
let ocupadosDaVez: number[] = []
let ofertaDaVez: number[] | null = null

const HORA = 3600000
const DIA = 86400000
const NOME_DO_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']


/** Brasil sem horario de verao: hora de Santos = UTC-3. */
const local = (ms: number) => new Date(ms - 3 * HORA)
const horaLocal = (ms: number) => local(ms).getUTCHours()

/** Meia-noite do dia de Santos de `ms`, contada como UTC. */
function diaDeSantos(ms: number): number {
  const l = local(ms)
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate())
}

/** Horario da grade livre: com antecedencia, fora de bloqueio e sem outra familia. */
function livre(ms: number, agora: Date): boolean {
  const g = gradeDaVez
  const dur = g.duracaoMin * 60000
  if (ms < agora.getTime() + g.antecedenciaMin * 60000) return false
  const l = local(ms)
  const ini = l.getUTCHours() * 60 + l.getUTCMinutes()
  if (g.bloqueiosSemanais.some((b) => b.dia === l.getUTCDay() && minutos(b.de) < ini + g.duracaoMin && ini < minutos(b.ate))) return false
  if (g.bloqueios.some((b) => new Date(b.inicio).getTime() < ms + dur && ms < new Date(b.fim).getTime())) return false
  return !ocupadosDaVez.some((o) => o < ms + dur && ms < o + dur)
}

/** Inicios da grade num dia (meia-noite de `diaDeSantos`), em ms UTC. */
function horariosDoDia(dia0: number): number[] {
  const sem = new Date(dia0).getUTCDay()
  return (gradeDaVez.horarios[String(sem)] ?? []).map((h) => dia0 + (minutos(h) + 180) * 60000).sort((a, b) => a - b)
}

/** Proximos horarios livres a partir do dia `desde`, ate 3 semanas. */
function vagas(agora: Date, desde = diaDeSantos(agora.getTime()), quantas = 2, filtro: (ms: number) => boolean = () => true): number[] {
  const achados: number[] = []
  for (let d = 0; d < 21 && achados.length < quantas; d++) {
    for (const ms of horariosDoDia(desde + d * DIA)) {
      if (achados.length < quantas && filtro(ms) && livre(ms, agora)) achados.push(ms)
    }
  }
  return achados
}

function rotuloDoDia(ms: number, agora: Date): string {
  const dias = Math.round((diaDeSantos(ms) - diaDeSantos(agora.getTime())) / DIA)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  const l = local(ms)
  const nome = NOME_DO_DIA[l.getUTCDay()]
  return dias < 7 ? nome : `${nome} (${l.getUTCDate()}/${l.getUTCMonth() + 1})`
}

function rotuloDaHora(ms: number): string {
  const l = local(ms)
  const m = l.getUTCMinutes()
  return `${l.getUTCHours()}h${m ? String(m).padStart(2, '0') : ''}`
}

const rotuloDoHorario = (ms: number, agora: Date) => `${rotuloDoDia(ms, agora)} às ${rotuloDaHora(ms)}`

function periodoDe(par: number[]): string {
  if (par.every((ms) => horaLocal(ms) < 12)) return ' de manhã'
  if (par.every((ms) => horaLocal(ms) >= 12)) return ' à tarde'
  return ''
}

/** "amanhã de manhã, 8h ou 9h" (mesmo dia) ou "hoje às 16h40 ou amanhã às 8h". */
function textoDeDuas(par: number[], agora: Date): string {
  const [a, b] = par
  const dia = rotuloDoDia(a, agora)
  if (dia === rotuloDoDia(b, agora)) return `${dia}${periodoDe(par)}, ${rotuloDaHora(a)} ou ${rotuloDaHora(b)}`
  return `${rotuloDoHorario(a, agora)} ou ${rotuloDoHorario(b, agora)}`
}

/** "Amanhã de manhã tenho 8h ou 9h." ou "Tenho hoje às 16h40 ou amanhã às 8h." */
function fraseDeDuas(par: number[], agora: Date): string {
  const [a, b] = par
  const dia = rotuloDoDia(a, agora)
  if (dia === rotuloDoDia(b, agora)) return `${maiuscula(dia)}${periodoDe(par)} tenho ${rotuloDaHora(a)} ou ${rotuloDaHora(b)}.`
  return `Tenho ${rotuloDoHorario(a, agora)} ou ${rotuloDoHorario(b, agora)}.`
}

/** Os dois horarios que o robo oferece: a oferta anterior se ainda livre, senao os dois primeiros livres. */
export function opcoesDeHorario(agora: Date): { texto: string; opcoes: [string, string]; em: [string?, string?] } {
  const par = ofertaDaVez?.length === 2 && ofertaDaVez.every((ms) => livre(ms, agora)) ? ofertaDaVez : vagas(agora)
  if (par.length === 2) {
    return {
      texto: textoDeDuas(par, agora),
      opcoes: [rotuloDoHorario(par[0], agora), rotuloDoHorario(par[1], agora)],
      em: [new Date(par[0]).toISOString(), new Date(par[1]).toISOString()],
    }
  }
  // Grade vazia ou cheia por 3 semanas: oferta solta e a equipe combina.
  const proximo = proximoDiaUtil(agora)
  return { texto: `${proximo} de manhã ou à tarde`, opcoes: [`${proximo} de manhã`, `${proximo} à tarde`], em: [] }
}

/** Regua de retomada, ajustada em Preferencias (tabela configuracoes, chave "retomada"). */
export interface ConfigDaRetomada {
  ligado: boolean
  tentativas: number
  intervaloDias: number
  /** hora de cada tentativa, "HH:MM" de Santos; a lista se repete se for menor */
  horarios: string[]
  /** horas minimas de silencio antes da 1a tentativa */
  esperaMinHoras: number
  /** so comeca a retomar quem parou ha ate X dias */
  ateDias: number
}

/** Lucas (22/10/2026): 3 a 4 vezes em horarios diferentes; Edu: 4, uma por dia, a 1a as 8h. */
export const RETOMADA_PADRAO: ConfigDaRetomada = { ligado: true, tentativas: 4, intervaloDias: 1, horarios: ['08:00', '12:30', '18:30', '10:00'], esperaMinHoras: 8, ateDias: 7 }

/** Modelo da Meta (Utilidade, pt_BR) para fora da janela de 24h: {{1}} nome, {{2}} a pergunta. */
export const MODELO_RETOMADA = 'retomar_atendimento'
export const TEXTO_MODELO_RETOMADA = 'Olá, {{1}}. Atualização do seu atendimento de BPC/LOAS com o escritório Cunha Batista: para seguir, falta só esta resposta: {{2}} É só responder por aqui.'

/**
 * Quando sai a proxima tentativa (ms UTC) ou null se a regua acabou. A 1a vai
 * no primeiro horario depois da espera minima; as outras, `intervaloDias`
 * depois da anterior, cada uma no seu horario. Domingo passa para segunda.
 */
export function proximaRetomada(cfg: ConfigDaRetomada, silencioDesde: string, feitas: number, ultimaEm?: string): number | null {
  if (!cfg.ligado || feitas >= cfg.tentativas || !cfg.horarios.length) return null
  const inicio = minutos(cfg.horarios[feitas % cfg.horarios.length]) * 60000 + 3 * HORA
  const silencio = new Date(silencioDesde).getTime()
  let dia: number
  if (feitas === 0) {
    dia = diaDeSantos(silencio)
    while (dia + inicio < silencio + cfg.esperaMinHoras * HORA) dia += DIA
  } else dia = diaDeSantos(new Date(ultimaEm ?? silencioDesde).getTime()) + Math.max(1, cfg.intervaloDias) * DIA
  while (new Date(dia).getUTCDay() === 0) dia += DIA
  return dia + inicio
}

/** Texto livre (dentro das 24h): muda a cada tentativa; a ultima avisa que pausa. */
export function mensagemDeRetomada(tentativa: number, total: number, nome: string | undefined, pergunta: string): string {
  const n = primeiroNome(nome)
  const oi = n ? `Oi, ${n}!` : 'Oi!'
  if (tentativa >= total && total > 1) return `${n ? `${n}, vou` : 'Vou'} deixar seu atendimento do BPC em pausa por enquanto. Quando quiser seguir, é só responder aqui. ${pergunta}`
  const frases = [
    `${oi} Aqui é a Mary, da CB&AA. Vamos continuar seu atendimento do BPC? ${pergunta}`,
    `${oi} Seu atendimento do BPC continua aberto aqui. ${pergunta}`,
    `${oi} Ainda dá para seguir com seu atendimento do BPC. ${pergunta}`,
  ]
  return frases[(tentativa - 1) % frases.length]
}

/**
 * Retomada (Lucas e Edu, 22/10/2026): a familia parou de responder e o robo
 * volta a chamar repetindo a pergunta em que ela parou, para ela so responder
 * e a conversa seguir dali. Null quando o robo nao espera nada dela.
 * `ofertas`: os horarios oferecidos de novo, para gravar no estado.
 */
export function perguntaParaRetomar(estado: EstadoRobo, agora: Date, agenda: AgendaDaVez = {}): { texto: string; ofertas?: string[] } | null {
  if (estado.pausado) return null
  const p = estado.ultimaPergunta === 'retomar' ? estado.voltarPara : estado.ultimaPergunta
  if (!p) return null
  gradeDaVez = agenda.grade ?? GRADE_PADRAO
  ocupadosDaVez = (agenda.ocupados ?? []).map((o) => new Date(o).getTime()).filter((n) => !Number.isNaN(n))
  ofertaDaVez = estado.ofertas?.map((o) => new Date(o).getTime()) ?? null
  if (p === 'horario') {
    const { texto, em } = opcoesDeHorario(agora)
    return { texto: `Para marcar com o Dr. André: ${texto} é melhor para você?`, ofertas: em.filter((e): e is string => Boolean(e)) }
  }
  return { texto: textoDaPergunta(p, estado.ficha, agora) }
}

/** Para a tela Agenda: os proximos horarios que o robo ofereceria com esta grade. */
export function proximosLivres(agora: Date, agenda: AgendaDaVez, quantas = 6): string[] {
  gradeDaVez = agenda.grade ?? GRADE_PADRAO
  ocupadosDaVez = (agenda.ocupados ?? []).map((o) => new Date(o).getTime()).filter((n) => !Number.isNaN(n))
  ofertaDaVez = null
  return vagas(agora, undefined, quantas).map((ms) => new Date(ms).toISOString())
}

const DIAS: [string, string, number][] = [
  ['hoje', 'hoje', -1],
  ['amanha', 'amanhã', -2],
  ['segunda', 'segunda', 1],
  ['terca', 'terça', 2],
  ['quarta', 'quarta', 3],
  ['quinta', 'quinta', 4],
  ['sexta', 'sexta', 5],
]

/** Escolha marcada (`quando`) ou outros horarios a oferecer (`outras`). */
type Leitura = { quando: string; em?: string } | { outras: string }

/**
 * Horario so vale quando a pessoa escolhe (C02). "Amanha nao posso" tira o
 * dia; pergunta, "sim" solto ou duvida devolvem null e o robo pergunta de novo.
 * Dia, periodo ou hora fora da oferta: procura na grade. Livre, marca; tomado
 * ou fora da grade, oferece os dois livres mais perto do que a pessoa pediu.
 */
function lerHorario(t: string, agora: Date): Leitura | null {
  const { opcoes, em } = opcoesDeHorario(agora)
  if (/\b(a primeira|o primeiro|primeira opcao|tanto faz|qualquer um|qualquer uma|qualquer horario|o que for melhor|o que tiver)\b/.test(t)) return { quando: opcoes[0], em: em[0] }
  if (/\b(segunda opcao|o segundo|a ultima|o ultimo)\b/.test(t)) return { quando: opcoes[1], em: em[1] }
  const negado = (p: string) => new RegExp(`\\b${p}\\b[^,.;!?]{0,20}\\bn(ao)?\\b|\\bn(ao)?\\b[^,.;!?]{0,15}\\b${p}\\b`).test(t)
  const dito = DIAS.find(([d]) => new RegExp(`\\b${d}\\b`).test(t) && !negado(d))
  const periodo = ['manha', 'tarde'].find((p) => new RegExp(`\\b${p}\\b`).test(t) && !negado(p))
  const h = t.match(/\b(\d{1,2})h(\d{2})\b|\b(\d{1,2})(?::(\d{2}))?\s?(?:h|hs|horas?)\b|\bas (\d{1,2})(?::(\d{2}))?\b|^(?:pode ser )?(?:as )?(\d{1,2})(?::(\d{2}))?$/)
  let hora: number | undefined
  let minuto: number | undefined
  if (h) {
    let n = Number(h[1] ?? h[3] ?? h[5] ?? h[7])
    const m = h[2] ?? h[4] ?? h[6] ?? h[8]
    // "as 2 da tarde", "3h": de tarde e o que faz sentido num escritorio.
    if (n >= 1 && n <= 6) n += 12
    if (n >= 7 && n <= 20) {
      hora = n
      minuto = m === undefined ? undefined : Number(m)
    }
  }
  if (!dito && !periodo && hora === undefined) return null

  const hoje0 = diaDeSantos(agora.getTime())
  let dia0: number | undefined
  if (dito) {
    const alvo = dito[2]
    if (alvo === -1) dia0 = hoje0
    else if (alvo === -2) dia0 = hoje0 + DIA
    else dia0 = hoje0 + ((alvo - new Date(hoje0).getUTCDay() + 7) % 7 || 7) * DIA
  }
  // "8h" e 8h em ponto; "13h" vale 13h40 so quando a grade nao tem 13h em ponto.
  const minutoCasa = (ms: number) => {
    const min = local(ms).getUTCMinutes()
    if (minuto !== undefined) return min === minuto
    return min === 0 || !horariosDoDia(diaDeSantos(ms)).some((x) => horaLocal(x) === hora && local(x).getUTCMinutes() === 0)
  }
  const casa = (ms: number) =>
    (hora === undefined || (horaLocal(ms) === hora && minutoCasa(ms))) &&
    (!periodo || (periodo === 'manha' ? horaLocal(ms) < 12 : horaLocal(ms) >= 12)) &&
    (dia0 === undefined || diaDeSantos(ms) === dia0)

  const oferecidos = em.filter((e): e is string => Boolean(e)).map((e) => new Date(e).getTime())
  if (!oferecidos.length) {
    // Sem grade livre: guarda o que a pessoa disse e a equipe combina.
    const per = periodo === 'manha' ? ' de manhã' : periodo === 'tarde' ? ' à tarde' : ''
    const dia = dito?.[1] ?? proximoDiaUtil(agora)
    return { quando: hora === undefined ? `${dia}${per}` : `${dia} às ${hora}h${minuto ? String(minuto).padStart(2, '0') : ''}` }
  }
  const marcar = (ms: number): Leitura => ({ quando: rotuloDoHorario(ms, agora), em: new Date(ms).toISOString() })
  const oferecer = (par: number[], antes = ''): Leitura => {
    ofertaDaVez = par
    return { outras: juntar(antes, fraseDeDuas(par, agora), 'Qual fica melhor?') }
  }

  const naOferta = oferecidos.filter(casa)
  if (naOferta.length === 1) return marcar(naOferta[0])
  // Pediu o que ja foi oferecido ("de manha" com 8h e 9h na mesa): nao escolheu.
  if (naOferta.length === 2) return null

  // So a hora ("9") com a oferta de quinta na mesa: e quinta, nao amanha.
  if (hora !== undefined && dia0 === undefined) {
    const diaDaOferta = diaDeSantos(oferecidos[0])
    const mesmoDia = vagas(agora, diaDaOferta, 1, (ms) => casa(ms) && diaDeSantos(ms) === diaDaOferta)
    if (mesmoDia.length) return marcar(mesmoDia[0])
  }
  // Fora da oferta: a grade de ate 3 semanas, ou so o dia dito.
  const livres = vagas(agora, dia0 ?? hoje0, dia0 === undefined ? 2 : 6, casa).filter((ms) => dia0 === undefined || diaDeSantos(ms) === dia0)
  if (hora !== undefined) {
    if (livres.length) return marcar(livres[0])
    const doDia = dia0 === undefined ? [] : vagas(agora, dia0, 2).filter((ms) => diaDeSantos(ms) === dia0)
    const par = doDia.length === 2 ? doDia : vagas(agora, dia0 ?? hoje0)
    return par.length === 2 ? oferecer(par, 'Esse horário não está livre.') : null
  }
  if (livres.length >= 2) return oferecer(livres.slice(0, 2))
  if (livres.length === 1) {
    const outro = vagas(agora, hoje0, 3).find((ms) => ms !== livres[0])
    return outro === undefined ? marcar(livres[0]) : oferecer([livres[0], outro].sort((a, b) => a - b))
  }
  const depois = vagas(agora, dia0 ?? hoje0)
  if (depois.length < 2) return null
  const per = periodo === 'manha' ? ' de manhã' : periodo === 'tarde' ? ' à tarde' : ''
  const qual = dito ? `${maiuscula(dito[1])}${per}` : maiuscula(per.trim())
  return oferecer(depois, `${qual} não tenho horário livre.`)
}

// ---------------------------------------------------------------------------
// Textos aprovados (Resposta ao Raio-X e mensagem do Lucas, 21/10/2026)
// ---------------------------------------------------------------------------

/** Texto 1: a Mary se apresenta uma vez, na primeira resposta (sem "automatico": Lucas, 21/10/2026). */
export const ABERTURA = 'Oi! Aqui é a Mary, da CB&AA - Cunha, Batista & Advogados Associados (OAB/SP 9.894).'
/** Texto 2: informativo, sem pedir autorizacao, antes da 1a pergunta de saude. */
export const AVISO_SAUDE = 'Antes de seguir: o que você contar sobre saúde fica só com a equipe do escritório, para analisar o seu caso.'
/** Texto 3: pergunta juridica vira duvida anotada para o advogado. */
export const TEXTO_JURIDICO = 'Essa resposta depende do caso, e quem avalia é o advogado. Já anotei sua pergunta para ele.'
const SENHA = 'Não passe sua senha para ninguém, nem para nós: ela é pessoal. A equipe orienta tudo sem ela.'
const ARQUIVO = 'Recebi. Não precisa mandar documento por aqui agora: a equipe pede na hora certa. Me conta por escrito?'
const AUDIO = 'Recebi seu áudio, mas não consegui ouvir direito. Me conta por escrito?'
const HONORARIOS_COM_LAUDO = 'São 3 salários mínimos e 30% dos atrasados. Você só paga no final, se o benefício for concedido. Posso pedir para a equipe te chamar e explicar os detalhes?'
const HONORARIOS_SEM_LAUDO = 'São R$ 1.000 fixos, mais 3 salários mínimos e 30% dos atrasados. Você só paga no final, se o benefício for concedido. Posso pedir para a equipe te chamar e explicar os detalhes?'
const HONORARIOS_IDOSO = 'São 3 salários mínimos e 30% dos atrasados. Você só paga no final, se o benefício for concedido. Posso pedir para a equipe te chamar e explicar?'
const HONORARIOS_DEPOIS_DO_LAUDO = 'A equipe explica os valores depois de ver o laudo.'
const TEXTO_PRAZO =
  'Quando o INSS nega, o prazo para recorrer costuma ser de 30 dias, contados da ciência da decisão. Vou passar seu caso para a equipe agora, como prioridade.'

/** Tabela e parcelas juntas: nunca as parcelas sem os 30% dos atrasados (F07). */
function comParcelas(h: string): string {
  if (!/salários mínimos/.test(h)) return h
  return `${h.replace(/ Posso pedir.*$/, '')} Os 3 salários mínimos podem ser divididos em até 6 vezes. Posso pedir para a equipe te chamar e explicar os detalhes?`
}
// "Se o beneficio for concedido" no lugar de "depois que o beneficio sair" (D6).
const PARCELAMENTO = 'Dá sim: os 3 salários mínimos podem ser divididos em até 6 vezes, e só começam depois, se o benefício for concedido. Posso pedir para a equipe te chamar?'
const GOLPE_TEXTO =
  'Somos o escritório Cunha, Batista & Advogados, OAB/SP 9.894, com sede em Santos/SP, e atendemos famílias em todo o Brasil. Pode conferir no site https://cunhabatistaadv.com/ e no Instagram @cunhabatistaadvogados. Nós nunca pedimos senha, e tudo fica por escrito no contrato. Quer que eu continue?'
const GOLPE_IDOSO =
  'O seu cuidado está certo. Somos o escritório Cunha, Batista & Advogados, OAB/SP 9.894, em Santos, e atendemos todo o Brasil. Nós nunca pedimos senha, e tudo fica por escrito no contrato.'

/** Preco: a tabela pelo laudo; "nao sei" nao recebe valor nenhum (D1, C06). */
function honorarios(f: Ficha): string | null {
  if (ehIdoso(f)) return HONORARIOS_IDOSO
  if (temLaudo(f)) return HONORARIOS_COM_LAUDO
  if (f.laudo === 'sem') return f.faseMedica === 'recusou' ? HONORARIOS_COM_LAUDO : HONORARIOS_SEM_LAUDO
  if (f.laudo === 'nao_sei') return HONORARIOS_DEPOIS_DO_LAUDO
  return null
}

// ---------------------------------------------------------------------------
// Desvios: valem em qualquer etapa, respondem e nao entram no roteiro
// ---------------------------------------------------------------------------

type Desvio =
  | { tipo: 'responde'; texto: string; duvida?: string }
  | { tipo: 'pergunta'; texto: string; proxima: Pergunta }
  | { tipo: 'encaminha'; texto: string; motivo: string }
  | { tipo: 'encerra'; texto: string; motivo: string }
  | { tipo: 'pendencia'; texto: string; pendencia: string; dias: number; proxima: Pergunta }
  | { tipo: 'preco'; parcelar?: boolean }

const DESESPERO = /\b(desesperad[oa]|socorro|sem remedio|sem comida|passando fome|nao tenho o que comer|nao temos o que comer|sem ter o que comer|nao aguento mais)\b/
const LIGAR = /\b(me liga|pode(m)? (me )?ligar|quero ligar|liga(r)? pra mim|me chama no telefone|prefiro (por )?telefone|prefiro ligacao)\b/
// "Prefiro conversar com um atendente" e todas as variacoes encaminham (C08).
const PEDIU_PESSOA =
  /\b(falar|conversar|ser atendid[oa]|atendimento) com (um |uma |o |a |algum |alguma )?(pessoa|alguem|atendente|humano|ser humano|advogad\w*|doutor\w*|dr|dra|funcionari\w*)\b|\b(quero|prefiro|gostaria de|preciso de|pode ser) (um |uma )?(atendente|humano|ser humano|pessoa de verdade|pessoa real)\b|\bpessoa de verdade\b|\bpessoa real\b|\balguem da equipe\b|\b(um|uma) atendente\b|^(atendente|humano)\W*$/
const NAO_CONSEGUIU_ASSINAR = /\b(nao consegui assinar|nao consigo assinar|link nao abre|link nao funciona|nao abre o link|nao abriu o link)\b/
const ASSINOU = /\b(ja assinei|assinei)\b/
const CLIENTE_ANTIGO =
  /\b(ja sou cliente|sou cliente (de voces|do escritorio|dai|ai)|(ja e|e) cliente (de voces|do escritorio)|meu processo|processo (da|do) (minha|meu)|andamento (do|da) (meu |minha )?(processo|acao)|ja tenho (um )?processo|ja (fechei|fechamos) com voces|minha advogada|meu advogado (ai|do escritorio)|(a )?acao (da|do) (minha|meu)|gostaria (apenas )?de noticias|noticias (do|da|sobre) (o |a )?(processo|acao|caso)|alguma novidade (do|da|sobre) (o |a )?(processo|acao|caso))\b/
const TRABALHISTA =
  /\b(demitid[oa]|mandad[oa] embora|justa causa|rescisao|verbas rescisorias|fgts|trabalhista|patrao|patroa|horas extras|salario atrasado|salarios atrasados|nao (me )?pagaram (meu salario|minhas verbas|o salario)|assedio no trabalho|processar a empresa)\b/
const DESISTIU = /\b(nao quero mais(?! (esperar|ficar|demorar))|desisti|desisto|nao tenho (mais )?interesse|perdi o interesse|pode encerrar|nao preciso mais|nao vou querer|deixa pra la)\b/
const MIL_DE_QUE = /\b(1\.?000|mil reais)\b.*\b(de que|pra que|para que|por que|porque)\b|\bparte fixa\b/
// Pergunta sobre o medico, a consulta ou o laudo nunca recebe a tabela (C04).
const MEDICO_PAGO =
  /\b(medico|consulta|psiquiatra|videochamada)\b.{0,30}\b(pag[ao]|pagar|gratis|gratuit[oa]|de graca|custa|cobra|valor|preco)\b|\b(pag[ao]|pagar|gratis|gratuit[oa]|de graca|custa|cobra|valor|preco)\b.{0,20}\b(medico|consulta|psiquiatra)\b|\b(quanto custa|preco|valor) (do|o|um|esse) laudo\b|\blaudo (e|eh) (pago|gratis)\b/
// Parcelamento so quando a frase fala de pagar o escritorio em vezes (C03).
const PARCELAR =
  /\bparcel\w*|\b(pagar|pago|paga|pagamento) (em vezes|parcelado|em parcelas)\b|\bem (quantas|\d+) vezes\b|\bdividir (o pagamento|os honorarios|o valor|em vezes|esse valor|isso)\b|\b(da|daria|posso|pode|consigo) (pra |para )?dividir\b|\bmuito de uma vez\b/
// "Tem desconto?" recebe a resposta do "ta caro": nunca desconto pelo robo.
const CARO = /\b(caro|carissimo|nao (tenho|consigo|vou conseguir|da) (como |pra |para )?pagar|nao tenho dinheiro (pra|para) pagar|nao posso pagar|sem condicoes de pagar|muito dinheiro|desconto|abatimento|mais barato|fazer por menos)\b/
const QUANDO_PAGA = /\b(quando (eu )?(pago|vou pagar|tenho que pagar|e o pagamento)|(pagar|pago|paga)\b[^.?!]{0,20}\b(adiantado|antecipado|antes)\b)/
// "Pra que voces querem saber da renda?" (familia F02): a resposta da privacidade.
const POR_QUE_PERGUNTA = /\b((pra|para) que|por que|porque) (voce|voces) (quer|querem|precisa|precisam) (saber|disso)\b|\b(pra|para) que (serve|voces querem) (isso|essa pergunta|saber)\b/
// "Valor" so e preco junto de "de voces", "cobram", "honorario" (C05).
const PRECO =
  /\b(quanto (custa|cobra|cobram|fica|vou pagar|sai|seria|eu pago|voces)|quanto e(?! o (beneficio|bpc|loas))\b|qual (o |e o |seria o )?(valor|preco)\b|valor (dos honorarios|de voces|que voces cobram|do servico|do atendimento)|preco|honorario\w*|cobram|tem (algum )?custo|(e|eh) pago\b|(e|eh) gratis|(e|eh) gratuito|de graca|vou ter que pagar|precisa pagar)\b/
const COMO_ASSINA = /\b(como (funciona|e|faz) (a |pra )?assina\w*|como (eu )?assino|assinatura (digital|eletronica|pelo celular)|como (funciona|e) o contrato|como recebo o contrato)\b/
const SEGURO_ASSINAR = /\b(seguro assinar|assinar pelo celular (e|eh) seguro|tem validade)\b/
const QUAIS_DOCUMENTOS = /\b(quais (os )?documentos|que documentos|documentos (precisa|necessarios|preciso))\b/
const OUTRO_ESTADO = /\b(outro estado|outra cidade|muito longe|fora de sao paulo|atende(m)? (em|no|na|fora|outros?|longe|online|pela internet))\b/
const DECISAO_FAMILIA =
  /\b(falar|ver|conversar|decidir|combinar|consultar|resolver) com (o |a |os |as )?(meu|minha|meus|minhas) (marido|esposa|esposo|mulher|companheir\w*|irmaos|irmas|filhos|filhas|familia)\b|\bpreciso ver com\b/
const PRIVACIDADE = /\b(meus dados|o que (voces )?fazem com (os|meus)|privacidade|lgpd|seguro passar (meus|os) dados|vao vender)\b/
const BOLSA_PERDE = /\bbolsa familia\b.*\b(pode|atrapalha|perde|perco|perder|corta|cortar|tira|tirar|cancela|cancelar|continua|junto)\b|\b(pode|atrapalha|perde|perco|perder|corta|cortar|tira|tirar|cancela|cancelar)\b.*\bbolsa familia\b/
const CONTRIBUIU =
  /\b(nunca (contribuiu|contribui|contribuimos|pagou (o )?inss|paguei (o )?inss|trabalhou (registrad\w*|de carteira|fichad\w*)|trabalhei (registrad\w*|de carteira|fichad\w*))|nao contribui\w*|sem contribuicao|precisa (ter )?contribuido|precisa ter pago)\b/
const TREZE = /\b(decimo terceiro)\b|\b13\s*(o|º)\b|\btem 13\s*\?/
const DEIXA_PENSAO = /\b(deixa pensao|fica (a |uma )?pensao|vira pensao|gera pensao|se (ela|ele|eu) (falecer|morrer|faltar))\b/
const CASA_PROPRIA = /\b(casa propria|tem (um )?imovel|tem (um )?terreno)\b/
const CARRO = /\b(carro|moto|veiculo)\b/
const APOSENTADORIA_CONTA = /\b(aposentadoria|aposentad\w*|bpc|loas|pensao)\b.*\b(conta|entra|atrapalha|impede|soma)\b/
const ACAMADO = /\b(acamad[oa]|de cama|nao (consegue|pode|consigo) (ir|sair|andar)|nao sai de casa|cadeira de rodas)\b/
const CELULAR = /\b(nao sabe (usar|mexer)|nao sei (usar|mexer)|nao entende de celular|nao mexe (no|com) celular)\b/
const SOBRE_BENEFICIO =
  /\b(o que (e|eh) (o |esse |a )?(bpc|loas|beneficio)|como funciona (o |esse )?(bpc|loas|beneficio)|quanto (e|eh|paga|vale) (o |esse )?(bpc|loas|beneficio)|de quanto (e|eh) (o )?(bpc|loas|beneficio)|quanto (ele|ela|eu) (vai|vou|iria) receber)\b/
// So vale com "?" (ou "ne?"): "tem direito?", "laudo vence?", "depressao conta?" (D3, C01).
const JURIDICA =
  /\b(direito|vence|venceu|validade|ainda vale|vale ainda|vale|serve|conta|contam|consegue|conseguir|consigo|da pra receber|pode receber|receber junto|receber os dois|receber|recebe|acumula|perde|perco|precisa (de|ter) laudo|precisa mesmo|tem chance|chance|aprova\w*|demora|quanto tempo|atrasad\w*|retroativ\w*|da certo|entra na conta|ainda da tempo|tem prazo|prazo|recorrer|recurso|automatico|dar entrada|da entrada|entrar com|pedir de novo|pode pedir|desconta|esperar fazer|vale a pena|da ou nao da)\b/

function ehRobo(t: string, pergunta: boolean): boolean {
  // "e ia comecar a fono" nao e a pergunta "e IA?" (C09).
  if (/\b(voce e|vc e|voce eh|vc eh|to falando com|estou falando com|falo com|isso e|e um|e uma|eh um|eh uma)\s+(um |uma )?(robo|bot|maquina|ia|inteligencia artificial|atendente virtual|gravacao|chatbot)\b/.test(t)) return true
  return pergunta && /\b(robo|bot|chatbot|maquina|inteligencia artificial)\b/.test(t)
}

function ehGolpe(t: string): boolean {
  // "E verdade que precisa de laudo?" e pergunta, nao desconfianca (C29).
  return /\b(golpe|confiave(l|is)|fraude|enganacao|picaretagem|sao de onde|voces sao de onde|quem sao voces|sao quem|existe mesmo|isso e real)\b/.test(t) || /^(isso )?(e|eh) (verdade|serio)\W*$/.test(t)
}

function desvio(t: string, original: string, f: Ficha, agora: Date, perguntaFeita: Pergunta | null = null): Desvio | null {
  const s = sobre(f)
  const { texto: horarios } = opcoesDeHorario(agora)
  const idoso = ehIdoso(f) || f.area === 'idoso'
  const pergunta = ehPergunta(original, t)

  if (/^\[audio recebido\]/.test(t)) return { tipo: 'responde', texto: AUDIO }
  if (/^\[arquivo recebido\]/.test(t)) return { tipo: 'responde', texto: ARQUIVO }
  // "Quer que eu te passe o login do meu gov.br?" tambem e a senha (familia F09).
  if (/\bsenha\b|\b(login|acesso|entrar|usuario)\b[^.?!]{0,30}\b(gov ?\.?br|meu inss|banco)\b|\b(gov ?\.?br|meu inss)\b[^.?!]{0,20}\b(login|acesso|usuario)\b/.test(t))
    return { tipo: 'responde', texto: SENHA }
  if (DESESPERO.test(t)) return { tipo: 'encaminha', texto: 'Sinto muito por isso. Vou pedir para a equipe te chamar agora.', motivo: 'família em situação difícil' }
  if (LIGAR.test(t)) return { tipo: 'encaminha', texto: 'Combinado, já aviso a equipe agora.', motivo: 'pediu para ligar' }
  // "Gostaria de falar com um advogado previdenciario" e o botao do site, nao pedido de pessoa.
  // "Prefiro falar com o advogado antes de contrato" e recusa do contrato (texto 12), nao pedido de pessoa.
  const recusaContrato = perguntaFeita === 'contrato_ok' && /\b(antes|contrato|assinar)\b/.test(t)
  if (PEDIU_PESSOA.test(t) && !/advogad[oa] previdenciari/.test(t) && !recusaContrato) return { tipo: 'encaminha', texto: 'Claro, já aviso a equipe.', motivo: 'pediu pessoa' }
  if (NAO_CONSEGUIU_ASSINAR.test(t)) return { tipo: 'encaminha', texto: 'Sem problema, vou pedir para a equipe te ajudar agora.', motivo: 'não conseguiu assinar o contrato' }
  if (ASSINOU.test(t)) return { tipo: 'responde', texto: 'Agora a equipe monta o pedido no INSS. Qualquer novidade a gente te avisa por aqui. Ficou alguma dúvida?' }
  if (CLIENTE_ANTIGO.test(t)) return { tipo: 'encaminha', texto: 'Claro, vou avisar a equipe agora para te atender sobre o seu processo.', motivo: 'cliente antigo (processo em andamento)' }
  if (TRABALHISTA.test(t)) return { tipo: 'encaminha', texto: 'Esse assunto a equipe do escritório atende por outra frente. Vou avisar agora.', motivo: 'assunto trabalhista' }
  if (DESISTIU.test(t)) return { tipo: 'encerra', texto: 'Tudo bem, obrigada pelo contato. Se mudar de ideia, é só chamar aqui.', motivo: 'desistiu' }
  if (ehRobo(t, pergunta)) return { tipo: 'responde', texto: 'Sou o atendimento automático da equipe CB&AA, e uma pessoa assume já já. Posso continuar?' }
  if (MIL_DE_QUE.test(t))
    return { tipo: 'encaminha', texto: `É a parte fixa do contrato; a equipe detalha tudo por escrito antes de assinar. ${maiuscula(horarios)} é melhor para te chamarem?`, motivo: 'Dúvida sobre o valor fixo' }
  // Logo depois da oferta do medico, "quanto custa isso?" e sobre a consulta: nunca a tabela (F06).
  const sobreOMedico = perguntaFeita === 'fase_medica' || perguntaFeita === 'fase_medica_recusou'
  if (MEDICO_PAGO.test(t) || (sobreOMedico && PRECO.test(t)))
    return { tipo: 'encaminha', texto: 'Isso a equipe explica direitinho, como funciona a consulta.', motivo: 'Perguntou sobre a consulta com o médico' }
  // Preco e parcelamento juntos: a tabela inteira e depois as parcelas (F07).
  if (PARCELAR.test(t) && PRECO.test(t)) return { tipo: 'preco', parcelar: true }
  if (PARCELAR.test(t)) return { tipo: 'encaminha', texto: PARCELAMENTO, motivo: 'Pediu parcelamento' }
  if (CARO.test(t)) return { tipo: 'encaminha', texto: 'Entendo. Isso a equipe combina com você, com calma. Manhã ou tarde é melhor para te chamarem?', motivo: 'Objeção de preço' }
  if (QUANDO_PAGA.test(t)) return { tipo: 'responde', texto: 'Os honorários, só no final, se o benefício for concedido. A equipe explica os detalhes por escrito antes de você assinar.' }
  if (SOBRE_BENEFICIO.test(t))
    return {
      tipo: 'responde',
      texto: idoso
        ? 'O BPC é um salário mínimo por mês para idoso de 65 anos ou mais com renda baixa na casa. Em regra, não precisa ter contribuído.'
        : 'O BPC é um salário mínimo por mês, pago pelo INSS, para pessoa com deficiência (de qualquer idade) ou idoso de 65 anos ou mais, quando a renda da família é baixa. Não exige ter contribuído.',
    }
  if (PRECO.test(t)) return { tipo: 'preco' }
  if (COMO_ASSINA.test(t)) return { tipo: 'responde', texto: 'O contrato chega aqui no seu WhatsApp, por um link do D4Sign. Você abre no celular, confere e assina com um clique. Não precisa imprimir nada.' }
  if (SEGURO_ASSINAR.test(t)) return { tipo: 'responde', texto: 'É. O D4Sign é uma plataforma de assinatura digital com validade legal, a mesma usada por bancos. Posso continuar?' }
  if (QUAIS_DOCUMENTOS.test(t)) return { tipo: 'responde', texto: 'Foto do RG (frente e verso), CPF, um comprovante de endereço e o CadÚnico. A equipe te pede na hora certa.' }
  if (ehGolpe(t)) return { tipo: 'responde', texto: idoso && f.para === 'proprio' ? GOLPE_IDOSO : GOLPE_TEXTO }
  if (OUTRO_ESTADO.test(t))
    return { tipo: 'pergunta', texto: `Atende sim. O atendimento é online e o pedido no INSS vale para todo o Brasil. ${textoDaPergunta('cidade', f, agora)}`, proxima: 'cidade' }
  if (DECISAO_FAMILIA.test(t))
    return {
      tipo: 'pendencia',
      texto: `Claro, é uma decisão ${idoso ? 'da família' : 'de vocês'}. Quer que eu mande um resumo do que falamos para ${idoso ? 'vocês verem' : 'verem'} juntos? Te chamo em 3 dias.`,
      pendencia: 'decisão em família',
      dias: 3,
      proxima: 'resumo_familia',
    }
  if (POR_QUE_PERGUNTA.test(t)) return { tipo: 'responde', texto: 'Só a equipe do escritório vê, para analisar o seu caso. A política de privacidade está no nosso site.' }
  if (PRIVACIDADE.test(t)) return { tipo: 'responde', texto: 'Só a equipe do escritório vê, para analisar o seu caso. A política de privacidade está no nosso site. Posso continuar?' }
  if (BOLSA_PERDE.test(t)) return { tipo: 'responde', texto: 'Não precisa cancelar nada. O advogado confere o seu caso.', duvida: extrairDuvida(original) }
  if (CONTRIBUIU.test(t))
    return {
      tipo: 'responde',
      texto: idoso ? 'Para o BPC do idoso, em regra, não precisa ter contribuído. O que conta é a idade e a renda da casa.' : 'Para o BPC, em regra, não precisa ter contribuído. O advogado confere o seu caso.',
    }
  if (TREZE.test(t)) return { tipo: 'responde', texto: 'Não tem 13º. São 12 pagamentos de um salário mínimo por ano.' }
  if (DEIXA_PENSAO.test(t)) return { tipo: 'responde', texto: 'O BPC não deixa pensão. Isso o advogado explica com calma na conversa.' }
  if (idoso) {
    if (CASA_PROPRIA.test(t)) return { tipo: 'responde', texto: 'Ter a casa onde mora, em regra, não impede. O advogado confere o conjunto.' }
    if (CARRO.test(t)) return { tipo: 'responde', texto: 'Um bem simples do dia a dia, em regra, não impede. O advogado avalia.' }
    if (pergunta && APOSENTADORIA_CONTA.test(t))
      return { tipo: 'responde', texto: 'Em regra, aposentadoria de até um salário mínimo de quem tem 65 anos ou mais não entra na conta da renda. O advogado confere.' }
    if (ACAMADO.test(t)) return { tipo: 'responde', texto: 'Não precisa sair de casa para falar com a gente; o atendimento é por aqui e por telefone.' }
    if (CELULAR.test(t)) return { tipo: 'responde', texto: `Sem problema. Alguém da família pode falar por ${f.para === 'proprio' ? 'você' : s.ele} e a gente explica tudo.` }
  }
  if (pergunta && JURIDICA.test(t)) return { tipo: 'responde', texto: TEXTO_JURIDICO, duvida: extrairDuvida(original) }
  return null
}

/** A frase da pergunta, nao os primeiros 200 caracteres do textao (F07). */
function extrairDuvida(original: string): string {
  const frases = original.trim().split(/(?<=[.!?])\s+/)
  const perguntas = frases.filter((f) => /\?/.test(f) || ehPergunta(f, normalizar(f)) || JURIDICA.test(normalizar(f)))
  return (perguntas.length ? perguntas.join(' ') : original.trim()).slice(0, 300)
}

export function resumoDaFicha(f: Ficha): string {
  const s = sobre(f)
  const linhas: string[] = []
  if (f.para) linhas.push(`Para: ${f.para === 'proprio' ? 'o(a) próprio(a)' : s.quem}${f.idade !== undefined ? `, ${f.idade} anos` : ''}`)
  if (f.diagnostico) linhas.push(`Diagnóstico: ${f.diagnostico}`)
  if (f.laudo) linhas.push(`Laudo: ${temLaudo(f) ? `tem${f.laudoAno ? `, de ${f.laudoAno}` : ''}` : f.laudo === 'nao_sei' ? 'não sabe' : 'ainda não tem'}`)
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
  if ((respondida === 'renda' || respondida === 'renda_simples') && depois.rendaCasa !== undefined) return 'Entendi.'
  if (respondida === 'cadunico_combinado' || respondida === 'fase_medica_recusou' || respondida === 'cidade') return 'Combinado.'
  return ''
}

function juntar(...partes: string[]): string {
  return partes.filter(Boolean).join(' ')
}

const LIMITE_DA_MENSAGEM = 320
const RECUSA_MEDICO =
  /\b(nao precisa (de )?medico|nao quero (o )?medico|nao preciso (de )?medico|(quero|queria) saber (e|eh|so) do beneficio|so (quero|queria) (saber )?do beneficio|nao,? obrigad\w*|agora nao|depois|vou pelo sus)\b/
// Aceite so com "quero", "pode ser", "vamos" (D2). "Como funciona?" e curiosidade.
const ACEITE_MEDICO = /^(quero|pode ser|vamos|bora|aceito|quero sim|sim,? quero|quero fazer|pode marcar)\b(?! saber)/
const CURIOSO_MEDICO = /\b(como funciona|quero saber|me explica|explica|como e|sim)\b/
const TEM_CADUNICO = /\b(tem sim|temos sim|ja tem|ja temos|(minha|a) familia tem|ja fiz|ja fizemos|ja (esta|ta) atualizado|(esta|ta) atualizado|tem cadunico|temos cadunico|ja tenho)\b/

/**
 * Um turno: a mensagem do cliente entra, as respostas do robo saem, junto
 * com os sinais para o sistema (etapa, pendencia, encaminhar). Nunca lanca:
 * mensagem que o motor nao entende vira "nao entendi" e, na segunda vez,
 * encaminhamento - conversa nunca fica sem dono.
 */
export function responder(estadoAnterior: EstadoRobo, mensagem: string, agora: Date = new Date(), agenda: AgendaDaVez = {}): Resultado {
  gradeDaVez = agenda.grade ?? GRADE_PADRAO
  ocupadosDaVez = (agenda.ocupados ?? []).map((o) => new Date(o).getTime()).filter((n) => !Number.isNaN(n))
  ofertaDaVez = estadoAnterior.ofertas?.map((o) => new Date(o).getTime()) ?? null
  const r = conversar(estadoAnterior, mensagem, agora)
  // Esperando a escolha: guarda o par oferecido para ler "9" ou "a primeira" depois.
  if (r.estado.ultimaPergunta === 'horario' && !r.estado.pausado) {
    const { em } = opcoesDeHorario(agora)
    r.estado.ofertas = em.filter((e): e is string => Boolean(e))
  } else delete r.estado.ofertas
  return r
}

function conversar(estadoAnterior: EstadoRobo, mensagem: string, agora: Date): Resultado {
  const estado: EstadoRobo = { ...estadoAnterior, ficha: { ...estadoAnterior.ficha } }
  const sinais: Sinal[] = []
  const respostas: string[] = []
  // Audio transcrito chega como "[áudio] texto": responde ao texto.
  const texto = mensagem.replace(/^\s*\[[aá]udio\]\s*/i, '')
  const t = normalizar(texto)
  const primeira = estado.mensagensDoCliente === 0
  estado.mensagensDoCliente += 1

  if (estado.pausado) return { respostas, estado, sinais }
  if (primeira) sinais.push({ tipo: 'etapa', etapa: 'qualificacao' })

  // A Mary se apresenta uma vez, na primeira resposta (texto 1).
  let apresentou = !primeira
  const dizer = (...partes: string[]) => {
    const frase = juntar(...partes)
    if (!apresentou) {
      apresentou = true
      if (frase && ABERTURA.length + frase.length + 1 <= LIMITE_DA_MENSAGEM) {
        respostas.push(`${ABERTURA} ${frase}`)
        return
      }
      respostas.push(ABERTURA)
    }
    if (frase) respostas.push(frase)
  }
  const fim = (): Resultado => ({ respostas, estado, sinais })
  const s = () => sobre(estado.ficha)

  // Texto 2: antes da 1a pergunta de saude, uma vez.
  const comAviso = (p: Pergunta, pergunta: string) => {
    if (!PERGUNTAS_DE_SAUDE.includes(p) || estado.avisoSaude) return pergunta
    estado.avisoSaude = true
    return `${AVISO_SAUDE} ${pergunta}`
  }

  const encaminhar = (frase: string, motivo: string, etapa: Etapa = 'qualificado'): Resultado => {
    dizer(frase)
    sinais.push({ tipo: 'encaminhar', motivo })
    if (!estado.encaminhado) sinais.push({ tipo: 'etapa', etapa })
    estado.encaminhado = true
    estado.pausado = true
    estado.motivoPausa = motivo
    estado.ultimaPergunta = null
    estado.voltarPara = null
    return fim()
  }

  // Fecha oferecendo dois horarios; o robo continua so para ler a escolha.
  const fechar = (frase: string, motivo: string, tipo: 'limpo' | 'fraco' | 'cuidado', ...antes: string[]): Resultado => {
    const fora = emHorarioComercial(agora) ? '' : ' A equipe confirma logo cedo.'
    const tudo = juntar(...antes, `${frase}${fora}`)
    if (tudo.length <= LIMITE_DA_MENSAGEM) dizer(tudo)
    else {
      for (const a of antes) dizer(a)
      dizer(`${frase}${fora}`)
    }
    sinais.push({ tipo: 'encaminhar', motivo })
    if (!estado.encaminhado) sinais.push({ tipo: 'etapa', etapa: 'qualificado' })
    estado.encaminhado = true
    estado.fechamento = tipo
    estado.ultimaPergunta = 'horario'
    estado.voltarPara = null
    return fim()
  }

  const fecharQualificacao = (...antes: string[]): Resultado => {
    const f = estado.ficha
    const nome = primeiroNome(f.nome)
    const { texto: horarios } = opcoesDeHorario(agora)
    if (f.faseMedica === 'aceitou') sinais.push({ tipo: 'pendencia', texto: 'documentos básicos para a fase médica', dias: 1 })
    if (respostasBoas(f)) {
      const idosoFamiliar = ehIdoso(f) && f.para !== 'proprio'
      const caso = idosoFamiliar ? `o caso ${s().dele}` : 'seu caso'
      const frase = `${nome ? `${nome}, pelo` : 'Pelo'} que você me contou, ${caso} se qualifica sim para o atendimento com o nosso advogado de BPC, o Dr. André. Vamos marcar: ${horarios} é melhor para ${idosoFamiliar ? 'vocês' : 'você'}?`
      return fechar(frase, 'Qualificação completa', 'limpo', ...antes)
    }
    const frase = `${nome ? `${nome}, vou` : 'Vou'} passar seu caso para o advogado olhar com cuidado, porque cada detalhe conta. ${maiuscula(horarios)} é melhor para te chamarem?`
    return fechar(frase, 'Qualificação completa: advogado avalia', 'fraco', ...antes)
  }

  /** Segue para a pergunta que falta (ou fecha), com o que vier antes dela. */
  const seguir = (...antes: string[]): Resultado => {
    let p: Pergunta | null = estado.ultimaPergunta === 'retomar' ? estado.voltarPara : estado.ultimaPergunta
    if (p && !aindaFalta(p, estado.ficha)) p = null
    if (!p) p = proximaPergunta(estado.ficha)
    estado.voltarPara = null
    if (!p) return fecharQualificacao(...antes)
    estado.ultimaPergunta = p
    dizer(...antes, comAviso(p, textoDaPergunta(p, estado.ficha, agora)))
    return fim()
  }

  // Depois de "Posso continuar?": "sim" so repete a pergunta que ficou; o
  // resto e lido como resposta a ela.
  let perguntaFeita = estado.ultimaPergunta
  let soConfirmouRetomada = false
  if (perguntaFeita === 'retomar') {
    perguntaFeita = estado.voltarPara
    soConfirmouRetomada = ehSim(t) && t.split(' ').length <= 4
    if (ehNao(t) && t.split(' ').length <= 3 && !NAO_SEI.test(t)) return encaminhar('Claro, já aviso a equipe.', 'não quis seguir com o atendimento automático')
  }

  const antes = estado.ficha
  estado.ficha = lerMensagem(texto, antes, soConfirmouRetomada ? null : perguntaFeita, agora, primeira)

  // Negativa de ate 30 dias contada agora: o prazo vale mais que tudo (D7, F05).
  const prazoNovo = () => estado.ficha.pedidoAnterior === 'negado' && estado.ficha.diasNegado !== undefined && estado.ficha.diasNegado <= 30 && antes.diasNegado === undefined

  // Desvios primeiro, em qualquer etapa (C02). Mensagem de desvio nao
  // responde a pergunta feita: le de novo sem a pergunta, senao "quanto
  // custa?" virava a "rotina" da crianca.
  let d = desvio(t, texto, estado.ficha, agora, perguntaFeita)
  if (d) {
    estado.ficha = lerMensagem(texto, antes, null, agora, primeira)
    // "n. e ai, tem direito?": a resposta curta do comeco vale para a pergunta feita (F09).
    const curta = t.match(/^(sim|nao|tem|temos|tenho|nenhum|nenhuma|ninguem|nunca)\s*[.,!]\s+/)
    if (curta && perguntaFeita && d.tipo === 'responde') estado.ficha = lerMensagem(curta[1], estado.ficha, perguntaFeita, agora)
    d = desvio(t, texto, estado.ficha, agora, perguntaFeita) ?? d
  }
  if ((estado.ficha.origem && !antes.origem) || (estado.ficha.campanha && !antes.campanha))
    sinais.push({ tipo: 'origem', origem: estado.ficha.origem, campanha: estado.ficha.campanha })

  // Horario escolhido junto com outra coisa ("amanha de manha. e quanto voces
  // cobram?"): marca o horario e responde o resto (familias F05 e F07).
  let pausarDepois = false
  if (d && perguntaFeita === 'horario' && d.tipo !== 'encerra') {
    const leitura = lerHorario(t, agora)
    if (leitura && 'quando' in leitura) {
      const { quando, em } = leitura
      estado.ficha.horario = quando
      sinais.push({ tipo: 'reuniao', quando, em }, { tipo: 'etapa', etapa: 'reuniao' })
      if (estado.fechamento === 'limpo') {
        dizer(`Combinado, ${quando}.`)
        perguntaFeita = 'contrato_ok'
        estado.ultimaPergunta = 'contrato_ok'
      } else {
        dizer(`Combinado, ${quando}. A equipe te chama nesse horário.`)
        pausarDepois = true
      }
    }
  }

  if (d) {
    estado.naoEntendeu = 0
    // Pedido de pessoa, preco, cliente antigo: a equipe assume, mas o lead
    // nao vira "qualificado" sem ter passado pelas perguntas (F03, F12).
    if (d.tipo === 'encaminha') return encaminhar(d.texto, d.motivo, 'qualificacao')
    if (d.tipo === 'encerra') {
      dizer(d.texto)
      sinais.push({ tipo: 'encerrar', motivo: d.motivo })
      estado.pausado = true
      estado.encaminhado = false
      estado.motivoPausa = `Encerrado: ${d.motivo}`
      estado.ultimaPergunta = null
      estado.voltarPara = null
      return fim()
    }
    if (d.tipo === 'preco') {
      const h = honorarios(estado.ficha)
      if (h) return encaminhar(d.parcelar ? comParcelas(h) : h, d.parcelar ? 'Perguntou preço e parcelamento' : 'Perguntou preço', 'qualificacao')
      if (d.parcelar) estado.parcelasPedidas = true
      estado.voltarPara = perguntaFeita
      estado.ultimaPergunta = 'laudo_para_preco'
      dizer(comAviso('laudo_para_preco', textoDaPergunta('laudo_para_preco', estado.ficha, agora)))
      return fim()
    }
    if (d.tipo === 'pendencia') {
      sinais.push({ tipo: 'pendencia', texto: d.pendencia, dias: d.dias })
      estado.voltarPara = perguntaFeita
      estado.ultimaPergunta = d.proxima
      dizer(d.texto)
      return fim()
    }
    if (d.tipo === 'pergunta') {
      estado.voltarPara = perguntaFeita
      estado.ultimaPergunta = d.proxima
      dizer(d.texto)
      return fim()
    }
    if (d.duvida) {
      sinais.push({ tipo: 'duvida', texto: d.duvida })
      estado.ficha.duvidas = [...(estado.ficha.duvidas ?? []), d.duvida]
    }
    if (prazoNovo()) return encaminhar(TEXTO_PRAZO, 'PRIORIDADE: prazo de recurso')
    if (pausarDepois) {
      dizer(d.texto)
      estado.pausado = true
      estado.motivoPausa = 'Reunião pedida: o advogado olha o caso antes de qualquer contrato'
      estado.ultimaPergunta = null
      return fim()
    }
    // Texto que ja termina em pergunta ("Posso continuar?") guarda a do
    // roteiro para depois; os outros repetem a pergunta que ficou.
    if (/\?\s*$/.test(d.texto)) {
      estado.voltarPara = perguntaFeita ?? proximaPergunta(estado.ficha)
      estado.ultimaPergunta = 'retomar'
      dizer(d.texto)
      return fim()
    }
    estado.ultimaPergunta = perguntaFeita
    return seguir(d.texto)
  }

  if (soConfirmouRetomada) {
    estado.ultimaPergunta = perguntaFeita
    return seguir()
  }

  const f = estado.ficha

  // Etapa do horario: so marca com escolha de verdade (C02, texto 11).
  if (perguntaFeita === 'horario') {
    const leitura = lerHorario(t, agora)
    estado.ultimaPergunta = 'horario'
    // Dia ou hora fora da oferta: oferece os livres mais perto do pedido.
    if (leitura && 'outras' in leitura) {
      estado.naoEntendeu = 0
      dizer(leitura.outras)
      return fim()
    }
    const escolha = leitura && 'quando' in leitura ? leitura : null
    const quando = escolha?.quando
    if (!quando) {
      if (prazoNovo()) return encaminhar(TEXTO_PRAZO, 'PRIORIDADE: prazo de recurso')
      // Pergunta da familia na hora do horario: texto 3 e a duvida anotada,
      // nunca so o horario de novo (familias F01, F04, F05 e F10).
      if (ehPergunta(texto, t) || JURIDICA.test(t)) {
        const duvida = extrairDuvida(texto)
        sinais.push({ tipo: 'duvida', texto: duvida })
        f.duvidas = [...(f.duvidas ?? []), duvida]
        dizer(TEXTO_JURIDICO, textoDaPergunta('horario', f, agora))
        return fim()
      }
      // Duas vezes sem escolher: a equipe liga para combinar, sem insistir (N6).
      estado.naoEntendeu += 1
      if (estado.naoEntendeu >= 2) return encaminhar('Tudo bem. Vou pedir para a equipe te chamar para combinar o melhor horário.', 'Horário não combinado: a equipe chama')
      const recusou = /\b(nao posso|nao consigo|nao vai dar|nenhum dos dois|nenhuma das duas|nenhum horario)\b|\bnao da\b(?! (pra|para) )/.test(t)
      dizer(recusou ? 'Tudo bem. Qual dia e horário ficam melhores para você?' : textoDaPergunta('horario', f, agora))
      return fim()
    }
    estado.naoEntendeu = 0
    f.horario = quando
    sinais.push({ tipo: 'reuniao', quando, em: escolha?.em })
    sinais.push({ tipo: 'etapa', etapa: 'reuniao' })
    if (estado.fechamento === 'cuidado' || estado.fechamento === 'fraco') {
      // Com impedimento ou caso a olhar com cuidado, o advogado conversa antes: nada de contrato agora.
      dizer(`Combinado, ${quando}. A equipe te chama nesse horário.`)
      estado.pausado = true
      estado.motivoPausa = 'Reunião pedida: o advogado olha o caso antes de qualquer contrato'
      estado.ultimaPergunta = null
      return fim()
    }
    estado.ultimaPergunta = 'contrato_ok'
    if (LINK_AGENDA) {
      dizer(`Combinado, ${quando}. Escolha o horário exato na agenda do Dr. André por este link, que já marca a videochamada: ${LINK_AGENDA}`)
      dizer('Para não perder tempo, a equipe já te manda o contrato e a lista de documentos antes da conversa. Pode ser?')
      return fim()
    }
    dizer(`Combinado, ${quando}. Para não perder tempo, a equipe já te manda o contrato e a lista de documentos antes da conversa. Pode ser?`)
    return fim()
  }

  // Contrato antes da reuniao: "nao" nunca vira "Perfeito" (texto 12).
  if (perguntaFeita === 'contrato_ok') {
    if (/\b(n|nao) (marquei|escolhi|combinei)\b/.test(t)) {
      f.horario = undefined
      estado.ultimaPergunta = 'horario'
      dizer(`Desculpa, entendi errado. ${textoDaPergunta('horario', f, agora)}`)
      return fim()
    }
    estado.pausado = true
    estado.ultimaPergunta = null
    const nome = primeiroNome(f.nome)
    // "ja falei que pode" e aceite (F08).
    if (ehSim(t) || (/\b(pode|pode ser|manda|pode mandar|claro|sim|ok|beleza|quero)\b/.test(t) && !/\bnao\b/.test(t))) {
      dizer(`Perfeito${nome ? ', ' + nome : ''}. A equipe já te chama por aqui com o contrato e a lista de documentos.`)
      sinais.push({ tipo: 'encaminhar', motivo: `Reunião ${f.horario ?? ''}: enviar contrato e lista de documentos`.replace(/\s+/g, ' ').trim() })
      estado.motivoPausa = 'Reunião marcada: equipe envia contrato e documentos'
    } else {
      dizer('Tudo bem. A equipe te chama no horário combinado e explica tudo antes de qualquer contrato.')
      sinais.push({ tipo: 'encaminhar', motivo: `Reunião ${f.horario ?? ''}: explicar tudo antes de qualquer contrato`.replace(/\s+/g, ' ').trim() })
      estado.motivoPausa = 'Reunião marcada: contrato só depois da conversa'
    }
    return fim()
  }

  // Preco pedido antes de sabermos do laudo: agora responde.
  if (perguntaFeita === 'laudo_para_preco') {
    const h = honorarios(f)
    if (h) return encaminhar(estado.parcelasPedidas ? comParcelas(h) : h, 'Perguntou preço', 'qualificacao')
  }

  // Fase medica parceira (D2, C18): "como funciona?" nao encerra a triagem.
  if (perguntaFeita === 'fase_medica') {
    if (RECUSA_MEDICO.test(t) || (ehNao(t) && !NAO_SEI.test(t))) {
      f.faseMedica = 'recusou'
      sinais.push({ tipo: 'pendencia', texto: 'laudo médico', dias: 7 })
      estado.ultimaPergunta = 'fase_medica_recusou'
      dizer(`Tudo bem. Enquanto isso, tente a consulta pelo SUS ou pelo plano. ${textoDaPergunta('fase_medica_recusou', f, agora)}`)
      return fim()
    }
    const aceite = ACEITE_MEDICO.test(t)
    if (aceite || CURIOSO_MEDICO.test(t) || ehSim(t)) {
      f.faseMedica = aceite ? 'aceitou' : 'explicada'
      estado.ultimaPergunta = null
      const p = proximaPergunta(f)
      const explicacao = `${aceite ? 'Combinado. ' : ''}Funciona assim: o advogado confere seus documentos básicos, o contrato é assinado e aí a equipe agenda a consulta.`
      if (!p) return fecharQualificacao(explicacao)
      const q = textoDaPergunta(p, f, agora)
      estado.ultimaPergunta = p
      dizer(explicacao, q.includes(':') ? `Antes disso, ${q.charAt(0).toLowerCase()}${q.slice(1)}` : `Antes, me conta: ${q.charAt(0).toLowerCase()}${q.slice(1)}`)
      return fim()
    }
  }

  if (perguntaFeita === 'resumo_familia') {
    estado.ultimaPergunta = estado.voltarPara
    estado.voltarPara = null
    estado.pausado = true
    estado.motivoPausa = 'Decisão em família: retorno em 3 dias'
    // Espera a familia, nao a equipe: nao entra na fila de "esperando equipe".
    estado.encaminhado = false
    if (ehSim(t)) {
      dizer(`Segue o resumo para verem juntos:\n${resumoDaFicha(f)}`)
      dizer('Combinado, te chamo em 3 dias. Se decidirem antes, é só me chamar aqui.')
      return fim()
    }
    dizer('Tudo bem. Te chamo em 3 dias, combinado?')
    return fim()
  }

  // CadUnico: vale a ultima resposta ("Nao" e logo "minha familia tem sim").
  if (perguntaFeita === 'cadunico_combinado' && TEM_CADUNICO.test(t) && antes.cadunico && antes.cadunico !== 'atualizado') {
    sinais.push({ tipo: 'pendencia_resolvida', texto: antes.cadunico === 'nao' ? 'inscrição no CadÚnico' : 'atualizar o CadÚnico' })
    f.cadunico = 'atualizado'
    estado.ultimaPergunta = null
    estado.naoEntendeu = 0
    return seguir('Que bom, anotei.')
  }

  if (perguntaFeita === 'cidade') {
    estado.ultimaPergunta = estado.voltarPara
    estado.naoEntendeu = 0
    return seguir('Combinado.')
  }

  // Impedimentos: sem "se qualifica sim", o advogado olha antes (D4).
  if (!estado.encaminhado) {
    const idade = f.idade
    if (f.semDeficiencia && !antes.semDeficiencia && idade !== undefined && idade < 65) {
      const { texto: horarios } = opcoesDeHorario(agora)
      const crianca = f.para === 'filho' || f.para === 'filha'
      return fechar(
        crianca
          ? `Vou passar para o advogado avaliar, porque cada caso tem detalhes. ${maiuscula(horarios)} é melhor?`
          : `O BPC do idoso é a partir dos 65 anos. Vou passar seu caso para o advogado ver o que dá para fazer desde já. ${maiuscula(horarios)} é melhor?`,
        'menos de 65 anos sem deficiência',
        'cuidado',
      )
    }
    if (f.beneficioProprio === 'sim' && antes.beneficioProprio !== 'sim') {
      const { texto: horarios } = opcoesDeHorario(agora)
      return fechar(
        `Como ${s().ele} já recebe um benefício, o advogado precisa olhar seu caso com cuidado antes de qualquer pedido. ${maiuscula(horarios)} é melhor para te chamarem?`,
        'já recebe benefício',
        'cuidado',
      )
    }
  }
  if (prazoNovo()) return encaminhar(TEXTO_PRAZO, 'PRIORIDADE: prazo de recurso')

  // CadUnico que falta: orienta, marca pendencia e segue as perguntas.
  if (f.cadunico && f.cadunico !== 'atualizado' && antes.cadunico !== f.cadunico) {
    sinais.push({ tipo: 'pendencia', texto: f.cadunico === 'nao' ? 'inscrição no CadÚnico' : 'atualizar o CadÚnico', dias: 7 })
    estado.ultimaPergunta = 'cadunico_combinado'
    estado.naoEntendeu = 0
    const todos = ehIdoso(f) ? ' de todos da casa' : ''
    dizer(
      reconhecimento(antes, f, perguntaFeita),
      `Sem problema. ${f.cadunico === 'nao' ? 'É feito' : 'A atualização é feita'} no CRAS da sua cidade, de graça, com RG, CPF e comprovante de endereço${todos}. Dá para ir essa semana?`,
    )
    return fim()
  }

  // A pessoa do beneficio recebe algo, mas nao deu para saber quem (Lucas, item 4).
  if ((perguntaFeita === 'beneficio_proprio') && !f.beneficioProprio && QUAL_BENEFICIO.test(t)) {
    estado.ultimaPergunta = 'quem_recebe'
    estado.naoEntendeu = 0
    dizer(textoDaPergunta('quem_recebe', f, agora))
    return fim()
  }

  // "Fui abandonado" nao e renda: anota e faz a pergunta simples (Lucas, item 2).
  const abandonoAgora = (f.anotacoes ?? []).includes(NOTA_SEM_APOIO) && !(antes.anotacoes ?? []).includes(NOTA_SEM_APOIO)
  if (f.rendaCasa === undefined && f.pessoasCasa !== undefined && (abandonoAgora || ((perguntaFeita === 'renda' || perguntaFeita === 'casa') && /\bsozinh/.test(t) && antes.pessoasCasa !== undefined))) {
    const repetiria = perguntaFeita === 'renda_simples'
    estado.ultimaPergunta = 'renda_simples'
    estado.naoEntendeu = 0
    if (repetiria)
      dizer(`Sinto muito por isso. Para eu anotar certo: entra algum dinheiro por mês ${f.pessoasCasa === 1 ? `para ${s().ele}` : 'na casa'}, mesmo que pouco? Se não entra nada, pode dizer "nada".`)
    else dizer(abandonoAgora ? 'Entendo.' : '', textoDaPergunta('renda_simples', f, agora))
    return fim()
  }

  const aprendeuAlgo = JSON.stringify(antes) !== JSON.stringify(f)
  // Pergunta da familia que nenhum desvio reconheceu ("minha esposa pode ir
  // no meu lugar?"): vira duvida para o advogado e a pergunta do roteiro
  // volta. Nunca "nao entendi" nem "Combinado." (familia F08).
  if (!primeira && !aprendeuAlgo && ehPergunta(texto, t)) {
    const duvida = extrairDuvida(texto)
    sinais.push({ tipo: 'duvida', texto: duvida })
    f.duvidas = [...(f.duvidas ?? []), duvida]
    estado.naoEntendeu = 0
    estado.ultimaPergunta = perguntaFeita
    return seguir(TEXTO_JURIDICO)
  }

  // Explicacao do arquivo mandado ("e a foto do laudo"): repete a pergunta que ficou (F09).
  if (!primeira && !aprendeuAlgo && SOBRE_ARQUIVO.test(t)) {
    estado.ultimaPergunta = perguntaFeita
    return seguir()
  }

  // "Boa tarde" no meio da conversa e cumprimento, nao resposta: devolve o
  // cumprimento e repete a pergunta, sem contar como "nao entendi" (teste do Edu, 21/10/2026).
  const cumprimento = /^\W*(oi+|ola|opa|bom dia|boa tarde|boa noite)\W*(tudo (bem|bom)|td (bem|bom))?\W*$/.exec(t)
  if (!primeira && !aprendeuAlgo && cumprimento) {
    estado.ultimaPergunta = perguntaFeita
    const volta = cumprimento[1].startsWith('bo') ? `${maiuscula(cumprimento[1])}!` : 'Oi!'
    return seguir(volta)
  }

  // Nada aproveitavel numa resposta que precisava de conteudo.
  const soConfirma = ['cadunico_combinado', 'fase_medica_recusou'].includes(perguntaFeita ?? '')
  if (!primeira && !aprendeuAlgo && !soConfirma) {
    // Sem pergunta pendente (religado depois de ir para a equipe): segue de onde
    // parou em vez de "nao entendi" (numero do Lucas, 23/10/2026).
    if (perguntaFeita === null) return seguir('Vamos continuar de onde paramos.')
    if (perguntaFeita === 'renda' && estado.naoEntendeu === 0) {
      estado.naoEntendeu = 1
      estado.ultimaPergunta = 'renda_simples'
      dizer(textoDaPergunta('renda_simples', f, agora))
      return fim()
    }
    estado.naoEntendeu += 1
    if (estado.naoEntendeu >= 2) return encaminhar('Vou pedir para alguém da equipe te chamar aqui, tá bem?', 'O robô não entendeu duas vezes', 'qualificacao')
    dizer('Desculpa, não entendi direito. Pode me explicar com outras palavras?')
    return fim()
  }
  estado.naoEntendeu = 0

  const antesDaPergunta: string[] = [primeira ? '' : reconhecimento(antes, f, perguntaFeita)]
  if (f.biometria === 'nao' && antes.biometria !== 'nao') {
    sinais.push({ tipo: 'pendencia', texto: 'biometria', dias: 15 })
    antesDaPergunta.push('Sem problema. A equipe orienta como fazer.')
  }
  if (f.laudo === 'nao_sei' && antes.laudo !== 'nao_sei') antesDaPergunta.push('Sem problema, o advogado olha isso com você.')
  if (f.tempoNegado && !antes.tempoNegado) antesDaPergunta.push('Acontece muito e não encerra o assunto. O advogado vê se cabe novo pedido ou ação.')
  estado.ultimaPergunta = null
  return seguir(...antesDaPergunta.filter(Boolean))
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
