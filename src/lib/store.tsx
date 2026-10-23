import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { religar, type Etapa } from '@motor/robo'
import { enviarComoEquipe, id, mensagemDaReuniao, novoCliente, rascunhoDoContrato, receberDoCliente, repetirPerguntaComoRobo } from './atendimento'
import { baseDeDemonstracao } from './dados-demo'
import { etapa as infoEtapa } from './escritorio'
import { agendaOutlook, carregarClientes, carregarUmCliente, clientesMudadosDesde, enviarResposta, gravarDiferenca, repetirPerguntaPeloWhatsApp } from './repositorio'
import { supabase } from './supabase'
import type { Base, Cliente, Contrato, Documentos, ExtrasDoEnvio, Origem } from './tipos'

/**
 * Estado do sistema, em dois modos:
 * - DEMONSTRACAO (botao "Ver a demonstracao" no login): 14 familias
 *   ficticias guardadas so neste navegador.
 * - REAL (login da equipe): dados do Supabase. Cada acao muda a tela na hora
 *   e grava a diferenca no banco logo depois; mensagem nova chega pelo
 *   Realtime. Ate 19/10/2026 o login real ainda mostrava a demonstracao, o
 *   que confundiu o Edu no primeiro acesso ("esses dados sao reais?").
 */
const CHAVE = 'cbaa:base:v1'

function carregarDemonstracao(): Base {
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

export interface Acoes {
  demonstracao: boolean
  carregando: boolean
  erro: string
  recarregar: () => void
  base: Base
  clientes: Cliente[]
  cliente: (id: string) => Cliente | undefined
  /** So na demonstracao: escrever como se fosse o cliente. */
  receber: (id: string, texto: string) => void
  responder: (id: string, texto: string, autor: string, extras?: ExtrasDoEnvio) => Promise<void>
  /** O robo manda de novo a pergunta que ficou e continua atendendo. */
  repetirPergunta: (id: string, autor: string) => Promise<void>
  novoContato: (telefone: string, origem: Origem, primeiraMensagem: string) => string
  pausarRobo: (id: string, motivo: string) => void
  religarRobo: (id: string) => void
  moverEtapa: (id: string, etapa: Etapa, autor: string, motivoPerda?: string) => void
  marcarLido: (id: string) => void
  /** Conversa que nao precisa de resposta sai de "esperando a equipe" ate o cliente escrever de novo. */
  marcarResolvida: (id: string, autor: string) => void
  salvarContrato: (id: string, contrato: Contrato) => void
  documentos: (id: string, docs: Documentos) => void
  resolverPendencia: (id: string, pendenciaId: string) => void
  /** avisar: manda a data para a familia pelo WhatsApp (padrao sim). */
  confirmarReuniao: (id: string, data: string, autor: string, avisar?: boolean) => void
  /** Desfaz a confirmacao: a reuniao volta para "a confirmar" e sai do Outlook. */
  cancelarReuniao: (id: string, autor: string, avisar?: boolean) => void
  atualizarCliente: (id: string, campos: Partial<Pick<Cliente, 'nome' | 'telefone' | 'cidade' | 'responsavel'>>) => void
  recomecarDemonstracao: () => void
}

const Contexto = createContext<Acoes | null>(null)

const agora = () => new Date().toISOString()
const ev = (tipo: Cliente['eventos'][number]['tipo'], texto: string) => ({ id: id(), tipo, texto, em: agora() })

/** As transformacoes sao as mesmas nos dois modos; so muda onde o resultado mora. */
function transformacoes(mudar: (cid: string, fn: (c: Cliente) => Cliente) => void) {
  return {
    pausarRobo: (cid: string, motivo: string) =>
      mudar(cid, (c) => ({ ...c, robo: { ...c.robo, pausado: true, motivoPausa: motivo }, eventos: [...c.eventos, ev('equipe', `Robô pausado: ${motivo}`)] })),
    religarRobo: (cid: string) =>
      mudar(cid, (c) => ({
        ...c,
        robo: religar(c.robo),
        eventos: [...c.eventos, ev('equipe', 'Robô religado pela equipe')],
      })),
    moverEtapa: (cid: string, etapa: Etapa, autor: string, motivoPerda?: string) =>
      mudar(cid, (c) => ({
        ...c,
        etapa,
        motivoPerda: etapa === 'perdido' ? motivoPerda : undefined,
        contrato: etapa === 'reuniao' || etapa === 'contrato' ? (c.contrato ?? rascunhoDoContrato(c)) : c.contrato,
        eventos: [...c.eventos, ev('etapa', `${autor} moveu para ${infoEtapa(etapa).nome}${motivoPerda ? ` (${motivoPerda})` : ''}`)],
      })),
    marcarLido: (cid: string) => mudar(cid, (c) => (c.naoLidas ? { ...c, naoLidas: 0 } : c)),
    marcarResolvida: (cid: string, autor: string) =>
      mudar(cid, (c) => {
        const ultima = [...c.mensagens].reverse().find((m) => m.de === 'cliente')
        if (!ultima) return c
        return { ...c, naoLidas: 0, robo: { ...c.robo, resolvidoAte: ultima.em }, eventos: [...c.eventos, ev('equipe', `${autor} marcou a conversa como resolvida`)] }
      }),
    salvarContrato: (cid: string, contrato: Contrato) =>
      mudar(cid, (c) => {
        const eventos = [...c.eventos]
        if (c.contrato?.status !== contrato.status) {
          const nomes = { rascunho: 'em rascunho', pronto: 'pronto para envio', enviado: 'enviado para assinatura', assinado: 'assinado' }
          eventos.push(ev('contrato', `Contrato ${nomes[contrato.status]}`))
        }
        let etapa = c.etapa
        if (contrato.status === 'enviado' && !['contrato', 'contratado'].includes(c.etapa)) etapa = 'contrato'
        if (contrato.status === 'assinado') etapa = 'contratado'
        return { ...c, contrato, etapa, eventos }
      }),
    documentos: (cid: string, docs: Documentos) => mudar(cid, (c) => ({ ...c, documentos: docs })),
    resolverPendencia: (cid: string, pid: string) =>
      mudar(cid, (c) => ({
        ...c,
        pendencias: c.pendencias.map((p) => (p.id === pid ? { ...p, resolvida: true } : p)),
        eventos: [...c.eventos, ev('equipe', `Pendência resolvida: ${c.pendencias.find((p) => p.id === pid)?.texto ?? ''}`)],
      })),
    confirmarReuniao: (cid: string, data: string, autor: string) =>
      mudar(cid, (c) => ({
        ...c,
        etapa: ['novo', 'qualificacao', 'qualificado'].includes(c.etapa) ? 'reuniao' : c.etapa,
        reuniao: { quando: c.reuniao?.quando ?? '', advogado: c.reuniao?.advogado ?? 'Dr. André', data, confirmada: true },
        contrato: c.contrato ?? rascunhoDoContrato(c),
        eventos: [...c.eventos, ev('equipe', `${autor} ${c.reuniao?.confirmada ? 'remarcou' : 'confirmou'} a reunião para ${new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`)],
      })),
    cancelarReuniao: (cid: string, autor: string) =>
      mudar(cid, (c) =>
        c.reuniao?.confirmada
          ? { ...c, reuniao: { ...c.reuniao, data: undefined, confirmada: false }, eventos: [...c.eventos, ev('equipe', `${autor} desmarcou a reunião`)] }
          : c,
      ),
    atualizarCliente: (cid: string, campos: Partial<Pick<Cliente, 'nome' | 'telefone' | 'cidade' | 'responsavel'>>) => mudar(cid, (c) => ({ ...c, ...campos })),
  }
}

const ordenar = (lista: Cliente[]) => [...lista].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))

function ProvedorDemonstracao({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<Base>(carregarDemonstracao)

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

  const acoes = useMemo<Acoes>(
    () => ({
      demonstracao: true,
      carregando: false,
      erro: '',
      recarregar: () => {},
      base,
      clientes: ordenar(base.clientes),
      cliente: (cid) => base.clientes.find((c) => c.id === cid),
      receber: (cid, texto) => mudar(cid, (c) => receberDoCliente(c, texto, agora())),
      responder: async (cid, texto, autor) => mudar(cid, (c) => enviarComoEquipe(c, texto, autor, agora())),
      repetirPergunta: async (cid, autor) => mudar(cid, (c) => repetirPerguntaComoRobo(c, autor, agora())),
      novoContato: (telefone, origem, primeira) => {
        const c = receberDoCliente(novoCliente(telefone, origem, agora()), primeira, agora())
        setBase((b) => ({ ...b, clientes: [c, ...b.clientes] }))
        return c.id
      },
      ...transformacoes(mudar),
      // Na demonstracao a mensagem a familia aparece na conversa, sem WhatsApp.
      confirmarReuniao: (cid, data, autor, avisar = true) => {
        const c = base.clientes.find((x) => x.id === cid)
        transformacoes(mudar).confirmarReuniao(cid, data, autor)
        if (avisar && c) mudar(cid, (x) => enviarComoEquipe(x, mensagemDaReuniao(c, c.reuniao?.confirmada ? 'remarcada' : 'confirmada', data), autor, agora()))
      },
      cancelarReuniao: (cid, autor, avisar = true) => {
        const c = base.clientes.find((x) => x.id === cid)
        transformacoes(mudar).cancelarReuniao(cid, autor)
        if (avisar && c?.reuniao?.confirmada && c.reuniao.data) mudar(cid, (x) => enviarComoEquipe(x, mensagemDaReuniao(c, 'desmarcada', c.reuniao!.data!), autor, agora()))
      },
      recomecarDemonstracao: () => setBase(baseDeDemonstracao()),
    }),
    [base, mudar],
  )
  return <Contexto.Provider value={acoes}>{children}</Contexto.Provider>
}

const ESPERA_PARA_GRAVAR_MS = 600

function ProvedorReal({ children }: { children: ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const atual = useRef<Cliente[]>([])
  // Edicoes ainda nao gravadas: o "antes" do primeiro toque e o ultimo "depois".
  const pendentes = useRef(new Map<string, { antes: Cliente; timer: number }>())

  const aplicar = useCallback((lista: Cliente[]) => {
    atual.current = lista
    setClientes(lista)
  }, [])

  const recarregar = useCallback(() => {
    carregarClientes()
      .then((lista) => {
        // Cliente com edicao em andamento fica com a versao da tela ate gravar.
        const mescla = lista.map((c) => (pendentes.current.has(c.id) ? (atual.current.find((x) => x.id === c.id) ?? c) : c))
        aplicar(mescla)
        setErro('')
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [aplicar])

  // So o cliente que mudou: com o historico do Pixel Hub a base passou de 22
  // mil mensagens, e reler tudo a cada mensagem nova pesava em cada aba aberta.
  const atualizarUm = useCallback(
    (cid: string) => {
      carregarUmCliente(cid)
        .then((c) => {
          if (pendentes.current.has(cid)) return // edicao em andamento: a tela manda ate gravar
          const lista = atual.current
          // Conversa do historico do Pixel Hub nao entra no atendimento (tela Historico).
          if (!c || c.historico) return aplicar(lista.filter((x) => x.id !== cid))
          aplicar(lista.some((x) => x.id === cid) ? lista.map((x) => (x.id === cid ? c : x)) : [c, ...lista])
        })
        .catch((e: Error) => setErro(e.message))
    },
    [aplicar],
  )

  useEffect(() => {
    recarregar()
    if (!supabase) return
    let timer = 0
    const mudou = new Set<string>()
    const depois = (cid: string | undefined) => {
      if (!cid) return
      mudou.add(cid)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const ids = [...mudou]
        mudou.clear()
        // Muita coisa de uma vez (importacao, por exemplo): uma leitura so.
        if (ids.length > 20) recarregar()
        else ids.forEach(atualizarUm)
      }, 400)
    }
    type Linha = { id?: string; cliente_id?: string }
    const canal = supabase
      .channel('dados-da-central')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, (p) => depois(((p.new as Linha)?.cliente_id ?? (p.old as Linha)?.cliente_id)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, (p) => depois(((p.new as Linha)?.id ?? (p.old as Linha)?.id)))
      .subscribe()
    // Rede de seguranca: se o Realtime cair, a tela ainda se atualiza. So
    // pergunta QUEM mudou: reler a base inteira (12 MB com o historico do Pixel
    // Hub) a cada 5 min, por aba aberta, estourava a cota de trafego do Supabase.
    let ultimaChecagem = Date.now()
    const periodico = window.setInterval(() => {
      const desde = new Date(ultimaChecagem - 120000).toISOString() // 2 min de folga
      ultimaChecagem = Date.now()
      clientesMudadosDesde(desde)
        .then((ids) => (ids.length > 20 ? recarregar() : ids.forEach(atualizarUm)))
        .catch((e: Error) => setErro(e.message))
    }, 5 * 60000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(periodico)
      void supabase?.removeChannel(canal)
    }
  }, [recarregar, atualizarUm])

  const gravar = useCallback(
    (cid: string) => {
      const p = pendentes.current.get(cid)
      const depois = atual.current.find((c) => c.id === cid)
      pendentes.current.delete(cid)
      if (!p || !depois) return
      gravarDiferenca(p.antes, depois).catch((e: Error) => {
        setErro(e.message)
        recarregar()
      })
    },
    [recarregar],
  )

  const mudar = useCallback(
    (cid: string, fn: (c: Cliente) => Cliente) => {
      const velho = atual.current.find((c) => c.id === cid)
      if (!velho) return
      const novo = fn(velho)
      if (novo === velho) return
      aplicar(atual.current.map((c) => (c.id === cid ? novo : c)))
      const p = pendentes.current.get(cid)
      if (p) window.clearTimeout(p.timer)
      pendentes.current.set(cid, { antes: p?.antes ?? velho, timer: window.setTimeout(() => gravar(cid), ESPERA_PARA_GRAVAR_MS) })
    },
    [aplicar, gravar],
  )

  // Outlook depois da mudanca na tela: erro vira aviso, a Central segue.
  const outlook = useCallback(
    (corpo: Parameters<typeof agendaOutlook>[0]) => {
      agendaOutlook(corpo).catch((e: Error) => setErro(e.message))
    },
    [],
  )

  // Data da reuniao para a familia. Fora das 24h da ultima mensagem dela a
  // Meta recusa texto livre: o erro aparece e a equipe avisa por outro jeito.
  const avisarFamilia = useCallback(
    (c: Cliente, texto: string) => {
      if (!c.telefone) return setErro(`${c.nome || 'Este cliente'} ainda não tem WhatsApp: avise sobre a reunião por outro meio.`)
      enviarResposta(c.id, texto)
        .then(() => window.setTimeout(() => atualizarUm(c.id), ESPERA_PARA_GRAVAR_MS + 400))
        .catch((e: Error) => setErro(`Reunião salva, mas a mensagem para a família não foi: ${e.message}`))
    },
    [atualizarUm],
  )

  const acoes = useMemo<Acoes>(
    () => {
      const t = transformacoes(mudar)
      const tinhaReuniao = (cid: string) => Boolean(atual.current.find((c) => c.id === cid)?.reuniao?.confirmada)
      return {
      demonstracao: false,
      carregando,
      erro,
      recarregar,
      base: { versao: 1, clientes, ultimaGeracao: agora() },
      clientes: ordenar(clientes),
      cliente: (cid) => clientes.find((c) => c.id === cid),
      receber: () => {
        throw new Error('Escrever como o cliente só existe na demonstração.')
      },
      responder: async (cid, texto, _autor, extras) => {
        // Contrato importado antes do numero: avisar aqui, e nao com o erro da Meta.
        if (!atual.current.find((c) => c.id === cid)?.telefone) throw new Error('Este cliente ainda não tem WhatsApp. Adicione o número na ficha antes de responder.')
        await enviarResposta(cid, texto, extras)
        atualizarUm(cid)
      },
      repetirPergunta: async (cid) => {
        await repetirPerguntaPeloWhatsApp(cid)
        atualizarUm(cid)
      },
      novoContato: () => {
        throw new Error('Contato novo chega pelo WhatsApp, não pela tela.')
      },
      ...t,
      confirmarReuniao: (cid, data, autor, avisar = true) => {
        const antes = atual.current.find((x) => x.id === cid)
        t.confirmarReuniao(cid, data, autor)
        outlook({ acao: 'salvar', cliente_id: cid, inicio: data, nome: antes?.nome || antes?.telefone, telefone: antes?.telefone, autor })
        if (avisar && antes) avisarFamilia(antes, mensagemDaReuniao(antes, antes.reuniao?.confirmada ? 'remarcada' : 'confirmada', data))
      },
      cancelarReuniao: (cid, autor, avisar = true) => {
        const antes = atual.current.find((x) => x.id === cid)
        const tinha = tinhaReuniao(cid)
        t.cancelarReuniao(cid, autor)
        if (tinha) outlook({ acao: 'apagar', cliente_id: cid })
        if (avisar && tinha && antes?.reuniao?.data) avisarFamilia(antes, mensagemDaReuniao(antes, 'desmarcada', antes.reuniao.data))
      },
      moverEtapa: (cid, etapa, autor, motivoPerda) => {
        const tinha = tinhaReuniao(cid)
        t.moverEtapa(cid, etapa, autor, motivoPerda)
        // Cliente perdido nao tem reuniao: sai da agenda do Dr. Andre.
        if (etapa === 'perdido' && tinha) outlook({ acao: 'apagar', cliente_id: cid })
      },
      recomecarDemonstracao: () => {},
      }
    },
    [clientes, carregando, erro, recarregar, mudar, atualizarUm, outlook, avisarFamilia],
  )
  return <Contexto.Provider value={acoes}>{children}</Contexto.Provider>
}

export function ProvedorDeDados({ demonstracao, children }: { demonstracao: boolean; children: ReactNode }) {
  return demonstracao ? <ProvedorDemonstracao>{children}</ProvedorDemonstracao> : <ProvedorReal>{children}</ProvedorReal>
}

export function useDados(): Acoes {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useDados fora do ProvedorDeDados')
  return ctx
}
