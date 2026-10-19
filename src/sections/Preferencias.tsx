import { FOLLOWUP_PENDENCIA, FOLLOWUP_SEM_RESPOSTA, SALARIO_MINIMO, VERSAO_DO_ROTEIRO, dinheiro } from '@motor/robo'
import { Building2, CheckCircle2, CircleDashed, Clock3, Database, FileSignature, MessageCircle, RotateCcw, Scale, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { SeloCB } from '@/components/Marca'
import { Modal } from '@/components/ui'
import { ESCRITORIO, HONORARIOS } from '@/lib/escritorio'
import { useDados } from '@/lib/store'
import { supabaseConfigurado } from '@/lib/supabase'

const REGRAS = [
  'Fala simples: frases curtas, no máximo 2 linhas e 1 pergunta por mensagem.',
  'Nunca diz que a pessoa "tem direito" ou "vai ganhar". Diz que o caso "se qualifica para o atendimento".',
  'Honorários só quando perguntam, pela tabela, e quem pergunta preço vai para a equipe.',
  'Parcelamento só se o cliente pedir.',
  'Nunca pede CPF, RG ou foto de documento: isso é da equipe.',
  'Não se apresenta como robô; se perguntarem, não nega e diz que uma pessoa assume já já.',
  'Qualificou, fecha: oferece dois horários próximos, nunca "quando puder".',
  'Não entendeu duas vezes: passa para a equipe. Conversa nunca fica sem dono.',
]

function Status({ ok, texto }: { ok: boolean | 'parcial'; texto: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${ok === true ? 'bg-emerald-50 text-emerald-700' : ok === 'parcial' ? 'bg-ouro-100 text-ouro-700' : 'bg-slate-100 text-slate-500'}`}>
      {ok === true ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {texto}
    </span>
  )
}

export default function Preferencias() {
  const { recomecarDemonstracao } = useDados()
  const [confirmando, setConfirmando] = useState(false)

  const integracoes = [
    { icone: Database, nome: 'Banco de dados (Supabase)', detalhe: 'Projeto "LOAS" da conta cunhabatistaadvogados', ok: supabaseConfigurado ? ('parcial' as const) : false, status: supabaseConfigurado ? 'Conectado · tabelas a aplicar' : 'Modo demonstração' },
    { icone: MessageCircle, nome: 'WhatsApp Business (API oficial da Meta)', detalhe: `Número do robô: ${ESCRITORIO.whatsappDoRobo}`, ok: false, status: 'Aguardando número e app da Meta' },
    { icone: FileSignature, nome: 'D4Sign (assinatura digital)', detalhe: 'Envio automático do contrato e aviso quando assinar', ok: false, status: 'Aguardando plano com API' },
    { icone: Clock3, nome: 'Retornos automáticos', detalhe: 'Roda de hora em hora no servidor', ok: false, status: 'Liga junto com o WhatsApp' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="relative overflow-hidden rounded-[22px] bg-marinho-900 p-6 text-white">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-ouro-500/15 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <SeloCB className="h-16 w-16 shrink-0" />
            <div>
              <p className="titulo-serif text-2xl">{ESCRITORIO.nome}</p>
              <p className="mt-1 text-xs text-white/50">
                CNPJ {ESCRITORIO.cnpj} · {ESCRITORIO.oab}
              </p>
            </div>
          </div>
          <dl className="relative mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ['Endereço', ESCRITORIO.endereco],
              ['Telefones', ESCRITORIO.telefones.join(' · ')],
              ['WhatsApp do robô', ESCRITORIO.whatsappDoRobo],
              ['Site', ESCRITORIO.site.replace('https://', '')],
              ['Instagram', ESCRITORIO.instagram],
              ['Horário da equipe', 'Dias úteis, 9h às 18h'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-ouro-300">{k}</dt>
                <dd className="mt-1 font-semibold text-white/90">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="relative mt-4 flex flex-wrap gap-2">
            {ESCRITORIO.advogados.map((a) => (
              <span key={a.nome} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/75">
                {a.nome} <span className="text-ouro-300">· {a.papel}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="cartao p-6">
          <p className="rotulo flex items-center gap-2 text-ouro-600">
            <Scale className="h-3.5 w-3.5" /> Honorários (contrato padrão)
          </p>
          <div className="mt-4 space-y-3">
            {HONORARIOS.map((h) => (
              <div key={h.titulo} className="rounded-2xl border border-marinho-900/[0.07] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold">{h.titulo}</p>
                  <span className="rounded-full bg-ouro-50 px-2 py-0.5 text-[10px] font-bold text-ouro-700">{h.versao}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{h.texto}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Salário mínimo usado nas contas: {dinheiro(SALARIO_MINIMO)}. Conferir todo janeiro.</p>
        </section>
      </div>

      <section className="cartao p-6">
        <p className="rotulo text-ouro-600">Integrações</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {integracoes.map((i) => (
            <div key={i.nome} className="flex items-start gap-3 rounded-2xl border border-marinho-900/[0.07] p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marinho-50 text-marinho-700">
                <i.icone className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{i.nome}</p>
                <p className="text-xs text-slate-500">{i.detalhe}</p>
                <div className="mt-2">
                  <Status ok={i.ok} texto={i.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="cartao p-6">
          <p className="rotulo flex items-center gap-2 text-ouro-600">
            <ShieldCheck className="h-3.5 w-3.5" /> Regras fixas do robô
          </p>
          <ul className="mt-4 space-y-2.5">
            {REGRAS.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm text-marinho-800">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ouro-500" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-slate-400">Roteiro {VERSAO_DO_ROTEIRO}. Testado com 18 conversas tiradas do diagnóstico das 1.641 conversas.</p>
        </section>
        <section className="cartao p-6">
          <p className="rotulo flex items-center gap-2 text-ouro-600">
            <Clock3 className="h-3.5 w-3.5" /> Retornos automáticos
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-ouro-50/70 p-4">
              <p className="text-xs font-extrabold text-marinho-900">Sem resposta há 23 horas</p>
              <p className="mt-1 text-sm text-slate-600">{FOLLOWUP_SEM_RESPOSTA}</p>
              <p className="mt-2 text-[10px] text-slate-400">23h para cair dentro da janela de 24h do WhatsApp.</p>
            </div>
            <div className="rounded-2xl bg-ouro-50/70 p-4">
              <p className="text-xs font-extrabold text-marinho-900">Pendência vencida (CadÚnico, laudo, decisão em família, assinatura)</p>
              <p className="mt-1 text-sm text-slate-600">{FOLLOWUP_PENDENCIA}</p>
              <p className="mt-2 text-[10px] text-slate-400">Fora da janela de 24h: precisa de modelo aprovado pela Meta.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="cartao flex flex-wrap items-center gap-4 p-6">
        <Building2 className="h-6 w-6 text-ouro-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Dados de demonstração</p>
          <p className="text-xs text-slate-500">Tudo que está na tela é fictício e fica só neste navegador. Recomeçar volta as 14 famílias de exemplo ao estado inicial.</p>
        </div>
        <button type="button" onClick={() => setConfirmando(true)} className="botao-claro">
          <RotateCcw className="h-4 w-4" /> Recomeçar demonstração
        </button>
      </section>

      <Modal aberto={confirmando} onFechar={() => setConfirmando(false)} titulo="Recomeçar a demonstração?">
        <p className="text-sm text-slate-600">As conversas e contratos de teste que você mexeu voltam ao início. Não afeta nenhum dado real.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmando(false)} className="botao-claro">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              recomecarDemonstracao()
              setConfirmando(false)
            }}
            className="botao-primario"
          >
            Recomeçar
          </button>
        </div>
      </Modal>
    </div>
  )
}
