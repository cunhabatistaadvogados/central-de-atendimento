import { iniciais } from '@/lib/atendimento'
import { PAPEIS, type Online } from '@/lib/equipe'

/** Bolinhas da equipe online, com o nome ao passar o mouse. */
export default function QuemEstaOnline({ online, tema = 'escuro', compacto = false }: { online: Online[]; tema?: 'escuro' | 'claro'; compacto?: boolean }) {
  const escuro = tema === 'escuro'
  if (compacto) {
    if (!online.length) return null
    return (
      <div className="flex -space-x-2" title={online.map((p) => p.nome).join(', ')}>
        {online.slice(0, 3).map((p) => (
          <span key={p.user_id} className="relative flex h-8 w-8 items-center justify-center rounded-full bg-ouro-500 text-[10px] font-extrabold text-marinho-950 ring-2 ring-marinho-900">
            {iniciais(p.nome)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-marinho-900" />
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className={`rounded-[22px] border p-4 ${escuro ? 'border-white/10 bg-white/[0.05]' : 'border-marinho-900/10 bg-white'}`}>
      <p className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] ${escuro ? 'text-white/40' : 'text-slate-400'}`}>
        <span className="h-2 w-2 rounded-full bg-emerald-400" /> Online agora · {online.length}
      </p>
      {online.length === 0 ? (
        <p className={`mt-2 text-[11px] ${escuro ? 'text-white/35' : 'text-slate-400'}`}>Ninguém da equipe online agora.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {online.slice(0, 6).map((p) => (
            <li key={p.user_id} className="flex items-center gap-2.5">
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ouro-500 text-[10px] font-extrabold text-marinho-950">
                {iniciais(p.nome)}
                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ${escuro ? 'ring-marinho-900' : 'ring-white'}`} />
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-xs font-bold ${escuro ? 'text-white/85' : 'text-marinho-900'}`}>{p.nome}</span>
                <span className={`block text-[10px] ${escuro ? 'text-white/40' : 'text-slate-400'}`}>{PAPEIS[p.papel]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
