import type { EstadoRobo, Etapa } from '@motor/robo'

export type { Etapa }

export type Origem = 'anuncio' | 'site' | 'instagram' | 'indicacao'

export interface Mensagem {
  id: string
  de: 'cliente' | 'robo' | 'equipe'
  texto: string
  em: string
  autor?: string
}

export interface Pendencia {
  id: string
  texto: string
  criadaEm: string
  retornoEm: string
  resolvida: boolean
}

export interface Evento {
  id: string
  em: string
  tipo: 'etapa' | 'robo' | 'equipe' | 'contrato' | 'sistema'
  texto: string
}

export interface DadosContrato {
  menor: boolean
  nome: string
  nacionalidade: string
  estadoCivil: string
  profissao: string
  documento: string
  nascimento: string
  endereco: string
  email: string
  repNome: string
  repNacionalidade: string
  repEstadoCivil: string
  repProfissao: string
  repDocumento: string
  repParentesco: string
}

export type StatusContrato = 'rascunho' | 'pronto' | 'enviado' | 'assinado'

export interface Contrato {
  status: StatusContrato
  comParteFixa: boolean
  okAdvogado: boolean
  dados: DadosContrato
  geradoEm?: string
  enviadoEm?: string
  assinadoEm?: string
}

export interface Documentos {
  rg: boolean
  cpf: boolean
  comprovante: boolean
  cadunico: boolean
  laudo: boolean
}

export interface Reuniao {
  quando: string
  /** ISO do horario combinado, quando a equipe confirma */
  data?: string
  advogado: string
  confirmada: boolean
}

export interface Cliente {
  id: string
  nome: string
  telefone: string
  origem: Origem
  criadoEm: string
  atualizadoEm: string
  etapa: Etapa
  robo: EstadoRobo
  mensagens: Mensagem[]
  pendencias: Pendencia[]
  eventos: Evento[]
  documentos: Documentos
  reuniao?: Reuniao
  contrato?: Contrato
  cidade?: string
  responsavel?: string
  naoLidas: number
  motivoPerda?: string
}

export interface Base {
  versao: 1
  clientes: Cliente[]
  ultimaGeracao: string
}
