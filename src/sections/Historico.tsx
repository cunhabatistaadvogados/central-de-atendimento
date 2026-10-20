import type { Etapa } from '@motor/robo'
import { Archive, CalendarRange, History, Loader2, MessagesSquare, Search, Smartphone, StickyNote, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, ChipEtapa, PainelLateral, Vazio } from '@/components/ui'
import { ETAPAS } from '@/lib/escritorio'
import { carregarHistorico, carregarUmCliente, formatarTelefone, trazerParaOAtendimento, type ResumoHistorico } from '@/lib/repositorio'
import { useDados } from '@/lib/store'
import type { Cliente } from '@/lib/tipos'
import { Bolhas } from './Conversas'

/**
 * Historico do Pixel Hub (pedido do Lucas, 20/10/2026): as 1.767 conversas
 * importadas saem do atendimento e ficam so aqui, para consulta. A Central
 * recomeca zerada no dia em que o numero veio para o robo. Quem daqui volta a
 * escrever sai sozinho (gatilho no banco) e aparece em Conversas.
 */

// 1.767 linhas de uma vez travavam a rolagem no celular: mostra em lotes.
const LOTE = 50

const data = (iso: string | null, ano: '2-digit' | 'numeric' = '2-digit') =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: ano }) : '-'

const soDigitos = (s: string) => s.replace(/\D/g, '')

const mes = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

// "abr a out" cabe no cartao; com as datas inteiras o valor saia cortado.
function periodo(de: string | null, ate: string | null) {
  if (!de || !ate) return { valor: '-', detalhe: '' }
  const [a, b] = [new Date(de).getFullYear(), new Date(ate).getFullYear()]
  const valor = a === b ? `${mes(de)} a ${mes(ate)}` : `${mes(de)}/${String(a).slice(2)} a ${mes(ate)}/${String(b).slice(2)}`
  return { valor, detalhe: `${data(de).slice(0, 5)} a ${data(ate, 'numeric')}` }
}

// Anexo do Pixel Hub e um link enorme: na lista basta saber que tem anexo.
const previa = (texto: string) => texto.replace(/\[anexo\] \S+/g, '(anexo)')

function Numero({ icone: I, rotulo, valor, detalhe }: { icone: typeof History; rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="cartao flex items-center gap-4 p-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ouro-50 text-ouro-600">
        <I className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="rotulo text-slate-400">{rotulo}</p>
        <p className="titulo-serif mt-1 truncate text-[28px] leading-none text-marinho-900">{valor}</p>
        <p className="mt-1 text-xs leading-snug text-slate-500">{detalhe}</p>
      </div>
    </div>
  )
}

function ConversaAntiga({ id, onFechar, onTrazido }: { id: string; onFechar: () => void; onTrazido: (c: Cliente) => void }) {
  const [c, setC] = useState<Cliente | null>(null)
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [trazendo, setTrazendo] = useState(false)
  const rolagem = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarUmCliente(id)
      .then(setC)
      .catch((e: Error) => setErro(e.message))
  }, [id])
  // Abre no fim, como no WhatsApp: a ultima mensagem e o que se procura. Rola
  // so a conversa; scrollIntoView rolava a pagina inteira por tras do painel.
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollTop = rolagem.current.scrollHeight
  }, [c])

  async function trazer() {
    if (!c) return
    setTrazendo(true)
    try {
      await trazerParaOAtendimento(c.id)
      onTrazido(c)
    } catch (e) {
      setErro((e as Error).message)
      setTrazendo(false)
    }
  }

  const notas = c?.eventos.filter((e) => e.texto.startsWith('Nota no Pixel Hub') || e.texto.startsWith('Etiquetas no Pixel Hub')) ?? []

  // Portal: dentro da tela, a animacao de entrada (.entrar) virava referencia
  // do position fixed e o painel abria no meio da pagina, nao colado no menu.
  return createPortal(
    <PainelLateral aberto onFechar={onFechar}>
      <header className="relative overflow-hidden bg-marinho-900 px-5 pb-5 pt-5 text-white sm:px-7">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ouro-500/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <Avatar nome={c?.nome || c?.telefone || '?'} tamanho="h-14 w-14 text-base" />
          <div className="min-w-0 flex-1">
            <p className="titulo-serif truncate text-[28px] leading-tight">{c ? c.nome || 'Sem nome no Pixel Hub' : 'Abrindo a conversa...'}</p>
            {c && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
                <Smartphone className="h-3.5 w-3.5" /> {c.telefone} · {c.mensagens.length} mensagens
              </p>
            )}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar conversa" className="rounded-xl p-2 text-white/60 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        {c && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <ChipEtapa etapa={c.etapa} />
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">
              <Archive className="h-3 w-3" /> histórico do Pixel Hub
            </span>
          </div>
        )}
      </header>

      <div ref={rolagem} className="papel-whatsapp rolagem-fina flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
        {erro && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erro}</p>}
        {!c && !erro && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando as mensagens...
          </p>
        )}
        {notas.length > 0 && (
          <div className="mx-auto mb-3 max-w-xl rounded-2xl border border-ouro-200 bg-ouro-50/90 px-4 py-3 text-[12.5px] text-marinho-900">
            <p className="rotulo mb-1.5 flex items-center gap-1.5 text-ouro-700">
              <StickyNote className="h-3.5 w-3.5" /> Anotações no Pixel Hub
            </p>
            <ul className="space-y-1">
              {notas.map((n) => (
                <li key={n.id} className="whitespace-pre-line">
                  {n.texto.replace(/^(Nota|Etiquetas) no Pixel Hub: /, (_, t: string) => (t === 'Etiquetas' ? 'Etiquetas: ' : ''))}
                </li>
              ))}
            </ul>
          </div>
        )}
        {c && <Bolhas mensagens={c.mensagens} />}
      </div>

      {/* Trazer de volta e para quando a equipe quer retomar um caso antigo sem
          esperar a pessoa escrever. */}
      {c && (
        <footer className="border-t border-marinho-900/[0.07] bg-white px-5 py-4 sm:px-7">
          {confirmar ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-slate-600">
                <strong className="text-marinho-900">{c.nome || c.telefone}</strong> volta para Conversas, Funil e Clientes, com esta conversa junto. O robô continua pausado.
              </p>
              <button type="button" onClick={() => setConfirmar(false)} className="botao-claro py-2 text-xs" disabled={trazendo}>
                Cancelar
              </button>
              <button type="button" onClick={trazer} className="botao-ouro py-2 text-xs" disabled={trazendo}>
                {trazendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Trazer agora
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xs text-slate-500">Se a pessoa voltar a escrever, ela sai do histórico sozinha.</p>
              <button type="button" onClick={() => setConfirmar(true)} className="botao-claro py-2 text-xs">
                <Undo2 className="h-3.5 w-3.5" /> Trazer para o atendimento
              </button>
            </div>
          )}
        </footer>
      )}
    </PainelLateral>,
    document.body,
  )
}

export default function Historico() {
  const { demonstracao } = useDados()
  const [linhas, setLinhas] = useState<ResumoHistorico[] | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [etapa, setEtapa] = useState<Etapa | 'todas'>('todas')
  const [mostrar, setMostrar] = useState(LOTE)
  const [aberto, setAberto] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const ler = useCallback(() => {
    setErro('')
    carregarHistorico()
      .then(setLinhas)
      .catch((e: Error) => setErro(e.message))
  }, [])
  useEffect(() => {
    if (!demonstracao) ler()
  }, [demonstracao, ler])

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const d = soDigitos(b)
    return (linhas ?? []).filter(
      (l) =>
        (etapa === 'todas' || l.etapa === etapa) &&
        (!b || l.nome.toLowerCase().includes(b) || (d.length >= 3 && l.telefone.includes(d)) || (l.ultima_texto ?? '').toLowerCase().includes(b)),
    )
  }, [linhas, busca, etapa])

  const resumo = useMemo(() => {
    const ls = linhas ?? []
    const datas = ls.flatMap((l) => [l.primeira_em, l.ultima_em]).filter((x): x is string => Boolean(x)).sort()
    return {
      conversas: ls.length,
      mensagens: ls.reduce((s, l) => s + l.total, 0),
      de: datas[0] ?? null,
      ate: datas.at(-1) ?? null,
      porEtapa: new Map(ETAPAS.map((e) => [e.chave, ls.filter((l) => l.etapa === e.chave).length])),
    }
  }, [linhas])

  if (demonstracao) {
    return (
      <div className="cartao">
        <Vazio icone={<History className="h-6 w-6" />} titulo="Histórico do Pixel Hub" texto="As conversas antigas do escritório só aparecem no acesso real, com o login da equipe." />
      </div>
    )
  }

  const nf = (n: number) => n.toLocaleString('pt-BR')

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Numero icone={MessagesSquare} rotulo="Conversas" valor={linhas ? nf(resumo.conversas) : '...'} detalhe="importadas do Pixel Hub" />
        <Numero icone={History} rotulo="Mensagens" valor={linhas ? nf(resumo.mensagens) : '...'} detalhe="clientes, equipe e a IA antiga" />
        <Numero icone={CalendarRange} rotulo="Período" valor={linhas ? periodo(resumo.de, resumo.ate).valor : '...'} detalhe={linhas ? periodo(resumo.de, resumo.ate).detalhe : 'até o número vir para o robô'} />
      </div>

      {aviso && (
        <p className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <Undo2 className="h-4 w-4 shrink-0" /> {aviso}
          <button type="button" onClick={() => setAviso('')} aria-label="Fechar aviso" className="ml-auto rounded-lg p-1 text-emerald-700 hover:bg-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}

      <div className="cartao overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-marinho-900/[0.06] p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setMostrar(LOTE)
              }}
              placeholder="Buscar por nome, telefone ou última mensagem"
              className="campo pl-9"
            />
          </div>
          <select
            value={etapa}
            onChange={(e) => {
              setEtapa(e.target.value as Etapa | 'todas')
              setMostrar(LOTE)
            }}
            className="campo sm:w-64"
          >
            <option value="todas">Todas as etapas</option>
            {ETAPAS.filter((e) => resumo.porEtapa.get(e.chave)).map((e) => (
              <option key={e.chave} value={e.chave}>
                {e.nome} ({nf(resumo.porEtapa.get(e.chave) ?? 0)})
              </option>
            ))}
          </select>
        </div>

        {erro ? (
          <div className="flex flex-wrap items-center gap-3 px-5 py-6 text-sm text-red-700">
            <span className="font-semibold">{erro}</span>
            <button type="button" onClick={ler} className="botao-claro ml-auto py-1.5 text-xs">
              Tentar de novo
            </button>
          </div>
        ) : !linhas ? (
          <p className="flex items-center justify-center gap-2 py-14 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando o histórico...
          </p>
        ) : lista.length === 0 ? (
          <Vazio icone={<Archive className="h-6 w-6" />} titulo={linhas.length ? 'Ninguém encontrado' : 'Histórico vazio'} />
        ) : (
          <>
            <p className="border-b border-marinho-900/[0.04] px-5 py-2.5 text-xs text-slate-400">
              {lista.length === linhas.length ? `${nf(lista.length)} conversas, da mais recente para a mais antiga` : `${nf(lista.length)} de ${nf(linhas.length)} conversas`}
            </p>
            <ul>
              {lista.slice(0, mostrar).map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setAberto(l.id)}
                    className="flex w-full items-center gap-3 border-b border-marinho-900/[0.04] px-4 py-3 text-left transition hover:bg-ouro-50/50 sm:px-5"
                  >
                    <Avatar nome={l.nome || l.telefone} tamanho="h-10 w-10 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-marinho-900">{l.nome || formatarTelefone(l.telefone)}</p>
                        <span className="hidden sm:inline">
                          <ChipEtapa etapa={l.etapa} compacto />
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {l.ultima_texto ? (
                          <>
                            <span className="font-semibold text-slate-400">{l.ultima_de === 'cliente' ? 'Cliente: ' : 'Equipe: '}</span>
                            {previa(l.ultima_texto)}
                          </>
                        ) : (
                          <span className="text-slate-400">sem mensagens</span>
                        )}
                      </p>
                      {l.nome && <p className="mt-0.5 text-[11px] text-slate-400">{formatarTelefone(l.telefone)}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-slate-500">{data(l.ultima_em ?? l.criado_em)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{nf(l.total)} msg</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {lista.length > mostrar && (
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => setMostrar((m) => m + LOTE)}
                  className="w-full rounded-2xl border border-dashed border-marinho-900/15 py-2.5 text-xs font-bold text-marinho-700 transition hover:bg-ouro-50/60"
                >
                  Mostrar mais {Math.min(LOTE, lista.length - mostrar)} (faltam {nf(lista.length - mostrar)})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {aberto && (
        <ConversaAntiga
          id={aberto}
          onFechar={() => setAberto(null)}
          onTrazido={(c) => {
            setAberto(null)
            setLinhas((ls) => ls?.filter((l) => l.id !== c.id) ?? null)
            setAviso(`${c.nome || c.telefone} voltou para o atendimento: está em Conversas, no Funil e em Clientes.`)
          }}
        />
      )}
    </div>
  )
}
