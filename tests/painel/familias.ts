// Familias simuladas para o fuzz (painel de avaliacao, 20/10/2026). Cada uma
// tem uma VERDADE (o que a familia de fato tem) e um jeito de escrever; o
// robo responde a cada pergunta e, no fim, a ficha dele tem de bater com a
// verdade. Nada de dado real: nomes e numeros inventados.
import fc from 'fast-check'
import type { Pergunta } from '../../supabase/functions/_shared/robo.ts'

export interface Verdade {
  para: 'filho' | 'filha' | 'proprio' | 'mae' | 'pai'
  nome: string
  idade: number
  diagnostico: 'autismo' | 'down' | 'paralisia' | 'epilepsia' | 'nenhum'
  laudo: 'recente' | 'antigo' | 'sem'
  aceitaFaseMedica: boolean
  cadunico: 'atualizado' | 'desatualizado' | 'nao'
  pessoas: number
  renda: number
  outros: 'nao' | 'aposentadoria' | 'bpc' | 'bolsa'
  pedido: 'nao' | 'negado' | 'em_analise'
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
    diagnostico: fc.constantFrom('autismo', 'autismo', 'autismo', 'down', 'paralisia', 'epilepsia') as fc.Arbitrary<Verdade['diagnostico']>,
    laudo: fc.constantFrom('recente', 'antigo', 'sem') as fc.Arbitrary<Verdade['laudo']>,
    aceitaFaseMedica: fc.boolean(),
    cadunico: fc.constantFrom('atualizado', 'atualizado', 'desatualizado', 'nao') as fc.Arbitrary<Verdade['cadunico']>,
    pessoas: fc.integer({ min: 1, max: 8 }),
    renda: fc.constantFrom(0, 600, 800, 1000, 1200, 1500, 1621, 2000, 2400, 3000, 4500),
    outros: fc.constantFrom('nao', 'nao', 'aposentadoria', 'bpc', 'bolsa') as fc.Arbitrary<Verdade['outros']>,
    pedido: fc.constantFrom('nao', 'nao', 'negado', 'em_analise') as fc.Arbitrary<Verdade['pedido']>,
  })
  .map((r) => {
    const crianca = r.para === 'filho' || r.para === 'filha'
    const idoso = !crianca && (r.para === 'mae' || r.para === 'pai' || r.adultoIdoso)
    const idade = crianca ? r.idadeCrianca : idoso ? r.idadeIdoso : r.idadeAdulto
    return {
      para: r.para,
      nome: r.nome,
      idade,
      diagnostico: idoso ? 'nenhum' : r.diagnostico,
      laudo: r.laudo,
      aceitaFaseMedica: r.aceitaFaseMedica,
      cadunico: r.cadunico,
      pessoas: r.pessoas,
      renda: r.renda,
      outros: r.outros,
      pedido: r.pedido,
    }
  })

const ehIdosa = (v: Verdade) => v.idade >= 65 && v.para !== 'filho' && v.para !== 'filha'
const ele = (v: Verdade) => (v.para === 'filha' || v.para === 'mae' ? 'ela' : 'ele')

/** Respostas possiveis para cada pergunta; o fuzz escolhe uma pelo indice. */
export function respostas(p: Pergunta, v: Verdade): string[] {
  const n = v.nome
  const id = v.idade
  const e = ele(v)
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
        v.para === 'proprio' ? x.replace(`${e} tem`, 'tenho') : x,
      )
    case 'nome':
      return [n, `meu nome é ${n}`, `${n} Souza`]
    case 'idade':
      return [`${id}`, `${id} anos`, v.para === 'proprio' ? `tenho ${id} anos` : `${e} tem ${id} anos`, `${EXTENSO[id] ?? id}`]
    case 'diagnostico':
      return {
        autismo: ['autismo, desde os 2 anos', `${e} é autista nível 2`, 'TEA', 'transtorno do espectro autista'],
        down: ['síndrome de down', 'tem down desde que nasceu'],
        paralisia: ['paralisia cerebral', 'tem paralisia cerebral, é cadeirante'],
        epilepsia: ['epilepsia, tem crises toda semana', 'epilepsia grave'],
        nenhum: ['nenhum, é pela idade', 'não tem doença, é pela idade mesmo'],
      }[v.diagnostico]
    case 'laudo':
    case 'laudo_para_preco':
      return {
        recente: ['sim, tem', 'tem laudo sim, do mês passado', 'sim, de 2026', 'tem sim'],
        antigo: ['tem mas é de 2021', 'tem, mas é antigo', 'tem um laudo velho'],
        sem: ['não tem', 'ainda não, está na fila do SUS', 'nao'],
      }[v.laudo]
    case 'fase_medica':
      return v.aceitaFaseMedica ? ['quero saber', 'sim', 'como funciona?'] : ['não, obrigado', 'agora não']
    case 'rotina':
      return ['precisa de ajuda pra tudo, faz terapia', 'toma remédio e faz fono', 'precisa de ajuda pra comer e tomar banho']
    case 'tratamento':
      return ['pelo SUS', 'plano de saúde', 'particular', 'no CAPS']
    case 'cadunico':
      return {
        atualizado: ['sim, atualizado', 'tem sim, fiz esse ano', 'sim'],
        desatualizado: ['tem mas está desatualizado', 'faz tempo que não atualizo'],
        nao: ['não tem', 'o que é isso?', 'nunca fiz'],
      }[v.cadunico]
    case 'casa_renda':
      return [
        `somos ${v.pessoas} e a renda é ${v.renda} reais`,
        `${v.pessoas} pessoas, uns ${v.renda} por mês`,
        `moram ${v.pessoas}, a renda é R$ ${v.renda}`,
        `a renda é ${v.renda} reais e somos ${v.pessoas}`,
      ].map((x) => (v.renda === 0 ? x.replace(/(uns |R\$ )?0( reais| por mês)?/, 'ninguém trabalha, renda zero') : x))
    case 'pessoas':
      return [`${v.pessoas}`, `${v.pessoas} pessoas`, `somos ${v.pessoas}`]
    case 'renda':
      return v.renda === 0 ? ['ninguém trabalha', 'renda zero'] : [`${v.renda} reais`, `R$ ${v.renda}`, `uns ${v.renda} por mês`]
    case 'outros_beneficios':
      return {
        nao: ['não', 'ninguém recebe'],
        aposentadoria: ['minha mãe recebe aposentadoria', 'sim, aposentadoria do meu pai'],
        bpc: ['o irmão dele recebe o loas', 'sim, BPC'],
        bolsa: ['só bolsa família', 'bolsa familia'],
      }[v.outros]
    case 'pedido_anterior':
      return { nao: ['nunca pedimos', 'não', 'primeira vez'], negado: ['já pedimos e negaram', 'foi indeferido'], em_analise: ['está em análise'] }[v.pedido]
    case 'tempo_negado':
      return ['faz 6 meses', 'uns 2 anos']
    case 'cadunico_combinado':
    case 'fase_medica_recusou':
    case 'retomar':
    case 'resumo_familia':
    case 'cidade':
      return ['sim', 'dá sim', 'ok']
    case 'horario':
      return ['pode ser amanhã às 9h', 'hoje à tarde', '10h', 'pode ser']
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
