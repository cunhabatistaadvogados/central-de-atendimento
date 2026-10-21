import type { EstadoRobo, Etapa } from '@motor/robo'

export type { Etapa }

/** 'meta' e 'google' desde 21/10/2026 (etiquetas pedidas pelo Lucas); 'anuncio' = sem saber a plataforma. */
export type Origem = 'anuncio' | 'meta' | 'google' | 'site' | 'instagram' | 'indicacao'

/** Anuncio de clique para WhatsApp do Meta (referral da 1a mensagem). */
export interface Anuncio {
  titulo?: string | null
  texto?: string | null
  link?: string | null
  id?: string | null
}

export interface Mensagem {
  id: string
  de: 'cliente' | 'robo' | 'equipe'
  texto: string
  em: string
  autor?: string
  /** So no modo real: sent, delivered, read ou failed (vem da Meta). */
  statusEnvio?: string
  erroEnvio?: string
  /** So no modo real: id da Meta, para responder citando esta mensagem. */
  wamid?: string
  /** Caminho no bucket privado "midias". */
  midia?: string
  midiaTipo?: TipoMidia
  midiaNome?: string
  /** wamid da mensagem citada (resposta arrastada no WhatsApp). */
  respondeA?: string
}

export type TipoMidia = 'imagem' | 'audio' | 'video' | 'documento' | 'figurinha'

/** O que pode ir junto com o texto da equipe. */
export interface ExtrasDoEnvio {
  respondeA?: string
  arquivo?: File
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
  /** So no modo real: caminho do PDF assinado no bucket privado "contratos". */
  arquivo?: string
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
  anuncio?: Anuncio
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
  /** So no modo real: conversa antiga do Pixel Hub, fica na tela Historico. */
  historico?: boolean
}

export interface Base {
  versao: 1
  clientes: Cliente[]
  ultimaGeracao: string
}
