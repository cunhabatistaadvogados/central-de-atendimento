// Fuzz de conversas (painel de avaliacao, 20/10/2026).
//
//   node tests/painel/fuzz.ts [quantas=3000] [semente=20261020]
//   ROBO=<arquivo> node tests/painel/fuzz.ts   as mesmas familias noutra versao (o "antes")
//
// Milhares de familias inventadas conversam com o robo de verdade, cada uma
// com uma verdade e um jeito de escrever. Em cada resposta do robo valem as
// regras do escritorio (regras.ts); no fim, a ficha tem de bater com a
// verdade. Cada defeito sai com a MENOR conversa que o reproduz (o fast-check
// encolhe o caso), pronta para virar teste.
import fc from 'fast-check'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { EstadoRobo, Pergunta } from '../../supabase/functions/_shared/robo.ts'
import { ehIdosa, respostas, ruido, sujar, verdade, type Ruido, type Verdade } from './familias.ts'
import { conferir, conferirConversa, type Gravidade, type Violacao } from './regras.ts'

type Robo = typeof import('../../supabase/functions/_shared/robo.ts')
const { contratoComParteFixa, novoEstado, responder } = (await import(
  process.env.ROBO ? pathToFileURL(resolve(process.env.ROBO)).href : '../../supabase/functions/_shared/robo.ts'
)) as Robo

const AGORA = new Date('2026-10-19T13:00:00Z') // segunda, 10h em Santos
const ABERTURAS = ['oi', 'Boa tarde', 'olá, vi o anúncio do BPC']

interface Caso {
  v: Verdade
  escolhas: number[]
  ruidos: Ruido[]
}

const caso: fc.Arbitrary<Caso> = fc.record({
  v: verdade,
  escolhas: fc.array(fc.nat({ max: 50 }), { minLength: 30, maxLength: 30 }),
  ruidos: fc.array(ruido, { minLength: 30, maxLength: 30 }),
})

interface Turno {
  cliente: string
  robo: string[]
  pausado: boolean
}

export function rodar(c: Caso) {
  let estado: EstadoRobo = novoEstado()
  const turnos: Turno[] = []
  const falas: string[] = []
  const violacoes: (Violacao & { turno?: number })[] = []
  for (let i = 0; i < 26; i++) {
    let fala: string
    if (i === 0) {
      const opcoes = [...ABERTURAS, ...respostas('abertura_quem', c.v)]
      fala = opcoes[c.escolhas[0] % opcoes.length]
    } else {
      if (estado.pausado || !estado.ultimaPergunta) break
      const opcoes = respostas(estado.ultimaPergunta as Pergunta, c.v)
      fala = opcoes[c.escolhas[i] % opcoes.length]
    }
    fala = sujar(fala, c.ruidos[i])
    falas.push(fala)
    const r = responder(estado, fala, AGORA)
    for (const resposta of r.respostas) for (const x of conferir(resposta, { falasDoCliente: falas })) violacoes.push({ ...x, turno: i })
    turnos.push({ cliente: fala, robo: r.respostas, pausado: r.estado.pausado })
    estado = r.estado
  }
  violacoes.push(...conferirConversa(turnos))

  // A ficha do robo contra a verdade da familia.
  const f = estado.ficha
  const v = c.v
  const idosa = ehIdosa(v)
  const errado = (regra: string, gravidade: Gravidade, trecho: string) => violacoes.push({ regra, gravidade, trecho })
  const todas = turnos.flatMap((t) => t.robo).join('\n')
  if (/não entendi duas vezes|alguém da equipe te chamar aqui/i.test(todas) && /Vou pedir para alguém da equipe/.test(todas))
    errado('robô desistiu: não entendeu duas vezes uma resposta normal', 'alta', turnos.at(-1)?.cliente ?? '')
  const paraEsperado = v.para === 'mae' || v.para === 'pai' ? 'familiar' : v.para
  if (f.para && f.para !== paraEsperado) errado('entendeu errado para quem é o benefício', 'alta', `${f.para} (era ${paraEsperado})`)
  if (f.idade !== undefined && f.idade !== v.idade) errado('gravou a idade errada', 'alta', `${f.idade} (era ${v.idade})`)
  // D1: laudo de qualquer ano e "tem laudo"; o robo nao decide se serve.
  // 'recente' e 'antigo' sao o "tem laudo" do v2.5: comparar so tem, sem e nao sei.
  const temOuNao = (l: string) => (l === 'recente' || l === 'antigo' ? 'tem' : l)
  if (f.laudo && !idosa && v.diagnostico !== 'nenhum' && temOuNao(f.laudo) !== temOuNao(v.laudo)) errado('entendeu errado o laudo', 'alta', `${f.laudo} (era ${v.laudo})`)
  if (f.cadunico && f.cadunico !== v.cadunico) errado('entendeu errado o CadÚnico', 'media', `${f.cadunico} (era ${v.cadunico})`)
  if (f.pessoasCasa !== undefined && f.pessoasCasa !== v.pessoas) errado('gravou errado quantas pessoas moram na casa', 'alta', `${f.pessoasCasa} (era ${v.pessoas})`)
  if (f.rendaCasa !== undefined && Math.abs(f.rendaCasa - v.renda) > 1) errado('gravou a renda errada', 'alta', `${f.rendaCasa} (era ${v.renda})`)
  if (f.pedidoAnterior && f.pedidoAnterior !== (v.pedido === 'negado_recente' ? 'negado' : v.pedido)) errado('entendeu errado o pedido anterior no INSS', 'media', `${f.pedidoAnterior} (era ${v.pedido})`)
  // Bolsa Familia nao e aposentadoria, pensao nem BPC: nao conta como "outro beneficio da casa".
  if (f.outrosBeneficios && (f.outrosBeneficios === 'sim') !== (v.outros === 'aposentadoria' || v.outros === 'bpc'))
    errado('entendeu errado os outros benefícios da casa', 'media', `${f.outrosBeneficios} (era ${v.outros})`)
  if (f.beneficioProprio && (f.beneficioProprio === 'sim') !== (v.recebe === 'pensao')) errado('entendeu errado se a própria pessoa já recebe benefício', 'alta', `${f.beneficioProprio} (era ${v.recebe})`)
  // D1: o valor fixo so existe sem laudo e pela fase medica parceira.
  if (f.laudo && !idosa && (f.laudo !== 'sem' || f.faseMedica) && contratoComParteFixa(f) !== (v.laudo === 'sem' && v.aceitaFaseMedica))
    errado('versão do contrato errada (com ou sem os R$ 1.000)', 'critica', `parte fixa ${contratoComParteFixa(f)}`)
  // D4: "se qualifica sim" so no fechamento limpo, sem impedimento.
  if (/se qualifica sim/.test(todas) && (v.recebe === 'pensao' || (v.diagnostico === 'nenhum' && !idosa)))
    errado('falsa expectativa: "se qualifica sim" com impedimento', 'critica', turnos.at(-1)?.cliente ?? '')
  // D2: medico parceiro so para quem tem doenca e nao tem laudo.
  if (/médico parceiro/.test(todas) && (idosa || v.diagnostico === 'nenhum' || v.laudo !== 'sem'))
    errado('ofereceu o médico parceiro a quem não devia', 'alta', `laudo ${v.laudo}, diagnóstico ${v.diagnostico}`)
  // D7: negativa ha menos de 30 dias vira prioridade.
  if (f.diasNegado !== undefined && f.diasNegado <= 30 && !/como prioridade/.test(todas)) errado('negativa recente sem prioridade', 'alta', f.tempoNegado ?? '')
  return { violacoes, turnos, ficha: f }
}

function transcricao(turnos: Turno[]): string {
  return turnos.map((t) => `  FAMÍLIA: ${t.cliente}\n${t.robo.map((r) => `  ROBÔ: ${r.replace(/\n/g, ' / ')}`).join('\n') || '  ROBÔ: (nada)'}`).join('\n')
}

const quantas = Number(process.argv[2] ?? 3000)
const semente = Number(process.argv[3] ?? 20261020)
const amostra = fc.sample(caso, { numRuns: quantas, seed: semente })
const porRegra = new Map<string, { gravidade: Gravidade; vezes: number; conversas: number }>()
let comDefeito = 0
for (const c of amostra) {
  const { violacoes } = rodar(c)
  if (violacoes.length) comDefeito += 1
  const vistas = new Set<string>()
  for (const x of violacoes) {
    const r = porRegra.get(x.regra) ?? { gravidade: x.gravidade, vezes: 0, conversas: 0 }
    r.vezes += 1
    if (!vistas.has(x.regra)) r.conversas += 1
    vistas.add(x.regra)
    porRegra.set(x.regra, r)
  }
}

// --teste (teste de mutacao): so diz se alguma familia achou defeito, sem encolher os casos.
if (process.argv.includes('--teste')) process.exit(comDefeito ? 1 : 0)

const ordem: Gravidade[] = ['critica', 'alta', 'media', 'baixa']
const achados = [...porRegra.entries()].sort((a, b) => ordem.indexOf(a[1].gravidade) - ordem.indexOf(b[1].gravidade) || b[1].conversas - a[1].conversas)
const relatorio: unknown[] = []
console.log(`Fuzz: ${quantas} conversas, semente ${semente}\n`)
for (const [regra, r] of achados) {
  // O menor caso que reproduz: o fast-check encolhe ate sobrar o essencial.
  const prova = fc.check(fc.property(caso, (c) => !rodar(c).violacoes.some((x) => x.regra === regra)), { seed: semente, numRuns: quantas })
  const menor = prova.counterexample?.[0] as Caso | undefined
  const exemplo = menor ? rodar(menor) : undefined
  const trecho = exemplo?.violacoes.find((x) => x.regra === regra)?.trecho ?? ''
  console.log(`[${r.gravidade.toUpperCase()}] ${regra}: ${r.conversas} de ${quantas} conversas (${((100 * r.conversas) / quantas).toFixed(1)}%)`)
  if (exemplo) console.log(`  trecho: ${trecho}\n${transcricao(exemplo.turnos)}\n`)
  relatorio.push({ regra, ...r, trecho, verdade: menor?.v, conversa: exemplo?.turnos })
}
if (!achados.length) console.log('Nenhuma regra quebrada.')
mkdirSync('tests/painel/resultados', { recursive: true })
console.log(`\n${comDefeito} de ${quantas} conversas com algum defeito`)
writeFileSync(`tests/painel/resultados/${process.env.ROBO ? 'fuzz-outra-versao' : 'fuzz'}.json`, JSON.stringify({ quantas, semente, comDefeito, achados: relatorio }, null, 2))
