import type { Etapa } from '@motor/robo'

/** Dados oficiais do escritorio. CNPJ e OAB conferidos na minuta do contrato. */
export const ESCRITORIO = {
  nome: 'Cunha, Batista & Advogados Associados',
  curto: 'CB&AA',
  cnpj: '08.492.893/0001-41',
  oab: 'OAB/SP 9.894',
  endereco: 'Av. Ana Costa, 146, cj. 305/306, Vila Mathias, Santos/SP',
  telefones: ['(13) 3223-2780', '(13) 3223-4879'],
  whatsappDoRobo: '+55 13 99741-4361',
  site: 'https://cunhabatistaadv.com/',
  instagram: '@cunhabatistaadvogados',
  email: 'contato.cunhabatista@cunhabatista.com.br',
  advogados: [
    { nome: 'Dr. André Luiz Boldrin Cardoso', papel: 'Especialista em BPC/LOAS' },
    { nome: 'Dr. Lucas Henrique Batista', papel: 'Sócio' },
    { nome: 'Dr. Artur Cunha dos Santos', papel: 'Sócio' },
  ],
  advogadoDoBpc: 'Dr. André',
}

export const HONORARIOS = [
  {
    titulo: 'Cliente já tem laudo',
    texto: '3 salários mínimos + 30% dos atrasados. Tudo ao final, depois que o benefício for concedido e recebido.',
    versao: 'Contrato padrão',
  },
  {
    titulo: 'Sem laudo (fase médica parceira)',
    texto: 'R$ 1.000 fixos + 3 salários mínimos + 30% dos atrasados. Tudo ao final.',
    versao: 'Contrato com valor fixo',
  },
  {
    titulo: 'Parcelamento (só se o cliente pedir)',
    texto: 'Os 3 salários mínimos em até 6 parcelas mensais, depois que o benefício sair.',
    versao: 'Consta nas duas versões',
  },
]

/** Atalhos da equipe na conversa (visual padrao e visual WhatsApp). */
export const RESPOSTAS_PRONTAS = [
  {
    nome: 'Lista de documentos',
    texto: 'Para o contrato e o pedido no INSS, me manda por aqui: foto do RG (frente e verso), CPF, comprovante de endereço e o CadÚnico. Se tiver, o laudo também.',
  },
  {
    nome: 'Como assinar',
    texto: 'O contrato chega aqui no seu WhatsApp, por um link do D4Sign. Você abre no celular, confere e assina com um clique. Não precisa imprimir nada.',
  },
  { nome: 'Confirmar reunião', texto: 'Confirmado: o Dr. André fala com você no horário combinado. Qualquer coisa, é só chamar aqui.' },
  { nome: 'Quando pago?', texto: 'Só no final, quando o benefício sair. Antes disso você não paga nada ao escritório.' },
]

/**
 * Etapas e cores com significado fixo (Visual Law do CRM do Lucas):
 * novo azul, qualificacao roxo, qualificado dourado, reuniao laranja,
 * contratado verde, perdido cinza. "Contrato enviado" ganhou o marinho
 * da marca porque e a etapa que o diagnostico mostrou que quase nunca
 * acontecia: tem que saltar aos olhos.
 */
export const ETAPAS: { chave: Etapa; nome: string; curto: string; cor: string; fundo: string; ponto: string }[] = [
  { chave: 'novo', nome: 'Novo contato', curto: 'Novo', cor: 'text-sky-700', fundo: 'bg-sky-50 border-sky-200', ponto: 'bg-sky-500' },
  { chave: 'qualificacao', nome: 'Em qualificação', curto: 'Qualificando', cor: 'text-violet-700', fundo: 'bg-violet-50 border-violet-200', ponto: 'bg-violet-500' },
  { chave: 'qualificado', nome: 'Qualificado', curto: 'Qualificado', cor: 'text-ouro-700', fundo: 'bg-ouro-50 border-ouro-300', ponto: 'bg-ouro-500' },
  { chave: 'reuniao', nome: 'Reunião marcada', curto: 'Reunião', cor: 'text-orange-700', fundo: 'bg-orange-50 border-orange-200', ponto: 'bg-orange-500' },
  { chave: 'contrato', nome: 'Contrato enviado', curto: 'Contrato', cor: 'text-marinho-700', fundo: 'bg-marinho-50 border-marinho-100', ponto: 'bg-marinho-700' },
  { chave: 'contratado', nome: 'Contratado', curto: 'Contratado', cor: 'text-emerald-700', fundo: 'bg-emerald-50 border-emerald-200', ponto: 'bg-emerald-500' },
  { chave: 'perdido', nome: 'Perdido', curto: 'Perdido', cor: 'text-slate-500', fundo: 'bg-slate-50 border-slate-200', ponto: 'bg-slate-400' },
]

export function etapa(chave: Etapa) {
  return ETAPAS.find((e) => e.chave === chave) ?? ETAPAS[0]
}

export const ORIGENS: Record<string, string> = {
  anuncio: 'Anúncio',
  site: 'Site',
  instagram: 'Instagram',
  indicacao: 'Indicação',
}

/** Numeros do diagnostico do Lucas (1.641 conversas, fev-out/2026): a linha de base. */
export const LINHA_DE_BASE = {
  sumiramNaPrimeira: 0.42,
  qualificados: 0.17,
  falamosContrato: 0.02,
  precoRespondido: 0.12,
  foraDoHorario: 0.34,
}
