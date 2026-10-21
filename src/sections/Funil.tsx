import { temLaudo, type Etapa } from '@motor/robo'
import { AlarmClock, Bot, CalendarCheck2, FileSignature } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Avatar, ChipPublico, Modal } from '@/components/ui'
import { esperandoEquipe, publicos } from '@/lib/atendimento'
import { ETAPAS } from '@/lib/escritorio'
import { haQuanto } from '@/lib/formato'
import { useDados } from '@/lib/store'
import type { Cliente } from '@/lib/tipos'

const MOTIVOS_DE_PERDA = ['Parou de responder', 'Fora do perfil (renda)', 'Fechou com outro escritório', 'Desistiu do pedido', 'Número errado']

function Cartao({ c, onAbrir }: { c: Cliente; onAbrir: () => void }) {
  const f = c.robo.ficha
  const pendencias = c.pendencias.filter((p) => !p.resolvida).length
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', c.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onAbrir}
      className="cursor-grab rounded-2xl border border-marinho-900/[0.07] bg-white p-3.5 shadow-[0_2px_6px_rgba(11,31,56,.04)] transition hover:-translate-y-0.5 hover:border-ouro-300 hover:shadow-cartao active:cursor-grabbing"
    >
      <div className="flex items-center gap-2.5">
        <Avatar nome={c.nome || c.telefone} tamanho="h-8 w-8 text-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold">{c.nome || c.telefone}</p>
          <p className="truncate text-[11px] text-slate-400">{[f.diagnostico, f.idade !== undefined ? `${f.idade} anos` : ''].filter(Boolean).join(' · ') || 'qualificando...'}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
        {!c.robo.pausado && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
            <Bot className="h-3 w-3" /> robô
          </span>
        )}
        {esperandoEquipe(c) && <span className="rounded-full bg-ouro-500 px-2 py-0.5 text-marinho-950">esperando equipe</span>}
        {f.laudo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{temLaudo(f) ? 'com laudo' : f.laudo === 'nao_sei' ? 'laudo?' : 'sem laudo'}</span>}
        {publicos(f).map((p) => (
          <ChipPublico key={p} publico={p} />
        ))}
        {pendencias > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">
            <AlarmClock className="h-3 w-3" /> {pendencias}
          </span>
        )}
        {c.reuniao && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">
            <CalendarCheck2 className="h-3 w-3" /> {c.reuniao.quando}
          </span>
        )}
        {c.contrato && c.contrato.status !== 'rascunho' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-marinho-50 px-2 py-0.5 text-marinho-700">
            <FileSignature className="h-3 w-3" /> {c.contrato.status}
          </span>
        )}
        <span className="ml-auto text-slate-300">{haQuanto(c.atualizadoEm)}</span>
      </div>
    </div>
  )
}

export default function Funil({ abrirCliente, autor }: { abrirCliente: (id: string) => void; autor: string }) {
  const { clientes, moverEtapa } = useDados()
  const [sobre, setSobre] = useState<Etapa | null>(null)
  const [perdendo, setPerdendo] = useState<string | null>(null)
  // Com o historico do Pixel Hub uma coluna passou de 1.400 cartoes: a tela
  // travava desenhando todos. Mostra os mais recentes e abre mais sob pedido.
  const [mostrar, setMostrar] = useState<Partial<Record<Etapa, number>>>({})
  const LOTE = 30

  function soltar(e: DragEvent, etapa: Etapa) {
    e.preventDefault()
    setSobre(null)
    const id = e.dataTransfer.getData('text/plain')
    const c = clientes.find((x) => x.id === id)
    if (!c || c.etapa === etapa) return
    if (etapa === 'perdido') setPerdendo(id)
    else moverEtapa(id, etapa, autor)
  }

  return (
    <>
      <div className="rolagem-fina -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-7 sm:px-7 lg:mx-0 lg:px-0">
        {ETAPAS.map((e) => {
          const daEtapa = clientes.filter((c) => c.etapa === e.chave)
          return (
            <section
              key={e.chave}
              onDragOver={(ev) => {
                ev.preventDefault()
                setSobre(e.chave)
              }}
              onDragLeave={() => setSobre((s) => (s === e.chave ? null : s))}
              onDrop={(ev) => soltar(ev, e.chave)}
              className={`flex w-[272px] shrink-0 flex-col rounded-[22px] border p-3 transition ${sobre === e.chave ? 'border-ouro-400 bg-ouro-50' : 'border-marinho-900/[0.06] bg-white/55'}`}
            >
              <header className="mb-3 flex items-center gap-2 px-1.5 pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${e.ponto}`} />
                <h2 className="text-[13px] font-extrabold text-marinho-900">{e.nome}</h2>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-slate-500 shadow-sm">{daEtapa.length}</span>
              </header>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2.5">
                {daEtapa.slice(0, mostrar[e.chave] ?? LOTE).map((c) => (
                  <Cartao key={c.id} c={c} onAbrir={() => abrirCliente(c.id)} />
                ))}
                {daEtapa.length > (mostrar[e.chave] ?? LOTE) && (
                  <button
                    type="button"
                    onClick={() => setMostrar((m) => ({ ...m, [e.chave]: (m[e.chave] ?? LOTE) + LOTE }))}
                    className="rounded-2xl border border-dashed border-marinho-900/15 py-2.5 text-[11px] font-bold text-marinho-700 transition hover:bg-white"
                  >
                    Mostrar mais {Math.min(LOTE, daEtapa.length - (mostrar[e.chave] ?? LOTE))} (faltam {daEtapa.length - (mostrar[e.chave] ?? LOTE)})
                  </button>
                )}
                {daEtapa.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-300">Arraste para cá</p>}
              </div>
            </section>
          )
        })}
      </div>
      <Modal aberto={perdendo !== null} onFechar={() => setPerdendo(null)} titulo="Por que foi perdido?">
        <p className="mb-4 text-sm text-slate-500">O motivo ajuda a entender onde o atendimento ainda perde famílias.</p>
        <div className="grid gap-2">
          {MOTIVOS_DE_PERDA.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (perdendo) moverEtapa(perdendo, 'perdido', autor, m)
                setPerdendo(null)
              }}
              className="botao-claro justify-start"
            >
              {m}
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}
