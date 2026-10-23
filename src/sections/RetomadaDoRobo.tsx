import { RETOMADA_PADRAO, TEXTO_MODELO_RETOMADA, mensagemDeRetomada, type ConfigDaRetomada } from '@motor/robo'
import { CircleHelp, RotateCw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Interruptor } from '@/components/ui'
import { podeAdministrar, type Membro } from '@/lib/equipe'
import { supabase } from '@/lib/supabase'

const CHAVE_DEMO = 'cbaa-retomada-demo'
const EXEMPLO = 'E quanto entra de dinheiro na casa por mês, somando todo mundo, mais ou menos?'

/** "18:30" -> "18h30"; "08:00" -> "8h". */
function hhmm(h: string): string {
  const [a, b] = h.split(':')
  return `${Number(a)}h${b && b !== '00' ? b : ''}`
}

/**
 * Retomada de quem parou de responder (Lucas e Edu, 22/10/2026). Fica na
 * tabela configuracoes (chave "retomada"); so administrador grava (RLS).
 */
export default function RetomadaDoRobo({ membro, demonstracao }: { membro: Membro | null; demonstracao: boolean }) {
  const [cfg, setCfg] = useState<ConfigDaRetomada | null>(null)
  const [salva, setSalva] = useState('')
  const [aviso, setAviso] = useState('')
  const [ajuda, setAjuda] = useState(false)
  const pode = demonstracao || podeAdministrar(membro)

  useEffect(() => {
    const iniciar = (v: Partial<ConfigDaRetomada> | null) => {
      const c = { ...RETOMADA_PADRAO, ...(v ?? {}) }
      setCfg(c)
      setSalva(JSON.stringify(c))
    }
    if (demonstracao || !supabase) {
      try {
        iniciar(JSON.parse(localStorage.getItem(CHAVE_DEMO) ?? 'null'))
      } catch {
        iniciar(null)
      }
      return
    }
    supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'retomada')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setAviso(`Não consegui ler a retomada: ${error.message}`)
        iniciar((data?.valor as Partial<ConfigDaRetomada> | null) ?? null)
      })
  }, [demonstracao])

  if (!cfg) return <p className="text-xs text-slate-400">Carregando...</p>

  const mudou = JSON.stringify(cfg) !== salva
  const mudar = (campos: Partial<ConfigDaRetomada>) => setCfg((c) => (c ? { ...c, ...campos } : c))
  const horarios = Array.from({ length: cfg.tentativas }, (_, i) => cfg.horarios[i] ?? cfg.horarios[i % Math.max(1, cfg.horarios.length)] ?? '08:00')

  const salvar = async () => {
    setAviso('')
    const valor = { ...cfg, horarios }
    try {
      if (demonstracao || !supabase) localStorage.setItem(CHAVE_DEMO, JSON.stringify(valor))
      else {
        const { error } = await supabase.from('configuracoes').update({ valor, atualizado_em: new Date().toISOString(), atualizado_por: membro?.user_id }).eq('chave', 'retomada')
        if (error) throw new Error(error.message)
      }
      setCfg(valor)
      setSalva(JSON.stringify(valor))
      setAviso('Salvo. Vale a partir da próxima rodada (a cada 15 minutos).')
    } catch (e) {
      setAviso(`Não salvou: ${(e as Error).message}`)
    }
  }

  return (
    <div className="rounded-2xl bg-ouro-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-marinho-900">
            <RotateCw className="h-3.5 w-3.5 text-ouro-600" /> Quem parou de responder
            <button type="button" onClick={() => setAjuda((v) => !v)} aria-label="Como funciona a retomada?" aria-expanded={ajuda} className="text-slate-400 hover:text-ouro-600">
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {cfg.ligado ? `Até ${cfg.tentativas} tentativas, ${cfg.intervaloDias === 1 ? 'uma por dia' : `a cada ${cfg.intervaloDias} dias`}, nos horários abaixo. Domingo não.` : 'Desligado: o robô não chama de novo quem parou.'}
          </p>
        </div>
        <Interruptor ligado={cfg.ligado} onChange={(v) => pode && mudar({ ligado: v })} rotulo="Retomar quem parou de responder" />
      </div>
      {ajuda && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] leading-snug text-marinho-800">
          Vale para quem está conversando com o robô e parou de responder (o robô fez a última pergunta e ninguém da equipe assumiu). A mensagem repete a pergunta em que a família parou, então ela só responde e o atendimento segue de onde estava. Respondeu, a contagem zera. Equipe escreveu na conversa, para. Dentro de 24h da última mensagem da família vai o texto livre; depois disso só o modelo aprovado pela Meta.
        </p>
      )}

      <fieldset disabled={!pode} className="mt-3 space-y-3 disabled:opacity-60">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-marinho-900">
            Tentativas
            <input type="number" min={1} max={8} value={cfg.tentativas} onChange={(e) => mudar({ tentativas: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })} className="campo mt-1 py-1.5 text-xs" />
          </label>
          <label className="text-[11px] font-bold text-marinho-900">
            Intervalo entre tentativas (dias)
            <input type="number" min={1} max={7} value={cfg.intervaloDias} onChange={(e) => mudar({ intervaloDias: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })} className="campo mt-1 py-1.5 text-xs" />
          </label>
        </div>
        <div>
          <p className="text-[11px] font-bold text-marinho-900">Horário de cada tentativa</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {horarios.map((h, i) => (
              <label key={i} className="flex items-center gap-1.5 rounded-xl bg-white px-2 py-1 text-[11px] text-slate-500">
                {i + 1}ª
                <input type="time" value={h} onChange={(e) => mudar({ horarios: horarios.map((x, j) => (j === i ? e.target.value || x : x)) })} className="w-24 bg-transparent font-bold text-marinho-900 outline-none" aria-label={`Horário da tentativa ${i + 1}`} />
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-marinho-900">
            Esperar antes da 1ª (horas sem resposta)
            <input type="number" min={1} max={72} value={cfg.esperaMinHoras} onChange={(e) => mudar({ esperaMinHoras: Math.max(1, Number(e.target.value) || 1) })} className="campo mt-1 py-1.5 text-xs" />
          </label>
          <label className="text-[11px] font-bold text-marinho-900">
            Só quem parou há até (dias)
            <input type="number" min={1} max={60} value={cfg.ateDias} onChange={(e) => mudar({ ateDias: Math.max(1, Number(e.target.value) || 1) })} className="campo mt-1 py-1.5 text-xs" />
          </label>
        </div>
      </fieldset>

      <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
        <p className="font-bold text-marinho-900">Como chega para a família (exemplo, parou na pergunta da renda):</p>
        <p className="rounded-lg bg-white px-2.5 py-1.5">
          <span className="font-bold text-ouro-700">1ª, {hhmm(horarios[0])}:</span> {mensagemDeRetomada(1, cfg.tentativas, 'Ana', EXEMPLO)}
        </p>
        {horarios.length > 1 && (
          <p className="rounded-lg bg-white px-2.5 py-1.5">
            <span className="font-bold text-ouro-700">
              {horarios.length > 2 ? `2ª a ${horarios.length}ª` : '2ª'}, {horarios.slice(1).map(hhmm).join(', ')}:
            </span>{' '}
            {TEXTO_MODELO_RETOMADA.replace('{{1}}', 'Ana').replace('{{2}}', EXEMPLO)}
          </p>
        )}
        <p className="text-[10px] text-slate-400">Da 2ª em diante quase sempre já passou de 24h: sai o modelo aprovado pela Meta "retomar_atendimento".</p>
      </div>

      {pode ? (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={salvar} disabled={!mudou} className="botao-primario px-3 py-1.5 text-xs">
            <Save className="h-3.5 w-3.5" /> Salvar retomada
          </button>
          {aviso && <span className="text-[11px] font-bold text-marinho-800">{aviso}</span>}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500">Só administrador muda a retomada.</p>
      )}
    </div>
  )
}
