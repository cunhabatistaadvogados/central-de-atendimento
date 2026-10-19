// Roda com: node tests/robo.test.ts (Node 24 le TypeScript direto).
// Cada conversa aqui e uma que aparece no diagnostico do Lucas.
import assert from 'node:assert/strict'
import {
  contratoComParteFixa,
  novoEstado,
  responder,
  type EstadoRobo,
  type Sinal,
} from '../supabase/functions/_shared/robo.ts'

const SEGUNDA_10H = new Date('2026-10-19T13:00:00Z')
const SEGUNDA_20H = new Date('2026-10-19T23:00:00Z')
const SEXTA_19H = new Date('2026-10-23T22:00:00Z')

let total = 0
function caso(nome: string, fn: () => void) {
  total += 1
  try {
    fn()
  } catch (erro) {
    console.error(`FALHOU: ${nome}`)
    throw erro
  }
}

function conversa(falas: string[], agora = SEGUNDA_10H) {
  let estado: EstadoRobo = novoEstado()
  const robo: string[][] = []
  const sinais: Sinal[] = []
  for (const fala of falas) {
    const r = responder(estado, fala, agora)
    estado = r.estado
    robo.push(r.respostas)
    sinais.push(...r.sinais)
  }
  return { estado, robo, sinais, ultima: robo.at(-1)?.join('\n') ?? '' }
}

function umaPergunta(texto: string) {
  const perguntas = (texto.match(/\?/g) ?? []).length
  assert.ok(perguntas <= 1, `mais de uma pergunta: "${texto}"`)
}

caso('anuncio: autismo com laudo, renda baixa, fecha com dois horarios', () => {
  const c = conversa([
    'Oi, meu filho tem laudo de autismo e quero saber sobre o BPC/LOAS',
    'Juliana, ele tem 6 anos',
    'precisa de ajuda pra tudo, faz terapia',
    'pelo SUS, no CAPS',
    'sim, está atualizado',
    'somos 4 pessoas e a renda é R$ 1.200',
    'não',
    'nunca pedimos',
  ])
  assert.match(c.robo[0][0], /^Oi! Que bom que você chamou\./)
  assert.match(c.robo[0][0], /seu nome e quantos anos tem seu filho/)
  assert.equal(c.estado.ficha.nome, 'Juliana')
  assert.equal(c.estado.ficha.idade, 6)
  assert.equal(c.estado.ficha.diagnostico, 'Autismo (TEA)')
  assert.equal(c.estado.ficha.laudo, 'recente')
  assert.equal(c.estado.ficha.tratamento, 'SUS')
  assert.equal(c.estado.ficha.pessoasCasa, 4)
  assert.equal(c.estado.ficha.rendaCasa, 1200)
  assert.match(c.ultima, /se qualifica sim para o atendimento com o nosso especialista em BPC, o Dr\. André/)
  assert.match(c.ultima, /hoje à tarde ou amanhã de manhã/)
  assert.doesNotMatch(c.ultima, /tem direito|vai receber|vai ganhar/)
  assert.ok(c.sinais.some((s) => s.tipo === 'encaminhar'))
  assert.ok(c.sinais.some((s) => s.tipo === 'etapa' && s.etapa === 'qualificado'))
  for (const r of c.robo.flat()) umaPergunta(r)
  assert.equal(contratoComParteFixa(c.estado.ficha), false)
})

caso('diagnostico ja dito na 1a mensagem nao e perguntado de novo', () => {
  const c = conversa(['meu filho é autista', 'Carla, 8 anos'])
  assert.doesNotMatch(c.ultima, /qual é o diagnóstico/)
  assert.match(c.ultima, /laudo/)
})

caso('horario escolhido marca reuniao e promete contrato', () => {
  const c = conversa([
    'meu filho tem laudo de autismo',
    'Ana, 5 anos',
    'sim recente',
    'faz terapia',
    'plano',
    'tem atualizado',
    '3 pessoas, renda de 1500',
    'ninguém',
    'não',
    'amanhã de manhã',
  ])
  assert.match(c.ultima, /^Combinado, amanhã de manhã\. .*contrato e a lista de documentos/)
  assert.ok(c.sinais.some((s) => s.tipo === 'reuniao'))
  assert.ok(c.sinais.some((s) => s.tipo === 'etapa' && s.etapa === 'reuniao'))
  const fim = responder(c.estado, 'pode sim', SEGUNDA_10H)
  assert.equal(fim.estado.pausado, true)
})

caso('pelo site: nao assume BPC e descobre para quem e', () => {
  const c = conversa(['Gostaria de falar com um advogado previdenciário'])
  // "falar com um advogado" NAO pode virar "pediu pessoa" logo na abertura do site
  assert.match(c.ultima, /Me conta seu nome e o que está acontecendo: é benefício do INSS para você ou para alguém da família\?/)
  assert.equal(c.estado.pausado, false)
})

caso('sem laudo: oferece fase medica parceira; aceitou encaminha com pendencia', () => {
  const c = conversa(['minha filha tem autismo', 'Paula, ela tem 4 anos', 'não tem laudo ainda, está na fila do SUS', 'quero saber sim'])
  assert.match(c.robo[2][0], /médico parceiro que atende por videochamada/)
  assert.match(c.ultima, /Funciona assim/)
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto.includes('fase médica')))
  assert.ok(c.sinais.some((s) => s.tipo === 'encaminhar'))
  assert.equal(contratoComParteFixa(c.estado.ficha), true)
  assert.doesNotMatch(c.robo.flat().join(' '), /grátis|garante o laudo|laudo perfeito/)
})

caso('sem laudo e recusou: pendencia de 7 dias e segue as perguntas', () => {
  const c = conversa(['meu filho tem autismo', 'Rosa, 7 anos', 'não', 'agora não', 'pode', 'ele precisa de ajuda pra comer'])
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'laudo médico' && s.dias === 7))
  assert.match(c.robo[4][0], /rotina/)
  assert.match(c.ultima, /SUS ou por plano/)
})

caso('preco com laudo: tabela, sem desconto, e equipe assume', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Bia, 9 anos', 'sim, é deste ano', 'quanto custa?'])
  assert.match(c.ultima, /3 salários mínimos e 30% dos atrasados/)
  assert.doesNotMatch(c.ultima, /1\.000/)
  assert.equal(c.estado.pausado, true)
  assert.notEqual(c.estado.ficha.rotina, 'quanto custa?', 'pergunta de preco nao e resposta da rotina')
  const direto = conversa(['meu filho tem laudo de autismo', 'Bia, 9 anos', 'quanto custa?'])
  assert.equal(direto.estado.ficha.rotina, undefined)
})

caso('preco sem saber do laudo: pergunta o laudo antes', () => {
  const c = conversa(['oi, quanto custa pra entrar com o bpc do meu filho?'])
  assert.match(c.ultima, /já tem laudo do médico\?/)
  const d = responder(c.estado, 'não tem', SEGUNDA_10H)
  assert.match(d.respostas[0], /R\$ 1\.000 fixos/)
})

caso('parcelamento so quando pedem', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Lia, 6 anos', 'sim recente', 'dá pra parcelar?'])
  assert.match(c.ultima, /até 6 vezes/)
  const semPedir = conversa(['meu filho tem laudo de autismo', 'Lia, 6 anos', 'sim recente', 'quanto custa'])
  assert.doesNotMatch(semPedir.ultima, /parcel|6 vezes/)
})

caso('"e golpe?" responde com OAB e volta para a pergunta', () => {
  const c = conversa(['meu filho tem autismo', 'isso é golpe?'])
  assert.match(c.ultima, /OAB\/SP 9\.894/)
  const d = responder(c.estado, 'pode continuar', SEGUNDA_10H)
  assert.match(d.respostas[0], /nome e quantos anos/)
})

caso('marido/esposa: pendencia de 3 dias e resumo', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Sara, 6 anos', 'preciso falar com meu marido antes', 'sim'])
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'decisão em família' && s.dias === 3))
  assert.match(c.robo[3][0], /resumo/)
  assert.match(c.robo[3][0], /Autismo/)
})

caso('idoso pula laudo e rotina', () => {
  const c = conversa(['oi, é pra mim', 'Sou a Maria, tenho 67 anos', 'tenho sim atualizado', 'moro sozinha, sem renda', 'não', 'já pedi e foi negado', 'faz 2 meses'])
  assert.doesNotMatch(c.robo.flat().join(' '), /laudo|rotina/)
  assert.equal(c.estado.ficha.pessoasCasa, 1)
  assert.equal(c.estado.ficha.rendaCasa, 0)
  assert.match(c.robo[5][0], /não encerra o assunto/)
  assert.match(c.ultima, /se qualifica sim/)
})

caso('sem CadUnico: orienta CRAS, pendencia, continua', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Tina, 10 anos', 'sim recente', 'terapia', 'sus', 'não temos', 'dá sim'])
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'inscrição no CadÚnico'))
  assert.match(c.robo[5][0], /CRAS da sua cidade, de graça/)
  assert.match(c.ultima, /Quantas pessoas moram na casa/)
})

caso('nao entendeu duas vezes: encaminha', () => {
  // rotina e texto livre; a pergunta do CadUnico precisa de resposta de verdade
  const c = conversa(['meu filho tem laudo de autismo', 'Tais, 6 anos', 'faz terapia', 'sus', 'asdf', 'qwer'])
  assert.match(c.robo[4][0], /não entendi/)
  assert.equal(c.estado.pausado, true)
})

caso('fora do horario: oferece amanha 9h ou 10h e avisa que a equipe confirma cedo', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Gil, 6 anos', 'sim recente', 'terapia', 'sus', 'sim atualizado', '4 pessoas 1000 reais', 'não', 'não'], SEGUNDA_20H)
  assert.match(c.ultima, /amanhã de manhã, 9h ou 10h/)
  assert.match(c.ultima, /equipe confirma logo cedo/)
  const sexta = conversa(['meu filho tem laudo de autismo', 'Gil, 6 anos', 'sim recente', 'terapia', 'sus', 'sim atualizado', '4 pessoas 1000 reais', 'não', 'não'], SEXTA_19H)
  assert.match(sexta.ultima, /segunda de manhã/)
})

caso('"atendem em Minas?" na 1a mensagem: responde, guarda a cidade e nao a toma por nome', () => {
  const c = conversa(['meu filho tem autismo, vocês atendem em Minas?', 'Belo Horizonte', 'Tatiane, ele tem 5 anos'])
  assert.match(c.robo[0][0], /^Oi! Que bom que você chamou\. Atende sim\./)
  assert.equal(c.estado.ficha.cidade, 'Belo Horizonte')
  assert.equal(c.estado.ficha.nome, 'Tatiane')
  assert.match(c.robo[1][0], /nome e quantos anos/)
})

caso('pediu pessoa: encaminha na hora', () => {
  const c = conversa(['meu filho tem autismo', 'quero falar com uma pessoa'])
  assert.equal(c.ultima, 'Combinado, já aviso a equipe agora.')
  assert.equal(c.estado.pausado, true)
})

caso('robo nunca pede documento na qualificacao', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Eva, 6 anos', 'sim recente', 'terapia', 'sus', 'sim', '2 pessoas, 800 reais', 'não', 'não'])
  assert.doesNotMatch(c.robo.slice(0, -1).flat().join(' '), /CPF|RG|foto/)
})

caso('pausado nao responde', () => {
  const e = { ...novoEstado(), pausado: true }
  assert.deepEqual(responder(e, 'oi').respostas, [])
})

console.log(`robo: ${total} conversas ok`)
