import { GRADE_PADRAO, horariosEntre, proximosLivres, type GradeDaAgenda } from '@motor/robo'
import { CalendarClock, Plus, Save, Wand2, X } from 'lucide-react'
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
  const [faixa, setFaixa] = useState({ de: '08:00', ate: '11:00', passo: 30, dias: [1, 2, 3, 4, 5] })

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

  // Faixa "das 8h as 11h de 30 em 30" vira 8h, 8h30, 9h... nos dias marcados (soma ao que ja tem).
  const preencher = () => {
    const novos = horariosEntre(faixa.de, faixa.ate, faixa.passo)
    mudar((g) => ({
      ...g,
      horarios: { ...g.horarios, ...Object.fromEntries(faixa.dias.map((n) => [String(n), [...new Set([...(g.horarios[String(n)] ?? []), ...novos])].sort()])) },
    }))
  }
  const fechadoNaSemana = (n: number, h: string) => {
    const [a, b] = h.split(':').map(Number)
    const ini = a * 60 + b
    return grade.bloqueiosSemanais.some((x) => {
      const [da, db] = x.de.split(':').map(Number)
      const [aa, ab] = x.ate.split(':').map(Number)
      return x.dia === n && da * 60 + db < ini + grade.duracaoMin && ini < aa * 60 + ab
    })
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
              <span
                key={h}
                title={fechadoNaSemana(n, h) ? 'Cai no bloqueio semanal: o robô não oferece' : undefined}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${fechadoNaSemana(n, h) ? 'bg-slate-100 text-slate-400 line-through' : 'bg-marinho-50 text-marinho-800'}`}
              >
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

      <div className="rounded-2xl border border-dashed border-ouro-300 bg-ouro-50/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-marinho-900">
          <Wand2 className="h-3.5 w-3.5 text-ouro-600" /> Preencher vários de uma vez
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">das</span>
          <input type="time" value={faixa.de} onChange={(e) => setFaixa((f) => ({ ...f, de: e.target.value }))} className="campo w-28 py-1.5 text-xs" aria-label="Das" />
          <span className="text-slate-500">às</span>
          <input type="time" value={faixa.ate} onChange={(e) => setFaixa((f) => ({ ...f, ate: e.target.value }))} className="campo w-28 py-1.5 text-xs" aria-label="Às" />
          <span className="text-slate-500">de</span>
          <select value={faixa.passo} onChange={(e) => setFaixa((f) => ({ ...f, passo: Number(e.target.value) }))} className="campo w-24 py-1.5 text-xs" aria-label="Intervalo">
            {[20, 30, 40, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} em {m}
              </option>
            ))}
          </select>
          <span className="text-slate-500">min</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {DIAS.map(({ n, nome }) => {
            const marcado = faixa.dias.includes(n)
            return (
              <button
                key={n}
                type="button"
                onClick={() => setFaixa((f) => ({ ...f, dias: marcado ? f.dias.filter((d) => d !== n) : [...f.dias, n] }))}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${marcado ? 'bg-marinho-800 text-white' : 'bg-white text-slate-500 ring-1 ring-marinho-900/10'}`}
              >
                {nome.slice(0, 3)}
              </button>
            )
          })}
          <button type="button" onClick={preencher} disabled={!faixa.dias.length || faixa.ate <= faixa.de} className="botao-claro ml-auto px-3 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Pôr nos dias marcados
          </button>
          <button
            type="button"
            onClick={() => mudar((g) => ({ ...g, horarios: { ...g.horarios, ...Object.fromEntries(faixa.dias.map((n) => [String(n), []])) } }))}
            disabled={!faixa.dias.length}
            className="px-2 py-1.5 text-[11px] font-bold text-red-600 hover:underline disabled:opacity-40"
          >
            Limpar dias marcados
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Ex.: das 8h às 11h de 30 em 30 dá 8h, 8h30, 9h, 9h30, 10h e 10h30 (a última termina às 11h). Riscado = cai num bloqueio semanal.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-marinho-900">
          Tempo reservado por reunião (minutos)
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
