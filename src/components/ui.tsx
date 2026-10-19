import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { Etapa } from '@motor/robo'
import { iniciais } from '@/lib/atendimento'
import { etapa as infoEtapa, ORIGENS } from '@/lib/escritorio'

const TONS = ['bg-marinho-100 text-marinho-700', 'bg-ouro-100 text-ouro-700', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-emerald-100 text-emerald-800', 'bg-orange-100 text-orange-800']

export function Avatar({ nome, tamanho = 'h-10 w-10 text-xs' }: { nome: string; tamanho?: string }) {
  const soma = [...nome].reduce((s, c) => s + c.charCodeAt(0), 0)
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${tamanho} ${TONS[soma % TONS.length]}`}>
      {iniciais(nome || '?')}
    </span>
  )
}

export function ChipEtapa({ etapa, compacto = false }: { etapa: Etapa; compacto?: boolean }) {
  const e = infoEtapa(etapa)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${e.fundo} ${e.cor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${e.ponto}`} />
      {compacto ? e.curto : e.nome}
    </span>
  )
}

export function ChipOrigem({ origem }: { origem: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{ORIGENS[origem] ?? origem}</span>
}

export function Vazio({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ouro-50 text-ouro-600">{icone}</span>
      <p className="titulo-serif text-xl text-marinho-900">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-slate-500">{texto}</p>}
    </div>
  )
}

export function Interruptor({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => onChange(!ligado)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${ligado ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ligado ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** Painel que desliza da direita (ficha do cliente). No celular ocupa a tela. */
export function PainelLateral({ aberto, onFechar, children, largura = 'max-w-3xl' }: { aberto: boolean; onFechar: () => void; children: ReactNode; largura?: string }) {
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 cursor-default bg-marinho-950/40 backdrop-blur-[2px]" />
      <div className={`entrar relative flex h-full w-full ${largura} flex-col bg-papel shadow-flutuante`}>{children}</div>
    </div>
  )
}

export function Modal({ aberto, onFechar, titulo, children }: { aberto: boolean; onFechar: () => void; titulo: string; children: ReactNode }) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 cursor-default bg-marinho-950/45" />
      <div className="entrar relative w-full max-w-lg rounded-t-[26px] bg-white p-6 shadow-flutuante sm:rounded-[26px]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="titulo-serif text-2xl text-marinho-900">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-marinho-800">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-slate-400">{dica}</span>}
    </label>
  )
}
