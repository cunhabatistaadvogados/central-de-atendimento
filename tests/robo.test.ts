// Roda com: node tests/robo.test.ts (Node 24 le TypeScript direto).
// Cada conversa aqui e uma do diagnostico do Lucas ou uma correcao do Raio-X
// (C01 a C29) e dos ajustes do idoso aprovados em 21/10/2026. Nomes e dados
// inventados: nenhum cliente real.
import assert from 'node:assert/strict'
import {
  ABERTURA,
  AVISO_SAUDE,
  NOTA_LOAS_14,
  NOTA_PARENTES,
  NOTA_SEM_APOIO,
  TEXTO_JURIDICO,
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

function conversa(falas: string[], agora = SEGUNDA_10H, inicio: EstadoRobo = novoEstado()) {
  let estado: EstadoRobo = inicio
  const robo: string[][] = []
  const sinais: Sinal[] = []
  for (const fala of falas) {
    const r = responder(estado, fala, agora)
    estado = r.estado
    robo.push(r.respostas)
    sinais.push(...r.sinais)
  }
  return { estado, robo, sinais, ultima: robo.at(-1)?.join('\n') ?? '', tudo: robo.flat().join('\n'), ficha: estado.ficha }
}

function umaPergunta(texto: string) {
  const perguntas = (texto.match(/\?/g) ?? []).length
  assert.ok(perguntas <= 1, `mais de uma pergunta: "${texto}"`)
}

const encaminhou = (c: { sinais: Sinal[] }, motivo?: RegExp) => c.sinais.some((s) => s.tipo === 'encaminhar' && (!motivo || motivo.test(s.motivo)))

// Caminho comum ate a casa: filho autista com laudo.
const ATE_CASA = ['meu filho tem laudo de autismo', 'Ana, ele tem 6 anos', 'precisa de ajuda pra tudo, faz terapia', 'pelo SUS', 'sim, atualizado']

caso('anuncio: autismo com laudo, renda baixa, fecha com dois horarios', () => {
  const c = conversa([
    'Olá! Meu filho tem laudo de autismo e quero saber sobre o benefício BPC LOAS',
    'Juliana, ele tem 6 anos',
    'precisa de ajuda pra tudo, faz terapia',
    'pelo SUS, no CAPS',
    'sim, está atualizado',
    'eu, o pai dele e a irmã',
    'uns 1200 por mês',
    'não',
    'ninguém',
    'nunca pedimos',
  ])
  assert.equal(c.robo[0][0], `${ABERTURA} Me conta seu nome e quantos anos tem seu filho?`)
  assert.equal(c.ficha.nome, 'Juliana')
  assert.equal(c.ficha.idade, 6)
  assert.equal(c.ficha.diagnostico, 'Autismo (TEA)')
  assert.equal(c.ficha.laudo, 'tem')
  assert.equal(c.ficha.tratamento, 'SUS')
  assert.equal(c.ficha.pessoasCasa, 4)
  assert.equal(c.ficha.rendaCasa, 1200)
  assert.equal(c.ficha.campanha, 'autista')
  assert.match(c.ultima, /^Juliana, pelo que você me contou, seu caso se qualifica sim para o atendimento com o nosso advogado de BPC, o Dr\. André\. Vamos marcar: hoje à tarde ou amanhã de manhã é melhor para você\?$/)
  assert.doesNotMatch(c.tudo, /tem direito|vai receber|vai ganhar|especialista|quando o benefício sair/)
  assert.ok(encaminhou(c, /Qualificação completa/))
  assert.ok(c.sinais.some((s) => s.tipo === 'etapa' && s.etapa === 'qualificado'))
  for (const r of c.robo.flat()) umaPergunta(r)
  assert.equal(contratoComParteFixa(c.ficha), false)
})

caso('C11/C12: Mary so na abertura; aviso de saude uma vez, antes da 1a pergunta de saude', () => {
  const c = conversa(['oi', 'é pro meu filho', 'Ana, ele tem 6 anos', 'autismo'])
  assert.equal(c.robo[0][0], `${ABERTURA} Me conta seu nome e para quem seria o benefício?`)
  assert.equal(c.robo[1][0], 'Me conta seu nome e quantos anos tem seu filho?')
  assert.equal(c.robo[2][0], `Prazer, Ana. ${AVISO_SAUDE} Qual o diagnóstico dele, e desde quando?`)
  assert.equal(c.robo[3][0], 'Entendo. Ele tem laudo do médico com o diagnóstico, e de que ano é?')
  assert.equal(c.tudo.split(AVISO_SAUDE).length, 2, 'aviso de saude uma vez so')
  assert.equal(c.tudo.split('Mary').length, 2, 'a Mary se apresenta uma vez so')
})

caso('diagnostico ja dito na 1a mensagem nao e perguntado de novo', () => {
  const c = conversa(['meu filho é autista', 'Carla, 8 anos'])
  assert.doesNotMatch(c.ultima, /diagnóstico dele/)
  assert.match(c.ultima, /laudo/)
  assert.match(c.ultima, /^Prazer, Carla\. Antes de seguir/)
})

caso('horario escolhido marca reuniao e promete contrato', () => {
  const c = conversa([...ATE_CASA, '3 pessoas, renda de 1500', 'não', 'ninguém', 'não', 'amanhã de manhã'])
  assert.match(c.ultima, /^Combinado, amanhã de manhã\. .*contrato e a lista de documentos/)
  assert.ok(c.sinais.some((s) => s.tipo === 'reuniao' && s.quando === 'amanhã de manhã'))
  assert.ok(c.sinais.some((s) => s.tipo === 'etapa' && s.etapa === 'reuniao'))
  const fim = responder(c.estado, 'pode sim', SEGUNDA_10H)
  assert.equal(fim.estado.pausado, true)
  assert.match(fim.respostas[0], /^Perfeito, Ana\./)
})

caso('C02: no horario, pergunta e duvida nao marcam; "amanha nao posso" tira o dia', () => {
  const base = [...ATE_CASA, '3 pessoas, renda de 1500', 'não', 'ninguém', 'não']
  const preco = conversa([...base, 'antes disso, quanto vou ter que pagar?'])
  assert.ok(!preco.sinais.some((s) => s.tipo === 'reuniao'))
  assert.match(preco.ultima, /3 salários mínimos/)
  const quinta = conversa([...base, 'amanhã não posso, só na quinta'])
  assert.equal(quinta.ficha.horario, 'quinta')
  const sim = conversa([...base, 'sim'])
  assert.ok(!sim.sinais.some((s) => s.tipo === 'reuniao'))
  assert.equal(sim.ultima, 'Só para confirmar: prefere hoje à tarde ou amanhã de manhã?')
  const golpe = conversa([...base, 'quais documentos?'])
  assert.match(golpe.ultima, /^Foto do RG .* A equipe te pede na hora certa\. Só para confirmar: prefere hoje à tarde ou amanhã de manhã\?$/)
})

caso('texto 12: "nao" ao contrato antes da reuniao nunca vira "Perfeito"', () => {
  const c = conversa([...ATE_CASA, '3 pessoas, renda de 1500', 'não', 'ninguém', 'não', 'amanhã às 9h', 'não, prefiro ver o contrato só na reunião'])
  assert.equal(c.ficha.horario, 'amanhã às 9h')
  assert.equal(c.ultima, 'Tudo bem. A equipe te chama no horário combinado e explica tudo antes de qualquer contrato.')
  const protesto = conversa([...ATE_CASA, '3 pessoas, renda de 1500', 'não', 'ninguém', 'não', 'hoje à tarde', 'pera, eu n marquei nada'])
  assert.match(protesto.ultima, /^Desculpa, entendi errado\. Só para confirmar/)
  assert.equal(protesto.estado.pausado, false)
})

caso('pelo site: nao assume BPC e descobre para quem e', () => {
  const c = conversa(['Gostaria de falar com um advogado previdenciário'])
  // "falar com um advogado" NAO pode virar "pediu pessoa" logo na abertura do site
  assert.equal(c.ultima, `${ABERTURA} Me conta seu nome e o que está acontecendo: é benefício do INSS para você ou para alguém da família?`)
  assert.equal(c.estado.pausado, false)
  assert.ok(c.sinais.some((s) => s.tipo === 'origem' && s.origem === 'site'))
})

caso('origem: Google, site e Meta pela mensagem', () => {
  assert.ok(conversa(['Olá! Vi no Google o anúncio do BPC/LOAS para autismo']).sinais.some((s) => s.tipo === 'origem' && s.origem === 'google' && s.campanha === 'autista'))
  assert.equal(conversa(['oi, venho pelo site']).ficha.origem, 'site')
  assert.equal(conversa(['vi no instagram de vocês']).ficha.origem, 'meta')
  assert.ok(conversa(['quero saber do loas do idoso pra minha mãe']).sinais.some((s) => s.tipo === 'origem' && s.campanha === 'idoso'))
})

caso('D2/C18: sem laudo, "como funciona?" explica e SEGUE a triagem antes do horario', () => {
  const c = conversa(['minha filha tem autismo', 'Paula, ela tem 4 anos', 'não tem laudo ainda, está na fila do SUS', 'como funciona?'])
  assert.match(c.robo[2][0], /médico parceiro que atende por videochamada, avalia sua filha e, se for o caso, emite o laudo\. Quer saber como funciona\?$/)
  assert.match(c.ultima, /^Funciona assim: o advogado confere seus documentos básicos, o contrato é assinado e aí a equipe agenda a consulta\. Antes disso, como é a rotina dela/)
  assert.ok(!encaminhou(c), 'curiosidade nao encerra a triagem')
  assert.doesNotMatch(c.tudo, /se qualifica|grátis|garante o laudo|com o detalhe que o INSS pede/)
  assert.equal(c.ficha.faseMedica, 'explicada')
  assert.equal(contratoComParteFixa(c.ficha), true)
})

caso('D2: aceite so com "quero"/"pode ser"; pendencia de documentos so no fechamento', () => {
  const c = conversa(['meu filho tem autismo', 'Rita, 5 anos', 'não tem', 'pode ser', 'precisa de ajuda', 'sus', 'sim atualizado', 'somos 3, renda de 900', 'não', 'não', 'não'])
  assert.equal(c.ficha.faseMedica, 'aceitou')
  assert.match(c.robo[3][0], /^Combinado\. Funciona assim/)
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'documentos básicos para a fase médica' && s.dias === 1))
  assert.match(c.ultima, /se qualifica sim/)
})

caso('D2: "eu quero saber e do beneficio" e recusa: pendencia de 7 dias e segue sem medico', () => {
  const c = conversa(['meu filho tem autismo', 'Rosa, 7 anos', 'não', 'não precisa de médico não, eu quero saber é do benefício', 'pode', 'ele precisa de ajuda pra comer'])
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'laudo médico' && s.dias === 7))
  assert.equal(c.ficha.faseMedica, 'recusou')
  assert.match(c.robo[4][0], /rotina/)
  assert.match(c.ultima, /SUS ou por plano/)
  assert.equal(contratoComParteFixa(c.ficha), false)
})

caso('preco com laudo: tabela, "se o beneficio for concedido", e equipe assume', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Bia, 9 anos', 'quanto custa?'])
  assert.equal(c.ultima, 'São 3 salários mínimos e 30% dos atrasados. Você só paga no final, se o benefício for concedido. Posso pedir para a equipe te chamar e explicar os detalhes?')
  assert.equal(c.estado.pausado, true)
  assert.equal(c.ficha.rotina, undefined, 'pergunta de preco nao e resposta da rotina')
})

caso('preco sem saber do laudo: pergunta antes; "nao sei" nao recebe valor (C06)', () => {
  const c = conversa(['oi, quanto custa pra entrar com o bpc do meu filho?'])
  assert.match(c.ultima, /Ele já tem laudo do médico\?$/)
  assert.match(responder(c.estado, 'não tem', SEGUNDA_10H).respostas[0], /^São R\$ 1\.000 fixos/)
  const naoSei = responder(c.estado, 'não sei', SEGUNDA_10H)
  assert.equal(naoSei.respostas[0], 'A equipe explica os valores depois de ver o laudo.')
  assert.equal(naoSei.estado.pausado, true)
})

caso('C04: pergunta sobre o medico ou a consulta nunca recebe a tabela', () => {
  const c = conversa(['minha filha tem autismo', 'Lia, 4 anos', 'não tem', 'esse médico é pago?'])
  assert.equal(c.ultima, 'Isso a equipe explica direitinho, como funciona a consulta.')
  assert.doesNotMatch(c.ultima, /1\.000|salários/)
  assert.ok(encaminhou(c))
})

caso('C03: parcelamento so quando pedem; "dividir as contas" nao e pedido', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Lia, 6 anos', 'dá pra parcelar?'])
  assert.match(c.ultima, /até 6 vezes, e só começam depois, se o benefício for concedido/)
  const contas = conversa([...ATE_CASA, 'somos 3, a gente costuma dividir as contas, entra uns 1500'])
  assert.doesNotMatch(contas.tudo, /parcel|6 vezes|divididos/)
  assert.equal(contas.ficha.rendaCasa, 1500)
  assert.equal(contas.ficha.pessoasCasa, 3)
})

caso('C05: "valor" na resposta da renda e renda, nao preco', () => {
  const c = conversa([...ATE_CASA, 'somos 4 e o valor que entra é 1200 por mês'])
  assert.equal(c.ficha.rendaCasa, 1200)
  assert.doesNotMatch(c.ultima, /salários mínimos|laudo/)
})

caso('"e golpe?" responde com OAB, nunca pede senha, e volta para a pergunta', () => {
  const c = conversa(['meu filho tem autismo', 'isso é golpe?'])
  assert.match(c.ultima, /OAB\/SP 9\.894.*Nós nunca pedimos senha/)
  const d = responder(c.estado, 'pode continuar', SEGUNDA_10H)
  assert.equal(d.respostas[0], 'Me conta seu nome e quantos anos tem seu filho?')
})

caso('C29: "e verdade que precisa de laudo?" e pergunta juridica, nao desconfianca', () => {
  const c = conversa(['meu filho tem autismo', 'Ana, 6 anos', 'é verdade que precisa de laudo?'])
  assert.doesNotMatch(c.ultima, /OAB/)
  assert.ok(c.ultima.startsWith(TEXTO_JURIDICO))
})

caso('C01/D3: pergunta juridica vira duvida para o advogado e a pergunta do roteiro volta', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'mas ele tem direito?'])
  assert.match(c.ultima, /^Essa resposta depende do caso, e quem avalia é o advogado\. Já anotei sua pergunta para ele\. .*rotina dele/)
  assert.equal(c.ficha.rotina, undefined)
  assert.deepEqual(c.ficha.duvidas, ['mas ele tem direito?'])
  assert.ok(c.sinais.some((s) => s.tipo === 'duvida' && s.texto === 'mas ele tem direito?'))
  const automatico = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'autismo dá direito automático né'])
  assert.equal(automatico.ficha.rotina, undefined)
  assert.ok(automatico.ultima.startsWith(TEXTO_JURIDICO))
})

caso('marido/esposa: pendencia de 3 dias e resumo', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Sara, 6 anos', 'preciso falar com meu marido antes', 'sim'])
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'decisão em família' && s.dias === 3))
  umaPergunta(c.robo[2][0])
  assert.match(c.robo[3][0], /resumo/)
  assert.match(c.robo[3][0], /Autismo/)
  assert.equal(c.estado.encaminhado, false)
})

caso('area do idoso: pula laudo e rotina, pergunta biometria, prazo de negativa antiga', () => {
  const c = conversa(['oi, é pra mim', 'Sou a Maria, tenho 67 anos', 'moro sozinha, sem renda', 'não', 'tenho sim, atualizado', 'tenho CNH', 'já pedi e foi negado', 'faz 2 meses'])
  assert.doesNotMatch(c.tudo, /laudo|rotina|diagnóstico|saúde/)
  assert.equal(c.ficha.pessoasCasa, 1)
  assert.equal(c.ficha.rendaCasa, 0)
  assert.equal(c.ficha.biometria, 'sim')
  assert.match(c.robo[3][0], /^A família tem o CadÚnico, aquele cadastro do CRAS/)
  assert.match(c.robo[5][0], /^Você já pediu esse benefício no INSS/)
  assert.match(c.ultima, /^Acontece muito e não encerra o assunto\. O advogado vê se cabe novo pedido ou ação\. Maria, pelo que você me contou, seu caso se qualifica sim/)
  assert.equal(c.ficha.diasNegado, 60)
})

caso('area do idoso: abertura pelo gatilho, familiar, honorarios sem valor fixo, mais de 80 sem biometria', () => {
  const c = conversa(['Oi, quero saber do loas do idoso', 'Cida, minha mãe tem 82', 'só ela e meu pai', 'só a aposentadoria dele, um salário', 'não', 'sim, atualizado', 'nunca pediu'])
  assert.equal(c.robo[0][0], `${ABERTURA} Me conta seu nome e quantos anos tem a pessoa que precisa do benefício?`)
  assert.equal(c.robo[1][0], 'Prazer, Cida. Quem mora com ela na mesma casa?')
  assert.equal(c.ficha.pessoasCasa, 2)
  assert.equal(c.ficha.rendaCasa, 1621)
  assert.equal(c.ficha.outrosBeneficios, 'sim')
  // Item 3: so a anotacao na ficha; a fala do robo nao explica a regra.
  assert.ok(c.ficha.anotacoes?.includes(NOTA_LOAS_14))
  assert.doesNotMatch(c.tudo, /não entra na conta/)
  assert.match(c.robo[3][0], /^Entendi\. Ela já recebe aposentadoria, pensão ou outro benefício do INSS\?$/)
  assert.doesNotMatch(c.tudo, /CNH/, 'mais de 80 anos nao precisa de biometria')
  assert.match(c.ultima, /o caso dela se qualifica sim .* é melhor para vocês\?$/)
  const preco = responder(c.estado, 'quanto custa?', SEGUNDA_10H)
  assert.match(preco.respostas[0], /^São 3 salários mínimos e 30% dos atrasados\./)
  assert.equal(contratoComParteFixa(c.ficha), false)
})

caso('item 1 / C16: 64 anos "e pela idade": texto 6 e horario, sem laudo nem medico', () => {
  const c = conversa(['oi, é pra mim, tenho 64 anos', 'Marcos', 'é pela idade mesmo'])
  assert.equal(c.ultima, 'O BPC do idoso é a partir dos 65 anos. Vou passar seu caso para o advogado ver o que dá para fazer desde já. Hoje à tarde ou amanhã de manhã é melhor?')
  assert.ok(encaminhou(c, /menos de 65 anos sem deficiência/))
  assert.equal(c.ficha.diagnostico, undefined)
  const depois = conversa(['oi, é pra mim, tenho 64 anos', 'Marcos', 'é pela idade mesmo', 'não', 'amanhã de manhã'])
  assert.doesNotMatch(depois.tudo, /médico parceiro|laudo|se qualifica|contrato/)
  assert.equal(depois.ultima, 'Combinado, amanhã de manhã. A equipe te chama nesse horário.')
  assert.equal(depois.estado.pausado, true)
})

caso('item 4 / C15: a propria pessoa ja recebe pensao: texto 7 e horario, nunca "se qualifica"', () => {
  const c = conversa([...ATE_CASA, 'somos 2 e a renda é 300 reais', 'ele recebe pensão por morte do pai'])
  assert.equal(c.ultima, 'Como ele já recebe um benefício, o advogado precisa olhar seu caso com cuidado antes de qualquer pedido. Hoje à tarde ou amanhã de manhã é melhor para te chamarem?')
  assert.ok(encaminhou(c, /já recebe benefício/))
  const oba = responder(c.estado, 'oba então dá pra receber os dois!', SEGUNDA_10H)
  assert.doesNotMatch(oba.respostas.join(' '), /se qualifica|Combinado/)
  // Beneficio de outra pessoa da casa nao e impedimento.
  const pai = conversa([...ATE_CASA, 'somos 3 e a renda é 1621', 'não, só o pai dele que é aposentado'])
  assert.equal(pai.ficha.beneficioProprio, 'nao')
  assert.equal(pai.ficha.outrosBeneficios, 'sim')
  assert.doesNotMatch(pai.ultima, /já recebe um benefício/)
})

caso('item 4: "tem uma pensao aqui em casa" pergunta quem recebe', () => {
  const c = conversa([...ATE_CASA, 'somos 3 e a renda é 1000', 'tem uma pensão aqui em casa'])
  assert.equal(c.ultima, 'Quem recebe: ele ou outra pessoa da casa?')
  assert.match(responder(c.estado, 'ele mesmo', SEGUNDA_10H).respostas[0], /^Como ele já recebe um benefício/)
  const outra = responder(c.estado, 'a avó dele', SEGUNDA_10H)
  assert.equal(outra.estado.ficha.beneficioProprio, 'nao')
  assert.match(outra.respostas[0], /já pediram o BPC/)
})

caso('item 2: idoso que mora sozinho e foi abandonado: anotacao e pergunta simples da renda', () => {
  // Conversa real de 20/10/2026 com nome e dados trocados (pedido do Lucas).
  const c = conversa(['quero o loas do idoso', 'Joaquim, tenho 71 anos', 'Eu moro sozinho', 'eu moro sozinho', 'Fui abandonado', 'nada'])
  assert.equal(c.ficha.pessoasCasa, 1)
  assert.match(c.robo[3][0], /^E quanto entra de dinheiro por mês para você, mais ou menos\? Se não entra nada, pode dizer "nada"\.$/)
  assert.ok(c.ficha.anotacoes?.includes(NOTA_SEM_APOIO))
  assert.match(c.robo[4][0], /^Sinto muito por isso\./)
  assert.equal(c.ficha.rendaCasa, 0)
  assert.doesNotMatch(c.tudo, /não entendi/)
  assert.ok(!encaminhou(c))
  assert.match(c.ultima, /Você já recebe aposentadoria, pensão ou outro benefício do INSS\?/)
})

caso('C27/item 2: CadUnico "Nao" e depois "minha familia tem sim": vale a ultima resposta', () => {
  const c = conversa(['quero o loas do idoso', 'Joaquim, tenho 71 anos', 'moro sozinho', 'nada', 'não', 'Não', 'Minha família tem sim'])
  assert.equal(c.ficha.cadunico, 'atualizado')
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia_resolvida' && s.texto === 'inscrição no CadÚnico'))
  assert.match(c.ultima, /^Que bom, anotei\./)
})

caso('C17: suspeita grava "em investigacao" e laudo "sem"', () => {
  const c = conversa(['oi, é pro meu filho', 'Rodrigo, ele tem 3 anos', 'a creche acha que ele é autista, ta na fila do neuro'])
  assert.equal(c.ficha.diagnostico, 'Em investigação: Autismo (TEA)')
  assert.equal(c.ficha.laudo, 'sem')
  assert.match(c.ultima, /médico parceiro/)
})

caso('D1/C22: laudo de 2019 e "tem laudo": o advogado confere, sem medico e sem valor fixo', () => {
  const c = conversa(['meu filho tem autismo', 'Lúcia, ele tem 7 anos', 'tem, é de 2019'])
  assert.equal(c.ficha.laudo, 'tem')
  assert.equal(c.ficha.laudoAno, 2019)
  assert.doesNotMatch(c.ultima, /médico parceiro/)
  assert.equal(contratoComParteFixa(c.ficha), false)
  const naoSei = conversa(['meu filho tem autismo', 'Lúcia, ele tem 7 anos', 'não sei'])
  assert.equal(naoSei.ficha.laudo, 'nao_sei')
  assert.match(naoSei.ultima, /^Sem problema, o advogado olha isso com você\. Como é a rotina/)
})

caso('D7/C19: negado ha 10 dias: texto 8 e prioridade para a equipe', () => {
  const c = conversa([...ATE_CASA, 'somos 4 e a renda é 1200 reais', 'não', 'já pedimos e negaram', 'faz 10 dias'])
  assert.equal(c.ultima, 'Quando o INSS nega, o prazo para recorrer costuma ser de 30 dias, contados da ciência da decisão. Vou passar seu caso para a equipe agora, como prioridade.')
  assert.ok(encaminhou(c, /^PRIORIDADE: prazo de recurso$/))
  assert.equal(c.estado.pausado, true)
})

caso('C07: desespero e acolhido e vai a equipe, sem falar de pagamento', () => {
  const c = conversa(['oi', 'socorro, meu filho autista está sem remédio e eu não tenho dinheiro nenhum, estou desesperada'])
  assert.equal(c.ultima, 'Sinto muito por isso. Vou pedir para a equipe te chamar agora.')
  assert.ok(encaminhou(c, /família em situação difícil/))
  const preco = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'não tenho como pagar vocês'])
  assert.match(preco.ultima, /^Entendo\. Isso a equipe combina com você/)
})

caso('C08: todas as variacoes de "quero uma pessoa" encaminham na hora', () => {
  for (const fala of ['quero falar com uma pessoa', 'prefiro conversar com um atendente', 'tem alguém da equipe aí?', 'quero falar com uma pessoa de verdade']) {
    const c = conversa(['meu filho tem autismo', fala])
    assert.equal(c.ultima, 'Claro, já aviso a equipe.', fala)
    assert.equal(c.estado.pausado, true)
  }
  assert.equal(conversa(['meu filho tem autismo', 'pode me ligar?']).ultima, 'Combinado, já aviso a equipe agora.')
})

caso('C09: "e ia comecar a fono" nao e "e robo?"; "e robo?" confirma sem negar', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'precisa de ajuda pra tudo e ia começar a fono esse mês'])
  assert.doesNotMatch(c.ultima, /automático/)
  const robo = conversa(['meu filho tem autismo', 'você é um robô?'])
  assert.equal(robo.ultima, 'Sou o atendimento automático da equipe CB&AA, e uma pessoa assume já já. Posso continuar?')
})

caso('C10: senha nunca e gravada nem agradecida; arquivo recebido tem resposta', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'quer que eu te passe minha senha do gov.br?'])
  assert.match(c.ultima, /^Não passe sua senha para ninguém, nem para nós: ela é pessoal\. A equipe orienta tudo sem ela\. Como é a rotina/)
  assert.equal(c.ficha.rotina, undefined)
  assert.doesNotMatch(c.ultima, /Ótimo|Obrigad/)
  const arquivo = conversa(['meu filho tem laudo de autismo', '[arquivo recebido]'])
  assert.equal(arquivo.ultima, 'Recebi. Não precisa mandar documento por aqui agora: a equipe pede na hora certa. Me conta por escrito?')
  assert.equal(conversa(['oi', '[áudio recebido]']).ultima, 'Recebi seu áudio, mas não consegui ouvir direito. Me conta por escrito?')
})

caso('C21: Bolsa Familia: "nao precisa cancelar nada" e segue', () => {
  const c = conversa([...ATE_CASA, 'vou perder o bolsa família?'])
  assert.match(c.ultima, /^Não precisa cancelar nada\. O advogado confere o seu caso\. Quem mora com ele/)
})

caso('C23: "sou de Santos", "sou cuidadora", "sou o pai" nao sao nomes', () => {
  assert.equal(conversa(['oi, sou de Santos, é pro meu filho']).ficha.nome, undefined)
  assert.equal(conversa(['oi, sou cuidadora dele, é pro meu sobrinho']).ficha.nome, undefined)
  assert.equal(conversa(['sou o pai, é pro meu filho']).ficha.nome, undefined)
  assert.equal(conversa(['oi, aqui é a Dona Marta, é pra minha mãe']).ficha.nome, 'Marta')
})

caso('C24: a idade e da pessoa do beneficio; "faz 8 meses" e tempo', () => {
  assert.equal(conversa(['oi, tenho 30 anos e meu filho tem 5, ele é autista']).ficha.idade, 5)
  const tempo = conversa(['oi, é pro meu filho, faz 8 meses que negaram'])
  assert.equal(tempo.ficha.idade, undefined)
  assert.equal(tempo.ficha.pedidoAnterior, 'negado')
  assert.equal(conversa(['é pra minha mãe, ela tem 68']).ficha.idade, 68)
  const corrige = conversa(['meu filho é autista', 'Ana, ele tem 18', 'na verdade hoje ele tem 19'])
  assert.equal(corrige.ficha.idade, 19)
})

caso('C25: casa e renda contadas como a familia fala', () => {
  const eEla = conversa(['minha filha tem laudo de autismo', 'Ana, 6 anos', 'faz terapia', 'sus', 'sim atualizado', 'só eu e ela'])
  assert.equal(eEla.ficha.pessoasCasa, 2)
  const tres = conversa([...ATE_CASA, 'eu e minha esposa e ele'])
  assert.equal(tres.ficha.pessoasCasa, 3)
  const meio = conversa([...ATE_CASA, 'somos 3 e entra um salário e meio'])
  assert.equal(meio.ficha.rendaCasa, 2431.5)
  const soma = conversa([...ATE_CASA, 'somos 4', 'meu marido ganha 1500 e eu faço bico de 300'])
  assert.equal(soma.ficha.rendaCasa, 1800)
  const extenso = conversa([...ATE_CASA, 'somos quatro e ganhamos mil e duzentos'])
  assert.equal(extenso.ficha.pessoasCasa, 4)
  assert.equal(extenso.ficha.rendaCasa, 1200)
  const semReais = conversa([...ATE_CASA, 'somos 2', 'ele ganha 2000'])
  assert.equal(semReais.ficha.rendaCasa, 2000)
})

caso('C26: CadUnico feito ha 3 anos e desatualizado', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'faz terapia', 'sus', 'fiz faz uns 3 anos'])
  assert.equal(c.ficha.cadunico, 'desatualizado')
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'atualizar o CadÚnico'))
})

caso('sem CadUnico: orienta CRAS, pendencia, continua', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Tina, 10 anos', 'terapia', 'sus', 'não temos', 'dá sim'])
  assert.ok(c.sinais.some((s) => s.tipo === 'pendencia' && s.texto === 'inscrição no CadÚnico' && s.dias === 7))
  assert.match(c.robo[4][0], /CRAS da sua cidade, de graça/)
  assert.match(c.ultima, /^Combinado\. Quem mora com ele na mesma casa/)
})

caso('C20: parente que a LOAS pode nao contar vira anotacao, sem conta do robo', () => {
  const c = conversa(['oi, é pra minha mãe, ela tem 70 anos', 'Rita', 'moram 3, minha mãe, meu irmão casado e a esposa dele, a renda deles é 4000'])
  assert.equal(c.ficha.pessoasCasa, 3)
  assert.ok(c.ficha.anotacoes?.includes(NOTA_PARENTES))
  assert.doesNotMatch(c.tudo, /passa|não passa|acima/)
})

caso('C28: cliente antigo e trabalhista vao direto a equipe; desistencia encerra', () => {
  const antigo = conversa(['oi, já sou cliente de vocês, queria saber do meu processo'])
  assert.ok(encaminhou(antigo, /cliente antigo/))
  assert.doesNotMatch(antigo.tudo, /nome|anos/)
  const trab = conversa(['boa tarde, fui demitido sem justa causa e não pagaram minhas verbas'])
  assert.ok(encaminhou(trab, /assunto trabalhista/))
  const desistiu = conversa(['meu filho tem laudo de autismo', 'Ana, 6 anos', 'não quero mais, obrigada'])
  assert.equal(desistiu.ultima, 'Tudo bem, obrigada pelo contato. Se mudar de ideia, é só chamar aqui.')
  assert.ok(desistiu.sinais.some((s) => s.tipo === 'encerrar'))
  assert.ok(!encaminhou(desistiu))
  assert.equal(desistiu.estado.pausado, true)
})

caso('nao entendeu duas vezes: encaminha', () => {
  const c = conversa(['meu filho tem laudo de autismo', 'Tais, 6 anos', 'faz terapia', 'sus', 'asdf', 'qwer'])
  assert.match(c.robo[4][0], /não entendi/)
  assert.equal(c.estado.pausado, true)
})

caso('fora do horario: oferece amanha 9h ou 10h e avisa que a equipe confirma cedo', () => {
  const falas = [...ATE_CASA, '4 pessoas 1000 reais', 'não', 'não', 'não']
  const c = conversa(falas, SEGUNDA_20H)
  assert.match(c.ultima, /amanhã de manhã, 9h ou 10h/)
  assert.match(c.ultima, /equipe confirma logo cedo/)
  assert.match(conversa(falas, SEXTA_19H).ultima, /segunda de manhã/)
})

caso('"atendem em Minas?" na 1a mensagem: responde, guarda a cidade e nao a toma por nome', () => {
  const c = conversa(['meu filho tem autismo, vocês atendem em Minas?', 'Belo Horizonte', 'Tatiane, ele tem 5 anos'])
  assert.equal(c.robo[0][0], `${ABERTURA} Atende sim. O atendimento é online e o pedido no INSS vale para todo o Brasil. Em qual cidade você mora?`)
  assert.equal(c.ficha.cidade, 'Belo Horizonte')
  assert.equal(c.ficha.nome, 'Tatiane')
  assert.match(c.robo[1][0], /^Combinado\. Me conta seu nome e quantos anos/)
})

caso('robo nunca pede documento na qualificacao', () => {
  const c = conversa([...ATE_CASA, '2 pessoas, 800 reais', 'não', 'não', 'não'])
  assert.doesNotMatch(c.tudo, /CPF|RG|foto/)
})

caso('pausado nao responde', () => {
  const e = { ...novoEstado(), pausado: true }
  assert.deepEqual(responder(e, 'oi').respostas, [])
})

caso('ficha antiga do v2.5 ("recente", "antigo") continua valendo', () => {
  const antigo = { ...novoEstado(), mensagensDoCliente: 3, ultimaPergunta: 'rotina' as const, ficha: { para: 'filho' as const, nome: 'Ana', idade: 6, diagnostico: 'Autismo (TEA)', laudo: 'antigo' as const } }
  assert.equal(contratoComParteFixa(antigo.ficha), false)
  const c = conversa(['precisa de ajuda', 'quanto custa?'], SEGUNDA_10H, antigo)
  assert.match(c.ultima, /^São 3 salários mínimos/)
})

// ---------------------------------------------------------------------------
// O que as 24 familias simuladas por IA acharam no v3.2 (21/10/2026, 1a rodada)
// ---------------------------------------------------------------------------

caso('F10: "qro o beneficio do idozo" nao vira nome; texto solto nao vira diagnostico; "nao sou doente" vale', () => {
  const c = conversa(['qro o beneficio do idozo pra mim', 'Antonio, tenho 64 anos', 'moro sozinho, faço uns bico ganho uns 300 por mes', 'nao sou doente'])
  assert.equal(c.ficha.nome, 'Antonio')
  assert.equal(c.ficha.area, 'idoso')
  assert.equal(c.ficha.diagnostico, undefined)
  assert.equal(c.ficha.pessoasCasa, 1)
  assert.equal(c.ficha.rendaCasa, 300)
  assert.match(c.ultima, /^O BPC do idoso é a partir dos 65 anos/)
  assert.doesNotMatch(c.tudo, /se qualifica|laudo|rotina/)
  assert.equal(conversa(['meu filho tem autismo', 'Ana, 6 anos', 'laudo nao tenho nao']).ficha.laudo, 'sem')
})

caso('F01, F02, F03: a 1a palavra so e nome quando parece nome; "meu nome e" corrige', () => {
  assert.equal(conversa(['vi o anuncio e queria saber do loas pro meu irmao']).ficha.nome, undefined)
  assert.equal(conversa(['queria saber do loas pro meu filho que é autista']).ficha.nome, undefined)
  const ta = conversa(['oi', 'pra minha mae', 'ta bom pode'])
  assert.equal(ta.ficha.nome, undefined)
  const camila = conversa(['oi', 'pro meu irmao', 'Vi, ele tem 30', 'kkk meu nome e camila'])
  assert.equal(camila.ficha.nome, 'Camila')
})

caso('F09, F07: casa contada como a familia fala (irmazinha, "somos em 4", "ja falei, 4", quem nao mora)', () => {
  assert.equal(conversa([...ATE_CASA, 'eu, meu marido, o arthur e a irmazinha dele de 3 anos']).ficha.pessoasCasa, 4)
  assert.equal(conversa([...ATE_CASA, 'somos em 4']).ficha.pessoasCasa, 4)
  assert.equal(conversa([...ATE_CASA, 'ja falei, 4']).ficha.pessoasCasa, 4)
  const avo = conversa(['boa tarde minha filha, quero o loas do meu neto Enzo, ele é autista', 'Lúcia, ele tem 7 anos', 'tem, de 2019', 'precisa de ajuda', 'sus', 'sim atualizado', 'sou eu, meu marido e o Enzo. os pais dele nao moram com a gente'])
  assert.equal(avo.ficha.para, 'familiar')
  assert.equal(avo.ficha.quem, 'seu neto')
  assert.equal(avo.ficha.pessoasCasa, 3)
  assert.ok(avo.ficha.anotacoes?.includes(NOTA_PARENTES))
  const irma = conversa(['oi, é pro meu irmao, ele é autista', 'Camila, ele tem 30', 'tem, de 2024', 'precisa de ajuda', 'sus', 'sim', 'ele mora com minha mae e meu pai, eu nao moro la'])
  assert.equal(irma.ficha.pessoasCasa, 3)
})

caso('F07, F01: "um salario cada" de dois aposentados soma os dois; renda picada soma', () => {
  assert.equal(conversa([...ATE_CASA, 'somos 3', 'nos dois somos aposentados, um salario cada']).ficha.rendaCasa, 3242)
  assert.equal(conversa([...ATE_CASA, 'somos 3', 'minha mae o bpc e meu pai aposentadoria, 1621 cada']).ficha.rendaCasa, 3242)
  const picada = conversa([...ATE_CASA, 'somos 2', 'ele é aprendiz e ganha 900', 'eu faço faxina uns 700'])
  assert.equal(picada.ficha.rendaCasa, 1600)
  assert.ok(picada.ficha.anotacoes?.some((a) => /aprendiz/.test(a)))
  // "ela ganha 2000" e salario, nao o ano 2000 do CadUnico (F08).
  const fabio = conversa(['oi, é pra mim, tenho depressão', 'Fábio, 35 anos', 'tem do psiquiatra, de 2026', 'fico deitado o dia todo', 'sus', 'n. moro eu e minha mulher, ela ganha 2000'])
  assert.equal(fabio.ficha.cadunico, 'nao')
  assert.equal(fabio.ficha.rendaCasa, 2000)
})

caso('F09: "login do gov br" recebe o aviso da senha; desconto nunca e prometido', () => {
  const login = conversa([...ATE_CASA.slice(0, 2), 'quer q eu te passe o login do meu gov br? vc entra e ve tudo la'])
  assert.match(login.ultima, /^Não passe sua senha para ninguém/)
  const desconto = conversa([...ATE_CASA.slice(0, 2), 'vcs fazem desconto? a gente ta bem apertado'])
  assert.match(desconto.ultima, /^Entendo\. Isso a equipe combina com você/)
  assert.doesNotMatch(desconto.ultima, /desconto/)
})

caso('F12: "minha mae ja e cliente, gostaria de noticias" vai direto a equipe e nao vira qualificado', () => {
  const c = conversa(['Boa tarde. Minha mãe já é cliente de vocês. Gostaria apenas de notícias.'])
  assert.ok(encaminhou(c, /cliente antigo/))
  assert.ok(!c.sinais.some((s) => s.tipo === 'etapa' && s.etapa === 'qualificado'))
})

caso('F01, F04, F05, F10: pergunta na hora do horario vira duvida para o advogado, nunca so o horario de novo', () => {
  const base = [...ATE_CASA, '3 pessoas, renda de 1500', 'não', 'ninguém', 'não']
  const aprendiz = conversa([...base, 'mas sendo aprendiz ele ainda pode pedir de novo?'])
  assert.equal(aprendiz.ultima, `${TEXTO_JURIDICO} Só para confirmar: prefere hoje à tarde ou amanhã de manhã?`)
  assert.ok(aprendiz.sinais.some((s) => s.tipo === 'duvida'))
  const semInterrogacao = conversa([...base, 'mas o laudo de 2017 serve ou tem q fazer outro'])
  assert.ok(semInterrogacao.ultima.startsWith(TEXTO_JURIDICO))
  const daOuNao = conversa([...base, 'mas entao da ou nao da'])
  assert.ok(daOuNao.ultima.startsWith(TEXTO_JURIDICO))
  // Duas vezes sem escolher: a equipe liga, sem insistir.
  const insiste = conversa([...base, 'sim', 'ok'])
  assert.equal(insiste.estado.pausado, true)
  assert.match(insiste.ultima, /equipe te chamar para combinar o melhor horário/)
})

caso('F07, F05: horario escolhido junto com uma pergunta e marcado', () => {
  const base = [...ATE_CASA, '3 pessoas, renda de 1500', 'não', 'ninguém', 'não']
  const c = conversa([...base, 'amanha de manha ta bom. e quanto vcs cobram?'])
  assert.ok(c.sinais.some((s) => s.tipo === 'reuniao' && s.quando === 'amanhã de manhã'))
  assert.match(c.ultima, /Combinado, amanhã de manhã\.[\s\S]*3 salários mínimos e 30% dos atrasados/)
})

caso('F06 (critica): "quanto custa isso" logo depois do medico parceiro nunca recebe a tabela', () => {
  const c = conversa(['meu filho tem autismo', 'Rodrigo, ele tem 3 anos', 'nao tem laudo', 'quanto custa isso'])
  assert.equal(c.ultima, 'Isso a equipe explica direitinho, como funciona a consulta.')
  assert.doesNotMatch(c.tudo, /1\.000|salários mínimos/)
})

caso('F07 (critica): preco e parcelamento juntos trazem a tabela inteira e depois as parcelas', () => {
  const c = conversa(['meu neto é autista', 'Lúcia, ele tem 7 anos', 'tem, de 2019', 'quanto vcs cobram? da pra parcelar'])
  assert.equal(c.ultima, 'São 3 salários mínimos e 30% dos atrasados. Você só paga no final, se o benefício for concedido. Os 3 salários mínimos podem ser divididos em até 6 vezes. Posso pedir para a equipe te chamar e explicar os detalhes?')
  const semLaudo = conversa(['oi, quanto custa o bpc do meu filho, da pra parcelar?', 'não tem'])
  assert.match(semLaudo.robo[0].join(' '), /Antes de seguir: o que você contar sobre saúde/)
  assert.match(semLaudo.ultima, /R\$ 1\.000 fixos, mais 3 salários mínimos e 30% dos atrasados.*até 6 vezes/)
})

caso('F05: negado ha 20 dias com pergunta na mesma mensagem: prazo e prioridade', () => {
  const c = conversa(['negaram o loas da minha filha faz 20 dias ainda da tempo de recorrer??'])
  assert.match(c.ultima, /prazo para recorrer costuma ser de 30 dias.*como prioridade/)
  assert.ok(encaminhou(c, /PRIORIDADE/))
  assert.ok(c.ficha.duvidas?.length)
  const depois = conversa([...ATE_CASA, 'somos 4 e a renda é 1700', 'não', 'já pedimos e negaram', 'faz uns 20 dias. tem prazo pra recorrer?'])
  assert.ok(encaminhou(depois, /PRIORIDADE/))
  assert.equal(depois.ficha.tempoNegado, 'faz uns 20 dias')
})

caso('F06: "a gente acha q ele e autista" e "na fila do neuro" sao investigacao', () => {
  const c = conversa(['oi, é pro meu filho', 'Rodrigo, ele tem 3 anos', 'a gente acha q ele é autista'])
  assert.equal(c.ficha.diagnostico, 'Em investigação: Autismo (TEA)')
  const depois = conversa(['meu filho é autista', 'Rodrigo, ele tem 3 anos', 'ta na fila do neuro pelo sus'])
  assert.equal(depois.ficha.diagnostico, 'Em investigação: Autismo (TEA)')
  assert.equal(depois.ficha.laudo, 'sem')
})

caso('F08: pergunta solta vira duvida, nunca "Combinado."; "ja disse q n" e nao; previsao de melhora anotada', () => {
  const base = ['oi, é pra mim, tenho depressão', 'Fábio, 35 anos', 'tenho do psiquiatra, de 2026. ele acha q em uns 6 meses eu melhoro', 'fico deitado o dia todo', 'sus', 'não tenho']
  const c = conversa([...base, 'to sem animo pra nada. minha esposa pode ir no meu lugar?'])
  assert.equal(c.ultima, `${TEXTO_JURIDICO} Dá para ir ao CRAS essa semana?`)
  assert.ok(c.ficha.anotacoes?.some((a) => /melhora/.test(a)))
  const jaDisse = conversa([...ATE_CASA, 'somos 2 e a renda é 900', 'ja disse q n'])
  assert.equal(jaDisse.ficha.beneficioProprio, 'nao')
})

caso('F02: "pra que voces querem saber?" recebe a resposta da privacidade e a pergunta volta', () => {
  const c = conversa(['oi, é pra minha mãe, ela tem 66 anos', 'Sérgio', 'ela mora comigo e com a minha esposa', 'pra que vcs precisam saber da renda?'])
  assert.equal(c.ultima, 'Só a equipe do escritório vê, para analisar o seu caso. A política de privacidade está no nosso site. E quanto entra de dinheiro na casa por mês, somando todo mundo, mais ou menos?')
  assert.ok(c.ficha.anotacoes?.includes(NOTA_PARENTES))
  const adiantado = conversa([...ATE_CASA, 'tem que pagar alguma coisa adiantado?'])
  assert.match(adiantado.ultima, /^Os honorários, só no final, se o benefício for concedido/)
})

caso('F02: "minha mae nao tem renda" nao e a renda da casa', () => {
  const c = conversa(['oi, minha mae tem 66 anos e nao tem renda nenhuma'])
  assert.equal(c.ficha.rendaCasa, undefined)
})

caso('F11: pensao contada sem dizer de quem: "Quem recebe?", sem perguntar de novo', () => {
  const c = conversa(['minha filha é autista e recebe pensao pq o pai faleceu', 'Cláudia, ela tem 6 anos', 'tem sim, de 2025', 'ajuda pra tudo', 'sus', 'sim', 'somos 2', 'so a pensao, 1621'])
  assert.equal(c.ultima, 'Entendi. Quem recebe: ela ou outra pessoa da casa?')
  assert.match(responder(c.estado, 'ela mesma', SEGUNDA_10H).respostas[0], /^Como ela já recebe um benefício/)
})

caso('F01: "loas de idosa" no meio da conversa nao faz do irmao autista um idoso', () => {
  const c = conversa(['oi, é pro meu irmao, ele é autista', 'Camila, ele tem 30', 'tem, de 2024', 'precisa de ajuda', 'sus', 'sim', 'somos 3', 'minha mae recebe o loas de idosa 1621'])
  assert.equal(c.ficha.area, undefined)
})

caso('F09: o que a familia explica do arquivo mandado nao vira resposta; fechamento "olhar com cuidado" nao oferece contrato', () => {
  const c = conversa([...ATE_CASA.slice(0, 2), '[arquivo recebido]', 'é a foto do laudo pra vc ver'])
  assert.equal(c.ficha.rotina, undefined)
  assert.match(c.ultima, /rotina/)
  const fraco = conversa([...ATE_CASA, 'somos 2 e a renda é 4000', 'não', 'nunca pedimos', 'amanhã de manhã'])
  assert.match(fraco.robo.at(-2)!.join(' '), /olhar com cuidado/)
  assert.equal(fraco.ultima, 'Combinado, amanhã de manhã. A equipe te chama nesse horário.')
})

caso('F09: "n. e ai tem direito?" responde a pergunta feita e anota a duvida', () => {
  const c = conversa([...ATE_CASA, 'somos 4 e a renda é 1400', 'n. e ai tem direito? 3a vez q pergunto'])
  assert.equal(c.ficha.beneficioProprio, 'nao')
  assert.ok(c.ultima.startsWith(TEXTO_JURIDICO))
  assert.doesNotMatch(c.ultima, /já recebe algum benefício/)
})

console.log(`robo: ${total} conversas ok`)
