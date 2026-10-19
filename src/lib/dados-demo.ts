/**
 * Base de DEMONSTRACAO. Todos os nomes, telefones e documentos sao ficticios.
 * As conversas nao foram escritas a mao: cada fala do cliente passa pelo
 * mesmo motor do robo que vai rodar no WhatsApp, entao o que aparece na tela
 * e exatamente o que o robo responderia.
 */
import { aplicarSinais, enviarComoEquipe, id, novoCliente, rascunhoDoContrato, receberDoCliente } from './atendimento'
import type { Base, Cliente, Origem } from './tipos'
import type { Etapa } from '@motor/robo'

interface Roteiro {
  telefone: string
  origem: Origem
  /** horas atras em que a conversa comecou */
  inicio: number
  falas: [texto: string, minutosDepois: number][]
  depois?: (c: Cliente, fim: string) => Cliente
}

const EQUIPE = 'Mariana (equipe)'

function mover(c: Cliente, etapa: Etapa, texto: string, em: string): Cliente {
  return { ...c, etapa, eventos: [...c.eventos, { id: id(), tipo: 'equipe', texto, em }] }
}

function mais(iso: string, minutos: number): string {
  return new Date(new Date(iso).getTime() + minutos * 60000).toISOString()
}

const QUALIFICACAO_COMPLETA: [string, number][] = [
  ['faz terapia ocupacional e fono, precisa de ajuda pra tudo', 3],
  ['pelo SUS, no CAPS infantil', 2],
  ['tem sim, atualizado', 1],
  ['somos 4 pessoas, a renda é uns R$ 1.400', 3],
  ['não, ninguém', 1],
  ['nunca pedimos', 1],
]

const ROTEIROS: Roteiro[] = [
  {
    telefone: '(13) 90000-1001',
    origem: 'anuncio',
    inicio: 76,
    falas: [
      ['Oi, meu filho tem laudo de autismo e quero saber sobre o BPC/LOAS', 0],
      ['Juliana, ele tem 6 anos', 2],
      ...QUALIFICACAO_COMPLETA,
      ['amanhã de manhã', 4],
      ['pode sim', 1],
    ],
    depois: (c, fim) => {
      let cli = enviarComoEquipe(c, 'Oi, Juliana! Aqui é a Mariana, do escritório. Te mando o contrato e a lista de documentos agora, combinado?', EQUIPE, mais(fim, 40))
      cli = { ...cli, documentos: { rg: true, cpf: true, comprovante: true, cadunico: true, laudo: true } }
      const contrato = rascunhoDoContrato(cli)
      contrato.dados = {
        ...contrato.dados,
        nome: 'Miguel Exemplo Matos',
        documento: 'CPF n. 000.000.001-91',
        nascimento: '14/02/2020',
        endereco: 'Rua das Flores, 120, Vila Belmiro, Santos/SP',
        email: 'juliana.exemplo@email.com',
        repNome: 'Juliana Exemplo Matos',
        repEstadoCivil: 'casada',
        repProfissao: 'auxiliar administrativa',
        repDocumento: 'RG n. 00.000.001-X e CPF n. 000.000.002-72',
      }
      cli = { ...cli, contrato: { ...contrato, okAdvogado: true, status: 'enviado', geradoEm: mais(fim, 60 * 20), enviadoEm: mais(fim, 60 * 20) } }
      cli = { ...cli, reuniao: { quando: 'terça às 9h', advogado: 'Dr. André', confirmada: true, data: mais(fim, 60 * 18) } }
      return mover(cli, 'contrato', 'Contrato enviado para assinatura (D4Sign)', mais(fim, 60 * 20))
    },
  },
  {
    telefone: '(11) 90000-2002',
    origem: 'anuncio',
    inicio: 52,
    falas: [
      ['boa tarde, minha filha tem autismo, queria saber do benefício', 0],
      ['Carla, ela tem 4 anos', 5],
      ['não tem laudo ainda, está na fila do SUS faz meses', 3],
      ['quero saber sim', 2],
      ['amanhã de manhã é melhor', 6],
    ],
  },
  {
    telefone: '(13) 90000-3003',
    origem: 'site',
    inicio: 30,
    falas: [
      ['Gostaria de falar com um advogado previdenciário', 0],
      ['é pra mim. Sou a Maria das Graças, tenho 67 anos', 8],
      ['tenho sim atualizado', 2],
      ['moro sozinha, sem renda', 4],
      ['não', 1],
      ['já pedi e foi negado', 2],
      ['faz uns 2 meses', 3],
      ['hoje à tarde', 5],
      ['pode', 1],
    ],
    depois: (c, fim) => {
      const cli = enviarComoEquipe(c, 'Dona Maria, aqui é a Mariana. O Dr. André te liga hoje às 15h, tudo bem?', EQUIPE, mais(fim, 25))
      return { ...cli, reuniao: { quando: 'hoje às 15h', advogado: 'Dr. André', confirmada: true, data: hojeAs(15) } }
    },
  },
  {
    telefone: '(21) 90000-4004',
    origem: 'anuncio',
    inicio: 3,
    falas: [
      ['oi, meu filho tem laudo de autismo', 0],
      ['Patrícia, ele tem 9 anos', 4],
      ['quanto custa?', 2],
    ],
  },
  {
    telefone: '(13) 90000-5005',
    origem: 'anuncio',
    inicio: 6,
    falas: [
      ['oi meu filho é autista', 0],
      ['Rosângela, ele tem 11', 6],
      ['tem laudo sim, desse ano', 3],
      ['ele precisa de ajuda pra comer e tomar banho', 5],
      ['particular, a gente paga', 2],
      ['não temos', 4],
    ],
  },
  {
    telefone: '(11) 90000-6006',
    origem: 'instagram',
    inicio: 0.4,
    falas: [['Olá, vi o anúncio de vocês sobre BPC', 0]],
  },
  {
    telefone: '(19) 90000-7007',
    origem: 'anuncio',
    inicio: 49,
    falas: [
      ['meu filho tem laudo de autismo, como funciona?', 0],
      ['Débora, 7 anos', 3],
      ['preciso falar com meu marido antes', 4],
      ['sim', 1],
    ],
  },
  {
    telefone: '(13) 90000-8008',
    origem: 'indicacao',
    inicio: 240,
    falas: [
      ['Oi, a Juliana me indicou. Minha filha tem síndrome de Down e tem laudo', 0],
      ['Aline, ela tem 3 anos', 5],
      ['tem sim, recente', 1],
      ['faz fisioterapia e fono, depende de mim pra tudo', 4],
      ['pelo SUS', 1],
      ['sim atualizado', 2],
      ['3 pessoas, renda de 1500', 3],
      ['não', 1],
      ['não', 1],
      ['amanhã de manhã', 3],
      ['pode sim', 1],
    ],
    depois: (c, fim) => {
      let cli = enviarComoEquipe(c, 'Aline, contrato assinado! Agora a gente monta o pedido no INSS e te avisa por aqui.', EQUIPE, mais(fim, 60 * 50))
      cli = { ...cli, documentos: { rg: true, cpf: true, comprovante: true, cadunico: true, laudo: true } }
      const contrato = rascunhoDoContrato(cli)
      contrato.dados = {
        ...contrato.dados,
        nome: 'Laura Exemplo Ribeiro',
        nacionalidade: 'brasileira',
        documento: 'CPF n. 000.000.003-53',
        nascimento: '02/07/2023',
        endereco: 'Av. Exemplo, 900, ap. 12, Gonzaga, Santos/SP',
        email: 'aline.exemplo@email.com',
        repNome: 'Aline Exemplo Ribeiro',
        repEstadoCivil: 'solteira',
        repProfissao: 'vendedora',
        repDocumento: 'RG n. 00.000.003-X e CPF n. 000.000.004-34',
      }
      cli = {
        ...cli,
        contrato: { ...contrato, okAdvogado: true, status: 'assinado', geradoEm: mais(fim, 60 * 22), enviadoEm: mais(fim, 60 * 22), assinadoEm: mais(fim, 60 * 49) },
        reuniao: { quando: 'quinta às 10h', advogado: 'Dr. André', confirmada: true, data: mais(fim, 60 * 20) },
      }
      return mover(cli, 'contratado', 'Contrato assinado no D4Sign', mais(fim, 60 * 49))
    },
  },
  {
    telefone: '(27) 90000-9009',
    origem: 'anuncio',
    inicio: 200,
    falas: [
      ['quero saber do loas', 0],
      ['Sandra', 30],
    ],
    depois: (c, fim) => ({ ...mover(c, 'perdido', 'Marcado como perdido: parou de responder após 2 retornos', mais(fim, 60 * 72)), motivoPerda: 'Parou de responder' }),
  },
  {
    telefone: '(31) 90000-1010',
    origem: 'anuncio',
    inicio: 1.2,
    falas: [
      ['meu filho tem autismo, vocês atendem em Minas?', 0],
      ['Belo Horizonte', 3],
      ['Tatiane, ele tem 5 anos', 2],
    ],
  },
  {
    telefone: '(13) 90000-1111',
    origem: 'site',
    inicio: 20,
    falas: [
      ['Gostaria de falar com um advogado previdenciário', 0],
      ['meu nome é Renata, é para minha mãe', 7],
      ['ela tem 70 anos', 4],
      ['tem sim', 3],
    ],
  },
  {
    telefone: '(11) 90000-1212',
    origem: 'anuncio',
    inicio: 330,
    falas: [
      ['meu filho tem laudo de TEA', 0],
      ['Kelly, 12 anos', 2],
      ...QUALIFICACAO_COMPLETA,
      ['hoje à tarde', 2],
      ['pode', 1],
    ],
    depois: (c, fim) => {
      let cli = { ...c, documentos: { rg: true, cpf: true, comprovante: true, cadunico: true, laudo: true } }
      const contrato = rascunhoDoContrato(cli)
      contrato.dados = {
        ...contrato.dados,
        nome: 'Davi Exemplo Costa',
        documento: 'CPF n. 000.000.005-15',
        nascimento: '30/09/2014',
        endereco: 'Rua Exemplo B, 45, Centro, São Vicente/SP',
        email: '',
        repNome: 'Kelly Exemplo Costa',
        repEstadoCivil: 'divorciada',
        repProfissao: 'cozinheira',
        repDocumento: 'CPF n. 000.000.006-04',
      }
      cli = {
        ...cli,
        contrato: { ...contrato, okAdvogado: true, status: 'assinado', geradoEm: mais(fim, 60 * 4), enviadoEm: mais(fim, 60 * 4), assinadoEm: mais(fim, 60 * 30) },
        reuniao: { quando: 'hoje à tarde', advogado: 'Dr. André', confirmada: true, data: mais(fim, 90) },
      }
      return mover(cli, 'contratado', 'Contrato assinado no D4Sign', mais(fim, 60 * 30))
    },
  },
  {
    telefone: '(13) 90000-1313',
    origem: 'anuncio',
    inicio: 22,
    falas: [
      ['oi, meu filho tem laudo de autismo e quero o BPC', 0],
      ['Vanessa, ele tem 8 anos', 2],
      ...QUALIFICACAO_COMPLETA,
      ['amanhã de manhã', 3],
      ['pode ser', 1],
    ],
    depois: (c, fim) => {
      const cli = enviarComoEquipe(c, 'Vanessa, confirmado amanhã às 10h com o Dr. André. Já te mandei a lista de documentos.', EQUIPE, mais(fim, 15))
      return { ...cli, reuniao: { quando: 'amanhã às 10h', advogado: 'Dr. André', confirmada: true, data: amanhaAs(10) } }
    },
  },
  {
    telefone: '(85) 90000-1414',
    origem: 'anuncio',
    inicio: 0.8,
    falas: [
      ['meu filho tem autismo', 0],
      ['quero falar com uma pessoa', 3],
    ],
  },
]

function hojeAs(h: number): string {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}
function amanhaAs(h: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

export function baseDeDemonstracao(agora = new Date()): Base {
  const clientes = ROTEIROS.map((r) => {
    let em = new Date(agora.getTime() - r.inicio * 3600000).toISOString()
    let c = novoCliente(r.telefone, r.origem, em)
    for (const [texto, minutos] of r.falas) {
      em = mais(em, minutos)
      c = receberDoCliente(c, texto, em)
    }
    if (r.depois) c = r.depois(c, em)
    // Conversa antiga ja foi lida pela equipe; a nova fica com o numero.
    if (r.inicio > 8) c = { ...c, naoLidas: 0 }
    return aplicarSinais(c, [], em)
  })
  return { versao: 1, clientes, ultimaGeracao: agora.toISOString() }
}
