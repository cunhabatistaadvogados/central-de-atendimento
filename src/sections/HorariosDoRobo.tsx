import { GRADE_PADRAO, proximosLivres, type GradeDaAgenda } from '@motor/robo'
import { CalendarClock, Plus, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { horariosOcupados } from '@/lib/atendimento'
import { carregarGrade, salvarGrade } from '@/lib/repositorio'
import { useDados } from '@/lib/store'

const DIAS = [
  { n: 1, nome: 'Segunda' },
  { n: 2, nome: 'Terça' },
  { n: 3, nome: 'Quarta' },
  { n: 4, nome: 'Quinta' },
  { n: 5, nome: 'Sexta' },
  { n: 6, nome: 'Sábado' },
]
const CHAVE_DEMO = 'cbaa-grade-demo'

/** "13:40" -> "13h40"; "09:00" -> "9h". */
function hhmm(h: string): string {
  const [a, b] = h.split(':')
  return `${Number(a)}h${b && b !== '00' ? b : ''}`
}

/** ISO -> "qui 23/10, 9h" no horario de Brasilia. */
function vaga(iso: string): string {
  const d = new Date(iso)
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...o })
  const m = Number(f({ minute: 'numeric' }))
  return `${f({ weekday: 'short' }).replace('.', '')} ${f({ day: '2-digit', month: '2-digit' })}, ${Number(f({ hour: 'numeric', hour12: false }))}h${m ? String(m).padStart(2, '0') : ''}`
}

/** Data "2026-10-23" + "08:00" no horario de Brasilia (UTC-3) -> ISO. */
const isoDe = (data: string, h: string) => new Date(`${data}T${h}:00-03:00`).toISOString()

export default function HorariosDoRobo({ autor }: { autor: string }) {
  const { clientes, demonstracao } = useDados()
  const [grade, setGrade] = useState<GradeDaAgenda | null>(null)
  const [salva, setSalva] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novo, setNovo] = useState<Record<number, string>>({})
  const [bloqueio, setBloqueio] = useState({ data: '', de: '08:00', ate: '18:00', motivo: '' })

  useEffect(() => {
    if (demonstracao) {
      let g: GradeDaAgenda | null = null
      try {
        g = JSON.parse(localStorage.getItem(CHAVE_DEMO) ?? 'null')
      } catch {
        // armazenamento bloqueado: fica a grade padrao
      }
      const inicial = g ?? GRADE_PADRAO
      setGrade(inicial)
      setSalva(JSON.stringify(inicial))
      return
    }
    carregarGrade()
      .then((g) => {
        const inicial = g ?? GRADE_PADRAO
        setGrade(inicial)
        setSalva(JSON.stringify(g ?? ''))
      })
      .catch((e: Error) => {
        setAviso(e.message)
        setGrade(GRADE_PADRAO)
      })
  }, [demonstracao])

  const ocupados = useMemo(() => horariosOcupados(clientes), [clientes])
  const previa = useMemo(() => (grade ? proximosLivres(new Date(), { grade, ocupados }, 6) : []), [grade, ocupados])

  if (!grade) return <div className="cartao p-5 text-sm text-slate-400">Carregando os horários...</div>

  const mudou = JSON.stringify(grade) !== salva
  const mudar = (fn: (g: GradeDaAgenda) => GradeDaAgenda) => setGrade((g) => (g ? fn(g) : g))
  const doDia = (n: number) => grade.horarios[String(n)] ?? []
  const porNoDia = (n: number) => {
    const h = novo[n]
    if (!h || doDia(n).includes(h)) return
    mudar((g) => ({ ...g, horarios: { ...g.horarios, [String(n)]: [...doDia(n), h].sort() } }))
    setNovo((x) => ({ ...x, [n]: '' }))
  }

  const salvar = async () => {
    setSalvando(true)
    setAviso('')
    try {
      if (demonstracao) localStorage.setItem(CHAVE_DEMO, JSON.stringify(grade))
      else await salvarGrade(grade, autor)
      setSalva(JSON.stringify(grade))
      setAviso('Salvo. O robô já oferece estes horários na próxima conversa.')
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="cartao space-y-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rotulo text-ouro-600">Horários que o robô oferece</p>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            O robô oferece os dois primeiros horários livres. O que outra família já pediu ou a equipe confirmou sai das opções sozinho.
          </p>
        </div>
        <button type="button" onClick={salvar} disabled={!mudou || salvando} className="botao-primario py-2">
          <Save className="h-4 w-4" /> {salvando ? 'Salvando...' : 'Salvar horários'}
        </button>
      </div>
      {aviso && <p className="rounded-xl bg-ouro-50 px-3 py-2 text-xs font-bold text-marinho-800">{aviso}</p>}

      <div className="space-y-2">
        {DIAS.map(({ n, nome }) => (
          <div key={n} className="flex flex-wrap items-center gap-2 rounded-xl border border-marinho-900/[0.07] px-3 py-2">
            <span className="w-20 shrink-0 text-xs font-bold text-marinho-900">{nome}</span>
            {doDia(n).length === 0 && <span className="text-xs text-slate-400">sem atendimento</span>}
            {doDia(n).map((h) => (
              <span key={h} className="inline-flex items-center gap-1 rounded-full bg-marinho-50 px-2.5 py-1 text-xs font-bold text-marinho-800">
                {hhmm(h)}
                <button
                  type="button"
                  aria-label={`Tirar ${hhmm(h)} de ${nome}`}
                  onClick={() => mudar((g) => ({ ...g, horarios: { ...g.horarios, [String(n)]: doDia(n).filter((x) => x !== h) } }))}
                  className="text-slate-400 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-1">
              <input type="time" value={novo[n] ?? ''} onChange={(e) => setNovo((x) => ({ ...x, [n]: e.target.value }))} className="campo w-28 py-1 text-xs" aria-label={`Novo horário de ${nome}`} />
              <button type="button" onClick={() => porNoDia(n)} disabled={!novo[n]} className="botao-claro px-2 py-1" aria-label={`Pôr horário em ${nome}`}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-marinho-900">
          Duração da reunião (minutos)
          <input type="number" min={10} max={180} step={5} value={grade.duracaoMin} onChange={(e) => mudar((g) => ({ ...g, duracaoMin: Number(e.target.value) || 30 }))} className="campo mt-1 py-2" />
        </label>
        <label className="text-xs font-bold text-marinho-900">
          Antecedência mínima (horas)
          <input type="number" min={0} max={72} value={grade.antecedenciaMin / 60} onChange={(e) => mudar((g) => ({ ...g, antecedenciaMin: Math.round((Number(e.target.value) || 0) * 60) }))} className="campo mt-1 py-2" />
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-marinho-900">Toda semana, fechado</p>
        <div className="space-y-2">
          {grade.bloqueiosSemanais.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={b.dia} onChange={(e) => mudar((g) => ({ ...g, bloqueiosSemanais: g.bloqueiosSemanais.map((x, j) => (j === i ? { ...x, dia: Number(e.target.value) } : x)) }))} className="campo w-32 py-1.5 text-xs">
                {DIAS.map((d) => (
                  <option key={d.n} value={d.n}>
                    {d.nome}
                  </option>
                ))}
              </select>
              <input type="time" value={b.de} onChange={(e) => mudar((g) => ({ ...g, bloqueiosSemanais: g.bloqueiosSemanais.map((x, j) => (j === i ? { ...x, de: e.target.value } : x)) }))} className="campo w-28 py-1.5 text-xs" aria-label="De" />
              <span className="text-xs text-slate-400">até</span>
              <input type="time" value={b.ate} onChange={(e) => mudar((g) => ({ ...g, bloqueiosSemanais: g.bloqueiosSemanais.map((x, j) => (j === i ? { ...x, ate: e.target.value } : x)) }))} className="campo w-28 py-1.5 text-xs" aria-label="Até" />
              <input value={b.motivo ?? ''} placeholder="Motivo (opcional)" onChange={(e) => mudar((g) => ({ ...g, bloqueiosSemanais: g.bloqueiosSemanais.map((x, j) => (j === i ? { ...x, motivo: e.target.value } : x)) }))} className="campo min-w-0 flex-1 py-1.5 text-xs" />
              <button type="button" aria-label="Tirar bloqueio" onClick={() => mudar((g) => ({ ...g, bloqueiosSemanais: g.bloqueiosSemanais.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => mudar((g) => ({ ...g, bloqueiosSemanais: [...g.bloqueiosSemanais, { dia: 1, de: '12:00', ate: '13:00' }] }))} className="botao-claro px-3 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Bloqueio semanal
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-marinho-900">Datas fechadas (viagem, audiência, folga)</p>
        <div className="space-y-1.5">
          {grade.bloqueios.map((b, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-800">
              <span className="font-bold">{vaga(b.inicio)}</span> até <span className="font-bold">{vaga(b.fim)}</span>
              {b.motivo && <span className="truncate text-red-700/80">· {b.motivo}</span>}
              <button type="button" aria-label="Tirar data fechada" onClick={() => mudar((g) => ({ ...g, bloqueios: g.bloqueios.filter((_, j) => j !== i) }))} className="ml-auto text-red-400 hover:text-red-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={bloqueio.data} onChange={(e) => setBloqueio((b) => ({ ...b, data: e.target.value }))} className="campo w-40 py-1.5 text-xs" aria-label="Data" />
            <input type="time" value={bloqueio.de} onChange={(e) => setBloqueio((b) => ({ ...b, de: e.target.value }))} className="campo w-28 py-1.5 text-xs" aria-label="De" />
            <span className="text-xs text-slate-400">até</span>
            <input type="time" value={bloqueio.ate} onChange={(e) => setBloqueio((b) => ({ ...b, ate: e.target.value }))} className="campo w-28 py-1.5 text-xs" aria-label="Até" />
            <input value={bloqueio.motivo} placeholder="Motivo (opcional)" onChange={(e) => setBloqueio((b) => ({ ...b, motivo: e.target.value }))} className="campo min-w-0 flex-1 py-1.5 text-xs" />
            <button
              type="button"
              disabled={!bloqueio.data || bloqueio.ate <= bloqueio.de}
              onClick={() => {
                mudar((g) => ({ ...g, bloqueios: [...g.bloqueios, { inicio: isoDe(bloqueio.data, bloqueio.de), fim: isoDe(bloqueio.data, bloqueio.ate), motivo: bloqueio.motivo || undefined }] }))
                setBloqueio({ data: '', de: '08:00', ate: '18:00', motivo: '' })
              }}
              className="botao-claro px-3 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Fechar data
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-50 p-3.5">
        <p className="flex items-center gap-2 text-xs font-bold text-emerald-800">
          <CalendarClock className="h-4 w-4" /> Próximos horários livres{mudou ? ' (com as mudanças, antes de salvar)' : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {previa.length === 0 && <span className="text-xs text-emerald-700">Nenhum horário livre nas próximas 3 semanas.</span>}
          {previa.map((iso, i) => (
            <span key={iso} className={`rounded-full px-2.5 py-1 text-xs font-bold ${i < 2 ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800'}`}>
              {vaga(iso)}
            </span>
          ))}
        </div>
        {previa.length >= 2 && <p className="mt-2 text-[11px] text-emerald-700">Os dois primeiros são os que o robô oferece agora.</p>}
      </div>
    </section>
  )
}
