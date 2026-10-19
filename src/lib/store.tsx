import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Etapa } from '@motor/robo'
import { enviarComoEquipe, id, novoCliente, rascunhoDoContrato, receberDoCliente } from './atendimento'
import { baseDeDemonstracao } from './dados-demo'
import { etapa as infoEtapa } from './escritorio'
import type { Base, Cliente, Contrato, Documentos, Origem } from './tipos'

/**
 * Estado do sistema. Nesta primeira versao os dados vivem neste navegador
 * (modo demonstracao). A troca para o Supabase acontece aqui e so aqui: as
 * telas falam com estas acoes e nao sabem onde o dado mora.
 */
const CHAVE = 'cbaa:base:v1'

/**
 * Enquanto for true, ate quem entra com senha ve os dados ficticios deste
 * navegador, e a tela mostra o selo de demonstracao para ninguem tomar o
 * exemplo por cliente de verdade. Vira false quando o store ler do Supabase.
 */
export const DADOS_NO_NAVEGADOR = true

function carregar(): Base {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const base = JSON.parse(bruto) as Base
      if (base.versao === 1 && Array.isArray(base.clientes)) return base
    }
  } catch {
    // Armazenamento bloqueado ou corrompido: recomeca da demonstracao.
  }
  return baseDeDemonstracao()
}

interface Acoes {
  base: Base
  clientes: Cliente[]
  cliente: (id: string) => Cliente | undefined
  receber: (id: string, texto: string) => void
  responder: (id: string, texto: string, autor: string) => void
  novoContato: (telefone: string, origem: Origem, primeiraMensagem: string) => string
  pausarRobo: (id: string, motivo: string) => void
  religarRobo: (id: string) => void
  moverEtapa: (id: string, etapa: Etapa, autor: string, motivoPerda?: string) => void
  marcarLido: (id: string) => void
  salvarContrato: (id: string, contrato: Contrato) => void
  documentos: (id: string, docs: Documentos) => void
  resolverPendencia: (id: string, pendenciaId: string) => void
  confirmarReuniao: (id: string, data: string, autor: string) => void
  atualizarCliente: (id: string, campos: Partial<Pick<Cliente, 'nome' | 'telefone' | 'cidade' | 'responsavel'>>) => void
  recomecarDemonstracao: () => void
}

const Contexto = createContext<Acoes | null>(null)

export function ProvedorDeDados({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<Base>(carregar)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(base))
    } catch {
      // Sem armazenamento a sessao continua funcionando, so nao guarda.
    }
  }, [base])

  const mudar = useCallback((cid: string, fn: (c: Cliente) => Cliente) => {
    setBase((b) => ({ ...b, clientes: b.clientes.map((c) => (c.id === cid ? fn(c) : c)) }))
  }, [])

  const agora = () => new Date().toISOString()
  const ev = (tipo: Cliente['eventos'][number]['tipo'], texto: string) => ({ id: id(), tipo, texto, em: agora() })

  const acoes = useMemo<Acoes>(
    () => ({
      base,
      clientes: [...base.clientes].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
      cliente: (cid) => base.clientes.find((c) => c.id === cid),
      receber: (cid, texto) => mudar(cid, (c) => receberDoCliente(c, texto, agora())),
      responder: (cid, texto, autor) => mudar(cid, (c) => enviarComoEquipe(c, texto, autor, agora())),
      novoContato: (telefone, origem, primeira) => {
        const c = receberDoCliente(novoCliente(telefone, origem, agora()), primeira, agora())
        setBase((b) => ({ ...b, clientes: [c, ...b.clientes] }))
        return c.id
      },
      pausarRobo: (cid, motivo) =>
        mudar(cid, (c) => ({ ...c, robo: { ...c.robo, pausado: true, motivoPausa: motivo }, eventos: [...c.eventos, ev('equipe', `Robô pausado: ${motivo}`)] })),
      religarRobo: (cid) =>
        mudar(cid, (c) => ({
          ...c,
          robo: { ...c.robo, pausado: false, motivoPausa: undefined, encaminhado: false },
          eventos: [...c.eventos, ev('equipe', 'Robô religado pela equipe')],
        })),
      moverEtapa: (cid, etapa, autor, motivoPerda) =>
        mudar(cid, (c) => ({
          ...c,
          etapa,
          motivoPerda: etapa === 'perdido' ? motivoPerda : undefined,
          contrato: etapa === 'reuniao' || etapa === 'contrato' ? (c.contrato ?? rascunhoDoContrato(c)) : c.contrato,
          eventos: [...c.eventos, ev('etapa', `${autor} moveu para ${infoEtapa(etapa).nome}${motivoPerda ? ` (${motivoPerda})` : ''}`)],
        })),
      marcarLido: (cid) => mudar(cid, (c) => (c.naoLidas ? { ...c, naoLidas: 0 } : c)),
      salvarContrato: (cid, contrato) =>
        mudar(cid, (c) => {
          const antes = c.contrato?.status
          const eventos = [...c.eventos]
          if (antes !== contrato.status) {
            const nomes = { rascunho: 'em rascunho', pronto: 'pronto para envio', enviado: 'enviado para assinatura', assinado: 'assinado' }
            eventos.push(ev('contrato', `Contrato ${nomes[contrato.status]}`))
          }
          let etapa = c.etapa
          if (contrato.status === 'enviado' && !['contrato', 'contratado'].includes(c.etapa)) etapa = 'contrato'
          if (contrato.status === 'assinado') etapa = 'contratado'
          return { ...c, contrato, etapa, eventos }
        }),
      documentos: (cid, docs) => mudar(cid, (c) => ({ ...c, documentos: docs })),
      resolverPendencia: (cid, pid) =>
        mudar(cid, (c) => ({
          ...c,
          pendencias: c.pendencias.map((p) => (p.id === pid ? { ...p, resolvida: true } : p)),
          eventos: [...c.eventos, ev('equipe', `Pendência resolvida: ${c.pendencias.find((p) => p.id === pid)?.texto ?? ''}`)],
        })),
      confirmarReuniao: (cid, data, autor) =>
        mudar(cid, (c) => ({
          ...c,
          etapa: ['novo', 'qualificacao', 'qualificado'].includes(c.etapa) ? 'reuniao' : c.etapa,
          reuniao: { quando: c.reuniao?.quando ?? '', advogado: c.reuniao?.advogado ?? 'Dr. André', data, confirmada: true },
          contrato: c.contrato ?? rascunhoDoContrato(c),
          eventos: [...c.eventos, ev('equipe', `${autor} confirmou a reunião para ${new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`)],
        })),
      atualizarCliente: (cid, campos) => mudar(cid, (c) => ({ ...c, ...campos })),
      recomecarDemonstracao: () => setBase(baseDeDemonstracao()),
    }),
    [base, mudar],
  )

  return <Contexto.Provider value={acoes}>{children}</Contexto.Provider>
}

export function useDados(): Acoes {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useDados fora do ProvedorDeDados')
  return ctx
}
