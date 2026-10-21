// Familias simuladas para o fuzz (painel de avaliacao, 20/10/2026; roteiro
// v3.2 em 21/10/2026). Cada uma tem uma VERDADE (o que a familia de fato tem)
// e um jeito de escrever; o robo responde a cada pergunta e, no fim, a ficha
// dele tem de bater com a verdade. Nada de dado real: nomes e numeros inventados.
import fc from 'fast-check'
import type { Pergunta } from '../../supabase/functions/_shared/robo.ts'

export interface Verdade {
  para: 'filho' | 'filha' | 'proprio' | 'mae' | 'pai'
  nome: string
  idade: number
  /** 'nenhum' em adulto de menos de 65: o caso "e pela idade" (item 1 do Lucas) */
  diagnostico: 'autismo' | 'down' | 'paralisia' | 'epilepsia' | 'nenhum'
  /** como a familia descreve o laudo; pelo D1, recente e antigo sao "tem laudo" */
  laudo: 'recente' | 'antigo' | 'sem' | 'nao_sei'
  aceitaFaseMedica: boolean
  cadunico: 'atualizado' | 'desatualizado' | 'nao'
  pessoas: number
  renda: number
  /** a propria pessoa do beneficio ja recebe pensao (item 4 do Lucas) */
  recebe: 'nao' | 'pensao'
  outros: 'nao' | 'aposentadoria' | 'bpc' | 'bolsa'
  biometria: boolean
  pedido: 'nao' | 'negado' | 'negado_recente' | 'em_analise'
}

const NOMES = ['Ana', 'Bruna', 'Carla', 'Daniela', 'Elaine', 'Fernanda', 'Josefa', 'Marcos', 'Paulo', 'Rita', 'Sandra', 'Tatiane']
const EXTENSO = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze']

export const verdade: fc.Arbitrary<Verdade> = fc
  .record({
    para: fc.constantFrom('filho', 'filha', 'proprio', 'mae', 'pai') as fc.Arbitrary<Verdade['para']>,
    nome: fc.constantFrom(...NOMES),
    idadeCrianca: fc.integer({ min: 1, max: 15 }),
    idadeAdulto: fc.integer({ min: 20, max: 64 }),
    idadeIdoso: fc.integer({ min: 65, max: 90 }),
    adultoIdoso: fc.boolean(),
    adultoSemDoenca: fc.integer({ min: 0, max: 9 }),
    diagnostico: fc.constantFrom('autismo', 'autismo', 'autismo', 'down', 'paralisia', 'epilepsia') as fc.Arbitrary<Verdade['diagnostico']>,
    laudo: fc.constantFrom('recente', 'antigo', 'sem', 'sem', 'nao_sei') as fc.Arbitrary<Verdade['laudo']>,
    aceitaFaseMedica: fc.boolean(),
    cadunico: fc.constantFrom('atualizado', 'atualizado', 'desatualizado', 'nao') as fc.Arbitrary<Verdade['cadunico']>,
    pessoas: fc.integer({ min: 1, max: 8 }),
    renda: fc.constantFrom(0, 600, 800, 1000, 1200, 1500, 1621, 2000, 2400, 3000, 4500),
    recebe: fc.constantFrom('nao', 'nao', 'nao', 'nao', 'pensao') as fc.Arbitrary<Verdade['recebe']>,
    outros: fc.constantFrom('nao', 'nao', 'aposentadoria', 'bpc', 'bolsa') as fc.Arbitrary<Verdade['outros']>,
    biometria: fc.boolean(),
    pedido: fc.constantFrom('nao', 'nao', 'negado', 'negado_recente', 'em_analise') as fc.Arbitrary<Verdade['pedido']>,
  })
  .map((r) => {
    const crianca = r.para === 'filho' || r.para === 'filha'
    const idoso = !crianca && (r.para === 'mae' || r.para === 'pai' || r.adultoIdoso)
    // 1 em 10 adultos tem 60 a 64 anos e nenhuma doenca ("e pela idade").
    const semDoenca = !crianca && !idoso && r.adultoSemDoenca === 0
    const idade = crianca ? r.idadeCrianca : idoso ? r.idadeIdoso : semDoenca ? 60 + (r.idadeAdulto % 5) : r.idadeAdulto
    // Familia coerente: crianca nao mora sozinha; quem mora so nao tem "outro da casa".
    const pessoas = crianca ? Math.max(2, r.pessoas) : r.pessoas
    const outros = pessoas === 1 || (r.renda === 0 && r.outros !== 'bolsa') ? 'nao' : r.outros
    return {
      para: r.para,
      nome: r.nome,
      idade,
      diagnostico: idoso || semDoenca ? 'nenhum' : r.diagnostico,
      laudo: r.laudo,
      aceitaFaseMedica: r.aceitaFaseMedica,
      cadunico: r.cadunico,
      pessoas,
      renda: r.renda,
      recebe: r.recebe,
      outros,
      biometria: r.biometria,
      pedido: r.pedido,
    } as Verdade
  })

const ehIdosa = (v: Verdade) => v.idade >= 65 && v.para !== 'filho' && v.para !== 'filha'
const ele = (v: Verdade) => (v.para === 'filha' || v.para === 'mae' ? 'ela' : 'ele')

/** Respostas possiveis para cada pergunta; o fuzz escolhe uma pelo indice. */
export function respostas(p: Pergunta, v: Verdade): string[] {
  const n = v.nome
  const id = v.idade
  const e = ele(v)
  const proprio = v.para === 'proprio'
  switch (p) {
    case 'abertura_quem':
      return {
        filho: ['é pro meu filho', 'meu filho é autista, queria saber do loas', `Oi, sou a ${n}, é para meu filho`, 'boa tarde, vi o anúncio, é pra meu filho'],
        filha: ['é pra minha filha', `Oi, me chamo ${n}, é para minha filha`, 'quero saber do beneficio pra minha filha'],
        proprio: ['é pra mim', 'pra mim mesmo', `Oi, sou ${n}, é para mim`],
        mae: ['é pra minha mãe', `Boa tarde, meu nome é ${n}, é para minha mãe`, 'queria ver o loas da minha mãe'],
        pai: ['é pro meu pai', `meu nome é ${n}, é para o meu pai`],
      }[v.para]
    case 'nome_idade':
      return [`${n}, ${e} tem ${id} anos`, `me chamo ${n}. ${id} anos`, `${n} e ${e} tem ${EXTENSO[id] ?? id} anos`, `${n}. ${id}`].map((x) =>
        proprio ? x.replace(`${e} tem`, 'tenho') : x,
      )
    case 'nome':
      return [n, `meu nome é ${n}`, `${n} Souza`]
    case 'idade':
      return [`${id}`, `${id} anos`, proprio ? `tenho ${id} anos` : `${e} tem ${id} anos`, `${EXTENSO[id] ?? id}`]
    case 'diagnostico':
      return {
        autismo: ['autismo, desde os 2 anos', `${e} é autista nível 2`, 'TEA', 'transtorno do espectro autista'],
        down: ['síndrome de down', 'tem down desde que nasceu'],
        paralisia: ['paralisia cerebral', 'tem paralisia cerebral, é cadeirante'],
        epilepsia: ['epilepsia, tem crises toda semana', 'epilepsia grave'],
        nenhum: ['nenhuma, é pela idade', 'não tenho doença, é pela idade mesmo', 'não'],
      }[v.diagnostico]
    case 'laudo':
    case 'laudo_para_preco':
      return {
        recente: ['sim, tem', 'tem laudo sim, do mês passado', 'sim, de 2026', 'tem sim'],
        antigo: ['tem mas é de 2021', 'tem, mas é antigo', 'tem um laudo velho', 'tem, de 2017'],
        sem: ['não tem', 'ainda não, está na fila do SUS', 'nao'],
        nao_sei: ['não sei', 'não lembro se tem'],
      }[v.laudo]
    case 'fase_medica':
      return v.aceitaFaseMedica ? ['quero saber', 'sim', 'como funciona?', 'pode ser'] : ['não, obrigado', 'agora não', 'não precisa de médico, eu quero saber é do benefício']
    case 'rotina':
      return ['precisa de ajuda pra tudo, faz terapia', 'toma remédio e faz fono', 'precisa de ajuda pra comer e tomar banho']
    case 'tratamento':
      return ['pelo SUS', 'plano de saúde', 'particular', 'no CAPS']
    case 'cadunico':
      return {
        atualizado: ['sim, atualizado', 'tem sim, fiz esse ano', 'sim', 'atualizei ano passado'],
        desatualizado: ['tem mas está desatualizado', 'faz tempo que não atualizo', 'fiz faz uns 3 anos'],
        nao: ['não tem', 'o que é isso?', 'nunca fiz'],
      }[v.cadunico]
    case 'casa':
    case 'casa_renda':
      if (v.pessoas === 1) return proprio ? ['moro sozinho', 'só eu'] : [`${e} mora sozinha`.replace('ele mora sozinha', 'ele mora sozinho')]
      return [
        `somos ${v.pessoas}`,
        `${v.pessoas} pessoas`,
        `moram ${v.pessoas} contando ${proprio ? 'comigo' : e}`,
        ...(v.pessoas === 2 && !proprio ? [`só eu e ${e}`] : []),
        ...(v.pessoas === 3 && (v.para === 'filho' || v.para === 'filha') ? [`eu, o pai e ${e}`] : []),
      ]
    case 'pessoas':
      return [`${v.pessoas}`, `${v.pessoas} pessoas`, `somos ${v.pessoas}`]
    case 'renda':
    case 'renda_simples':
      return v.renda === 0 ? ['ninguém trabalha', 'renda zero', 'nada'] : [`${v.renda} reais`, `R$ ${v.renda}`, `uns ${v.renda} por mês`]
    case 'beneficio_proprio':
      return v.recebe === 'pensao'
        ? [proprio ? 'sim, recebo pensão' : `sim, ${e} recebe pensão por morte`, proprio ? 'ganho pensão' : `${e} ganha pensão`]
        : ['não', 'não recebe nada', 'nenhum']
    case 'quem_recebe':
      return v.recebe === 'pensao' ? [proprio ? 'eu mesmo' : `${e} mesmo`] : ['outra pessoa']
    case 'outros_beneficios':
      return {
        nao: ['não', 'ninguém recebe'],
        aposentadoria: ['o avô é aposentado, um salário', 'sim, aposentadoria do avô'],
        bpc: ['o irmão recebe o loas', 'sim, BPC do irmão'],
        bolsa: ['só bolsa família', 'não, só o bolsa família'],
      }[v.outros]
    case 'biometria':
      return v.biometria ? ['tem CNH', 'tem título com digital', 'sim, tem a identidade nova'] : ['não tem', 'não sei', 'não']
    case 'pedido_anterior':
      return {
        nao: ['nunca pedimos', 'não', 'primeira vez'],
        negado: ['já pedimos e negaram', 'foi indeferido'],
        negado_recente: ['já pedimos e negaram', 'foi indeferido'],
        em_analise: ['está em análise'],
      }[v.pedido]
    case 'pedido_resultado':
      return v.pedido === 'em_analise' ? ['ainda em análise'] : ['negaram']
    case 'tempo_negado':
      return v.pedido === 'negado_recente' ? ['faz 10 dias', 'semana passada', 'faz uns 20 dias'] : ['faz 6 meses', 'uns 2 anos']
    case 'cadunico_combinado':
    case 'fase_medica_recusou':
    case 'retomar':
    case 'resumo_familia':
    case 'cidade':
      return ['sim', 'dá sim', 'ok']
    case 'horario':
      return ['pode ser amanhã às 9h', 'hoje à tarde', '10h', 'pode ser de manhã']
    case 'contrato_ok':
      return ['pode', 'sim', 'ok']
    default:
      return ['ok']
  }
}

// Jeito de escrever no WhatsApp: tudo minusculo sem acento, CAIXA ALTA,
// abreviacao, sem pontuacao. A mesma resposta com ruido tem de dar a mesma ficha.
export type Ruido = 'nenhum' | 'sem_acento' | 'caixa_alta' | 'abreviado' | 'sem_pontuacao'
export const ruido: fc.Arbitrary<Ruido> = fc.constantFrom('nenhum', 'nenhum', 'sem_acento', 'caixa_alta', 'abreviado', 'sem_pontuacao')

export function sujar(texto: string, r: Ruido): string {
  switch (r) {
    case 'sem_acento':
      return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    case 'caixa_alta':
      return texto.toUpperCase()
    case 'abreviado':
      return texto.replace(/\bvocê\b/gi, 'vc').replace(/\bnão\b/gi, 'n').replace(/\bque\b/gi, 'q').replace(/\bpara\b/gi, 'pra').replace(/\bbeleza\b/gi, 'blz')
    case 'sem_pontuacao':
      return texto.replace(/[.,?!]/g, '')
    default:
      return texto
  }
}

export { ehIdosa }
