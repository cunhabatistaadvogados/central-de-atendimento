// Suspeitas da leitura do robo, cada uma numa conversa montada (painel de
// avaliacao, 20/10/2026). Mostra se a suspeita se CONFIRMA no robo de hoje.
//
//   node tests/painel/suspeitas.ts
//
// Nao e teste de CI: e o levantamento para o Lucas decidir o que corrigir.
import { writeFileSync, mkdirSync } from 'node:fs'
import { novoEstado, responder, type EstadoRobo, type Ficha, type Sinal } from '../../supabase/functions/_shared/robo.ts'
import { conferir } from './regras.ts'

const SEGUNDA_10H = new Date('2026-10-19T13:00:00Z')
const JANEIRO_2027 = new Date('2027-01-18T13:00:00Z')

function conversa(falas: string[], agora = SEGUNDA_10H) {
  let estado: EstadoRobo = novoEstado()
  const turnos: { cliente: string; robo: string[] }[] = []
  const sinais: Sinal[] = []
  for (const fala of falas) {
    const r = responder(estado, fala, agora)
    estado = r.estado
    turnos.push({ cliente: fala, robo: r.respostas })
    sinais.push(...r.sinais)
  }
  return { estado, turnos, sinais, ultima: turnos.at(-1)?.robo.join(' ') ?? '', ficha: estado.ficha as Ficha }
}

const ATE_ROTINA = ['oi', 'é pro meu filho', 'Ana, ele tem 6 anos', 'autismo', 'sim, tem']
const ATE_RENDA = [...ATE_ROTINA, 'faz terapia', 'pelo SUS', 'sim, atualizado']
const ATE_HORARIO = [...ATE_RENDA, 'somos 4 e a renda é 1200 reais', 'não', 'nunca pedimos']

type Resultado = ReturnType<typeof conversa>
interface Suspeita {
  id: string
  titulo: string
  gravidade: 'critica' | 'alta' | 'media' | 'baixa'
  falas: string[]
  agora?: Date
  /** devolve o que deu errado, ou '' se o robo acertou */
  confere: (r: Resultado) => string
}

const S: Suspeita[] = [
  {
    id: 'S01',
    titulo: '"valor" na resposta da renda vira pergunta de preço',
    gravidade: 'alta',
    falas: [...ATE_RENDA, 'somos 4 e o valor que entra é 1200 por mês'],
    confere: (r) => (/laudo|salários mínimos|R\$ 1\.000/.test(r.ultima) && r.ficha.rendaCasa === undefined ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S02',
    titulo: '"e ia" no meio da frase vira pergunta "é robô?"',
    gravidade: 'media',
    falas: [...ATE_ROTINA, 'precisa de ajuda pra tudo e ia começar a fono esse mês'],
    confere: (r) => (/atendimento automático/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S03',
    titulo: '"dividir" as contas da casa vira oferta de parcelamento',
    gravidade: 'critica',
    falas: [...ATE_RENDA, 'somos 3, a gente costuma dividir as contas, entra uns 1500'],
    confere: (r) => (/divididos|parcel/i.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S04',
    titulo: 'pergunta na hora de escolher o horário marca reunião sem a pessoa escolher',
    gravidade: 'alta',
    falas: [...ATE_HORARIO, 'antes disso, quanto vou ter que pagar?'],
    confere: (r) => (r.sinais.some((s) => s.tipo === 'reuniao') ? `marcou "${r.ficha.horario}" e respondeu: "${r.ultima}"` : ''),
  },
  {
    id: 'S05',
    titulo: '"amanhã não posso" marca para amanhã',
    gravidade: 'alta',
    falas: [...ATE_HORARIO, 'amanhã não posso, só na quinta'],
    confere: (r) => (/amanh/i.test(r.ficha.horario ?? '') ? `marcou "${r.ficha.horario}"` : ''),
  },
  {
    id: 'S06',
    titulo: '"não" ao contrato antes da reunião vira "Perfeito"',
    gravidade: 'alta',
    falas: [...ATE_HORARIO, 'amanhã às 9h', 'não, prefiro ver o contrato só na reunião'],
    confere: (r) => (/^Perfeito/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S07',
    titulo: '"sou de Santos" grava o nome "De"',
    gravidade: 'alta',
    falas: ['oi, sou de Santos, é pro meu filho'],
    confere: (r) => (r.ficha.nome && r.ficha.nome.length <= 3 ? `nome gravado: "${r.ficha.nome}"; robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S08',
    titulo: '"sou cuidadora dele" grava o nome "Cuidadora"',
    gravidade: 'media',
    falas: ['oi, sou cuidadora dele, é pro meu sobrinho'],
    confere: (r) => (r.ficha.nome && /cuidador/i.test(r.ficha.nome) ? `nome gravado: "${r.ficha.nome}"; robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S09',
    titulo: 'idade da mãe lida como idade da criança ("tenho 30 anos e meu filho tem 5")',
    gravidade: 'alta',
    falas: ['oi, tenho 30 anos e meu filho tem 5, ele é autista'],
    confere: (r) => (r.ficha.idade === 30 ? `idade gravada: ${r.ficha.idade}; para: ${r.ficha.para}` : ''),
  },
  {
    id: 'S10',
    titulo: '"um salário e meio" vira um salário só',
    gravidade: 'media',
    falas: [...ATE_RENDA, 'somos 3 e entra um salário e meio'],
    confere: (r) => (r.ficha.rendaCasa !== undefined && r.ficha.rendaCasa < 2000 ? `renda gravada: ${r.ficha.rendaCasa}` : ''),
  },
  {
    id: 'S11',
    titulo: '"não sei" sobre o laudo, na pergunta do preço, vira "sem laudo" e cota o preço maior',
    gravidade: 'alta',
    falas: ['oi', 'é pro meu filho', 'quanto custa?', 'não sei'],
    confere: (r) => (/R\$ 1\.000/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S12',
    titulo: '"tem direito?" do cliente é gravado como a rotina da criança e fica sem resposta',
    gravidade: 'media',
    falas: [...ATE_ROTINA, 'mas ele tem direito?'],
    confere: (r) => (/direito/.test(r.ficha.rotina ?? '') ? `rotina gravada: "${r.ficha.rotina}"; robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S13',
    titulo: 'cliente que já é do escritório cai no roteiro de novo',
    gravidade: 'media',
    falas: ['oi, já sou cliente de vocês, queria saber do meu processo'],
    confere: (r) => (!r.sinais.some((s) => s.tipo === 'encaminhar') ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S14',
    titulo: 'quem desiste ("não quero mais") continua recebendo perguntas',
    gravidade: 'media',
    falas: [...ATE_ROTINA, 'não quero mais, obrigada'],
    confere: (r) => (!r.sinais.some((s) => s.tipo === 'encaminhar') && /\?/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S15',
    titulo: 'assunto trabalhista cai no roteiro do BPC',
    gravidade: 'media',
    falas: ['boa tarde, fui demitido sem justa causa e não pagaram minhas verbas'],
    confere: (r) => (!r.sinais.some((s) => s.tipo === 'encaminhar') ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S16',
    titulo: 'desespero ("sem remédio, sem dinheiro") é lido como objeção de preço',
    gravidade: 'media',
    falas: ['oi', 'socorro, meu filho autista está sem remédio e eu não tenho dinheiro nenhum, estou desesperada'],
    confere: (r) => (/combina com você/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S17',
    titulo: 'em janeiro de 2027, "laudo de 2027" não é reconhecido como recente (anos fixos no código)',
    gravidade: 'media',
    agora: JANEIRO_2027,
    falas: [...ATE_ROTINA.slice(0, 4), 'tem sim, de 2027'],
    confere: (r) => (r.ficha.laudo !== 'recente' ? `laudo gravado: ${r.ficha.laudo ?? '(nada)'}; robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S18',
    titulo: 'em janeiro de 2027, "laudo de 2025" ainda conta como recente',
    gravidade: 'media',
    agora: JANEIRO_2027,
    falas: [...ATE_ROTINA.slice(0, 4), 'tem, de 2025'],
    confere: (r) => (r.ficha.laudo === 'recente' ? `laudo gravado: ${r.ficha.laudo}` : ''),
  },
  {
    id: 'S19',
    titulo: '"é verdade que precisa de laudo?" recebe a apresentação do escritório em vez da resposta',
    gravidade: 'baixa',
    falas: [...ATE_ROTINA.slice(0, 4), 'é verdade que precisa de laudo?'],
    confere: (r) => (/OAB\/SP/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S20',
    titulo: 'BPC de outra pessoa da casa entra na renda sem nenhuma ressalva',
    gravidade: 'baixa',
    falas: [...ATE_RENDA, 'somos 3, a única renda é o BPC da minha mãe, 1621'],
    confere: (r) => (r.ficha.rendaCasa === 1621 ? `renda gravada ${r.ficha.rendaCasa} (o BPC de idoso ou PcD da casa não entra na conta do INSS)` : ''),
  },
  {
    id: 'S21',
    titulo: 'mensagem picada em duas (nome numa, idade na outra)',
    gravidade: 'media',
    falas: ['oi', 'é pro meu filho', 'Ana', 'ele tem 6 anos'],
    confere: (r) => (r.ficha.nome !== 'Ana' || r.ficha.idade !== 6 ? `nome ${r.ficha.nome}, idade ${r.ficha.idade}; robô: "${r.ultima}"` : ''),
  },
  {
    id: 'S22',
    titulo: 'número por extenso na casa ("somos quatro, ganhamos mil e duzentos")',
    gravidade: 'media',
    falas: [...ATE_RENDA, 'somos quatro e ganhamos mil e duzentos'],
    confere: (r) => (r.ficha.pessoasCasa !== 4 || r.ficha.rendaCasa !== 1200 ? `pessoas ${r.ficha.pessoasCasa}, renda ${r.ficha.rendaCasa}; robô: "${r.ultima}"` : ''),
  },
  // Lado juridico e etico (pesquisa de 20/10/2026: LOAS, Portaria Conjunta
  // 34/2025, Provimento 205/2021, Recomendacao CFOAB 001/2024, LGPD).
  {
    id: 'J01',
    titulo: 'negado no INSS há 10 dias: o prazo de 30 dias do recurso não vira prioridade para a equipe',
    gravidade: 'alta',
    falas: [...ATE_RENDA, 'somos 4 e a renda é 1200 reais', 'não', 'já pedimos e negaram', 'faz 10 dias'],
    confere: (r) => (!r.sinais.some((s) => /prazo|recurso|urgente/i.test(JSON.stringify(s))) ? `sinais: ${r.sinais.filter((s) => s.tipo !== 'etapa').map((s) => JSON.stringify(s)).join(' ')}` : ''),
  },
  {
    id: 'J02',
    titulo: 'pessoa de 64 anos sem doença ("é pela idade") tem isso gravado como diagnóstico e recebe a oferta do médico parceiro para fazer laudo',
    gravidade: 'alta',
    falas: ['oi, é pra mim, tenho 64 anos', 'Marcos', 'é pela idade mesmo', 'não'],
    confere: (r) => (/médico parceiro/.test(r.ultima) ? `diagnóstico gravado: "${r.ficha.diagnostico}"; robô: "${r.ultima}"` : ''),
  },
  {
    id: 'J03',
    titulo: 'criança que já recebe pensão por morte (não acumula com BPC) ouve que "se qualifica sim"',
    gravidade: 'alta',
    falas: [...ATE_RENDA, 'somos 2 e a renda é 300 reais', 'ele recebe pensão por morte do pai', 'nunca pedimos'],
    confere: (r) => (/se qualifica sim/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'J04',
    titulo: 'cliente oferece a senha do gov.br e o robô não avisa que não pode',
    gravidade: 'alta',
    falas: [...ATE_ROTINA, 'quer que eu te passe minha senha do gov.br pra vocês olharem?'],
    confere: (r) => (!/senha/.test(r.ultima) ? `robô: "${r.ultima}" (rotina gravada: "${r.ficha.rotina ?? ''}")` : ''),
  },
  {
    id: 'J05',
    titulo: 'idosa que mora com filho casado e nora: robô conta os 3 na casa (a lei conta só ela)',
    gravidade: 'media',
    falas: ['oi, é pra minha mãe, ela tem 70 anos', 'Rita', 'sim, atualizado', 'moram 3, minha mãe, meu irmão casado e a esposa dele, a renda deles é 4000'],
    confere: (r) => (r.ficha.pessoasCasa === 3 ? `pessoas ${r.ficha.pessoasCasa}, renda ${r.ficha.rendaCasa}: renda por pessoa na tela da equipe R$ ${Math.round((r.ficha.rendaCasa ?? 0) / 3)}` : ''),
  },
  {
    id: 'J06',
    titulo: 'fechamento chama o advogado de "especialista" (Provimento 205 veda sem título)',
    gravidade: 'media',
    falas: [...ATE_RENDA, 'somos 4 e a renda é 1200 reais', 'não', 'nunca pedimos'],
    confere: (r) => (/especialista/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'J07',
    titulo: 'primeira mensagem não avisa que é atendimento automático nem identifica o escritório',
    gravidade: 'media',
    falas: ['oi'],
    confere: (r) => (!/autom|robô|virtual/i.test(r.ultima) || !/Cunha|CB&/i.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'J08',
    titulo: 'pergunta o diagnóstico (dado de saúde) sem aviso de privacidade antes',
    gravidade: 'media',
    falas: ['oi', 'é pro meu filho', 'Ana, ele tem 6 anos'],
    confere: (r) => {
      const tudo = r.turnos.flatMap((t) => t.robo).join(' ')
      return /diagnóstico/.test(r.ultima) && !/privacidade|seus dados|LGPD/i.test(tudo) ? `robô: "${r.ultima}"` : ''
    },
  },
  {
    id: 'J09',
    titulo: 'honorários dizem "você só paga quando o benefício sair" (soa como certeza de resultado)',
    gravidade: 'media',
    falas: ['oi', 'é pro meu filho', 'quanto custa?', 'tem sim'],
    confere: (r) => (/quando o benefício sair/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'J10',
    titulo: 'laudo de 2019 vira "antigo": oferece o médico parceiro e o contrato com os R$ 1.000',
    gravidade: 'media',
    falas: [...ATE_ROTINA.slice(0, 4), 'tem, é de 2019'],
    confere: (r) => (r.ficha.laudo === 'antigo' && /médico parceiro/.test(r.ultima) ? `robô: "${r.ultima}"` : ''),
  },
  {
    id: 'J11',
    titulo: '"autismo dá direito automático?" é gravado como resposta e fica sem resposta',
    gravidade: 'media',
    falas: [...ATE_ROTINA, 'autismo dá direito automático né?'],
    confere: (r) => (r.ficha.rotina && /direito/.test(r.ficha.rotina) ? `rotina gravada: "${r.ficha.rotina}"; robô: "${r.ultima}"` : ''),
  },
]

const linhas: string[] = []
const json: unknown[] = []
let confirmadas = 0
for (const s of S) {
  const r = conversa(s.falas, s.agora)
  const problema = s.confere(r)
  const regras = r.turnos.flatMap((t, i) => t.robo.flatMap((resp) => conferir(resp, { falasDoCliente: s.falas.slice(0, i + 1) })))
  if (problema) confirmadas += 1
  linhas.push(`${problema ? 'CONFIRMADA' : 'não se confirmou'}  ${s.id} [${s.gravidade}] ${s.titulo}${problema ? `\n    ${problema}` : ''}`)
  for (const x of regras) linhas.push(`    + regra quebrada: ${x.regra} (${x.trecho})`)
  json.push({ ...s, confere: undefined, confirmada: Boolean(problema), problema, regras, conversa: r.turnos })
}
console.log(linhas.join('\n'))
console.log(`\n${confirmadas} de ${S.length} suspeitas confirmadas`)
mkdirSync('tests/painel/resultados', { recursive: true })
writeFileSync('tests/painel/resultados/suspeitas.json', JSON.stringify(json, null, 2))
