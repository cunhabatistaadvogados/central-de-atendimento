import { emHorarioComercial, ehIdoso } from '@motor/robo'
import { AlarmClock, ArrowUpRight, CalendarCheck2, CheckCircle2, FileSignature, MessageCircleWarning, TrendingUp, UsersRound } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Avatar, ChipEtapa } from '@/components/ui'
import { desde, esperandoEquipe, nomeCurto } from '@/lib/atendimento'
import { ETAPAS, LINHA_DE_BASE, ORIGENS } from '@/lib/escritorio'
import { haQuanto, mesmoDia, pct } from '@/lib/formato'
import { useDados } from '@/lib/store'
import type { Aba } from '@/pages/Home'

type Icone = ComponentType<{ className?: string }>

function Indicador({ icone: I, rotulo, valor, detalhe, destaque = false }: { icone: Icone; rotulo: string; valor: ReactNode; detalhe: string; destaque?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] border p-4 sm:p-5 ${destaque ? 'border-marinho-800 bg-marinho-800 text-white shadow-[0_18px_40px_rgba(15,42,74,.28)]' : 'cartao'}`}>
      {destaque && <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-ouro-500/20 blur-2xl" />}
      <div className="relative flex items-start justify-between">
        <p className={`rotulo ${destaque ? 'text-ouro-300' : 'text-slate-400'}`}>{rotulo}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${destaque ? 'bg-white/10 text-ouro-300' : 'bg-ouro-50 text-ouro-600'}`}>
          <I className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className={`titulo-serif relative mt-3 text-[36px] leading-none sm:text-[46px] ${destaque ? 'text-white' : 'text-marinho-900'}`}>{valor}</p>
      <p className={`relative mt-2 text-xs ${destaque ? 'text-white/60' : 'text-slate-500'}`}>{detalhe}</p>
    </div>
  )
}

export default function VisaoGeral({ abrirCliente, irPara }: { abrirCliente: (id: string) => void; irPara: (a: Aba) => void }) {
  const { clientes, demonstracao } = useDados()
  const total = clientes.length || 1
  const ativos = clientes.filter((c) => c.etapa !== 'perdido')
  const qualificados = clientes.filter((c) => ['qualificado', 'reuniao', 'contrato', 'contratado'].includes(c.etapa))
  const reunioes = clientes.filter((c) => ['reuniao', 'contrato', 'contratado'].includes(c.etapa))
  const assinados = clientes.filter((c) => c.contrato?.status === 'assinado')
  const esperando = clientes.filter(esperandoEquipe).sort((a, b) => (desde(a) ?? '').localeCompare(desde(b) ?? ''))
  const paraRevisar = clientes.filter((c) => c.contrato && ['rascunho', 'pronto'].includes(c.contrato.status) && c.etapa !== 'perdido')
  const agora = new Date()
  const pendenciasVencidas = clientes.flatMap((c) => c.pendencias.filter((p) => !p.resolvida && new Date(p.retornoEm) <= agora).map((p) => ({ c, p })))
  const hoje = clientes.filter((c) => c.reuniao?.data && mesmoDia(new Date(c.reuniao.data), agora))

  const sumiram = clientes.filter((c) => c.robo.mensagensDoCliente <= 1 && Date.now() - new Date(c.criadoEm).getTime() > 23 * 3600000).length
  const antigos = clientes.filter((c) => Date.now() - new Date(c.criadoEm).getTime() > 23 * 3600000).length || 1
  const foraDoHorario = clientes.filter((c) => !emHorarioComercial(new Date(c.criadoEm))).length

  const porEtapa = ETAPAS.map((e) => ({ ...e, n: clientes.filter((c) => c.etapa === e.chave).length }))
  const maiorEtapa = Math.max(1, ...porEtapa.map((e) => e.n))
  const origens = Object.entries(ORIGENS).map(([k, nome]) => ({ nome, n: clientes.filter((c) => c.origem === k).length }))
  const perfis = [
    { nome: 'Autismo (TEA)', n: clientes.filter((c) => c.robo.ficha.diagnostico === 'Autismo (TEA)').length },
    { nome: 'Outras deficiências', n: clientes.filter((c) => c.robo.ficha.diagnostico && c.robo.ficha.diagnostico !== 'Autismo (TEA)' && !ehIdoso(c.robo.ficha)).length },
    { nome: 'Idoso 65+', n: clientes.filter((c) => ehIdoso(c.robo.ficha)).length },
    { nome: 'Ainda não contou', n: clientes.filter((c) => !c.robo.ficha.diagnostico && !ehIdoso(c.robo.ficha)).length },
  ]

  const comparacoes = [
    { nome: 'Sumiram depois da 1ª resposta', antes: LINHA_DE_BASE.sumiramNaPrimeira, agora: sumiram / antigos, melhorSeMenor: true },
    { nome: 'Chegaram a qualificado', antes: LINHA_DE_BASE.qualificados, agora: qualificados.length / total, melhorSeMenor: false },
    { nome: 'Contrato oferecido', antes: LINHA_DE_BASE.falamosContrato, agora: reunioes.length / total, melhorSeMenor: false },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Indicador icone={UsersRound} rotulo="Contatos" valor={clientes.length} detalhe={`${ativos.length} em andamento`} />
        <Indicador icone={TrendingUp} rotulo="Qualificados" valor={qualificados.length} detalhe={`${pct(qualificados.length / total)} dos contatos (antes: 17%)`} />
        <Indicador icone={CalendarCheck2} rotulo="Reuniões" valor={reunioes.length} detalhe={`${hoje.length} hoje com o Dr. André`} />
        <Indicador icone={FileSignature} rotulo="Contratos assinados" valor={assinados.length} detalhe={`${paraRevisar.length} para revisar · ${clientes.filter((c) => c.contrato?.status === 'enviado').length} aguardando assinatura`} destaque />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <section className="cartao p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="rotulo text-ouro-600">Agora</p>
              <h2 className="titulo-serif text-2xl">Pede atenção</h2>
            </div>
            <span className="rounded-full bg-marinho-50 px-3 py-1 text-xs font-bold text-marinho-700">{esperando.length + paraRevisar.length + pendenciasVencidas.length} itens</span>
          </div>
          {esperando.length + paraRevisar.length + pendenciasVencidas.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Nada esperando. Tudo em dia.</p>
          ) : (
            <ul className="divide-y divide-marinho-900/[0.06]">
              {esperando.map((c) => {
                const longa = Date.now() - new Date(desde(c) ?? c.atualizadoEm).getTime() > 30 * 60000
                return (
                  <li key={`e${c.id}`}>
                    <button type="button" onClick={() => abrirCliente(c.id)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-ouro-50/60">
                      <Avatar nome={c.nome || c.telefone} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-bold">
                          {nomeCurto(c)} <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${longa ? 'bg-red-50 text-red-600' : 'bg-ouro-100 text-ouro-700'}`}>esperando a equipe</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{c.robo.motivoPausa}</span>
                      </span>
                      <span className={`text-[11px] font-bold ${longa ? 'text-red-500' : 'text-slate-400'}`}>{haQuanto(desde(c))}</span>
                    </button>
                  </li>
                )
              })}
              {paraRevisar.map((c) => (
                <li key={`r${c.id}`}>
                  <button type="button" onClick={() => abrirCliente(c.id)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-ouro-50/60">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marinho-800 text-ouro-300">
                      <FileSignature className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Contrato de {nomeCurto(c)} {c.contrato?.okAdvogado ? 'pronto para enviar' : 'aguardando o OK do advogado'}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{c.contrato?.comParteFixa ? 'Versão com valor fixo (sem laudo)' : 'Versão padrão (com laudo)'}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300" />
                  </button>
                </li>
              ))}
              {pendenciasVencidas.map(({ c, p }) => (
                <li key={`p${p.id}`}>
                  <button type="button" onClick={() => abrirCliente(c.id)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-ouro-50/60">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                      <AlarmClock className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Retorno: {p.texto}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{nomeCurto(c)} · vencido {haQuanto(p.retornoEm)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cartao p-5 sm:p-6">
          <p className="rotulo text-ouro-600">Funil</p>
          <h2 className="titulo-serif text-2xl">Onde cada família está</h2>
          <div className="mt-5 space-y-3">
            {porEtapa.map((e) => (
              <button key={e.chave} type="button" onClick={() => irPara('funil')} className="group block w-full text-left">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-bold text-marinho-800">{e.nome}</span>
                  <span className="font-extrabold text-marinho-900">{e.n}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${e.ponto} transition-all group-hover:opacity-80`} style={{ width: `${(e.n / maiorEtapa) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-[22px] bg-marinho-900 p-6 text-white lg:col-span-1">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-ouro-500/15 blur-3xl" />
          <p className="rotulo relative text-ouro-300">Antes × agora</p>
          <h2 className="titulo-serif relative text-2xl">O que o robô novo muda</h2>
          <p className="relative mt-1 text-xs text-white/45">Antes: diagnóstico de 1.641 conversas (fev a out/2026).</p>
          <div className="relative mt-5 space-y-4">
            {comparacoes.map((x) => {
              const melhorou = x.melhorSeMenor ? x.agora < x.antes : x.agora > x.antes
              return (
                <div key={x.nome}>
                  <p className="text-xs font-semibold text-white/70">{x.nome}</p>
                  <div className="mt-1.5 flex items-baseline gap-3">
                    <span className="text-sm text-white/35 line-through">{pct(x.antes)}</span>
                    <span className={`titulo-serif text-3xl ${melhorou ? 'text-ouro-300' : 'text-white'}`}>{pct(x.agora)}</span>
                    {melhorou && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="relative mt-5 text-[10px] leading-relaxed text-white/35">{demonstracao ? 'Na demonstração os números saem das conversas fictícias.' : 'Números das conversas reais que chegaram pelo WhatsApp.'}</p>
        </section>

        <section className="cartao p-6">
          <p className="rotulo text-ouro-600">Perfil</p>
          <h2 className="titulo-serif text-2xl">Quem procura</h2>
          <div className="mt-5 space-y-3">
            {perfis.map((p) => (
              <div key={p.nome} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-xs font-semibold text-marinho-800">{p.nome}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-ouro-500" style={{ width: `${(p.n / total) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-extrabold">{p.n}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-ouro-50 p-3">
              <p className="titulo-serif text-3xl text-marinho-900">{clientes.filter((c) => c.robo.ficha.laudo === 'recente').length}</p>
              <p className="text-[11px] font-semibold text-slate-500">com laudo recente</p>
            </div>
            <div className="rounded-2xl bg-marinho-50 p-3">
              <p className="titulo-serif text-3xl text-marinho-900">{clientes.filter((c) => c.robo.ficha.laudo === 'sem' || c.robo.ficha.laudo === 'antigo').length}</p>
              <p className="text-[11px] font-semibold text-slate-500">sem laudo (fase médica)</p>
            </div>
          </div>
        </section>

        <section className="cartao p-6">
          <p className="rotulo text-ouro-600">Entrada</p>
          <h2 className="titulo-serif text-2xl">De onde vêm</h2>
          <div className="mt-5 space-y-3">
            {origens.map((o) => (
              <div key={o.nome} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold text-marinho-800">{o.nome}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-marinho-700" style={{ width: `${(o.n / total) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-extrabold">{o.n}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-ouro-200 bg-ouro-50/70 p-3">
            <MessageCircleWarning className="h-5 w-5 shrink-0 text-ouro-600" />
            <p className="text-xs text-marinho-800">
              <b>{pct(foraDoHorario / total)}</b> chegaram fora do horário comercial. O robô qualificou e marcou sozinho, e a equipe confirma cedo.
            </p>
          </div>
        </section>
      </div>

      <section className="cartao p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="titulo-serif text-2xl">Últimas movimentações</h2>
          <button type="button" onClick={() => irPara('clientes')} className="text-xs font-bold text-ouro-700 hover:underline">
            Ver todos os clientes
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {clientes.slice(0, 6).map((c) => (
            <button key={c.id} type="button" onClick={() => abrirCliente(c.id)} className="flex items-center gap-3 rounded-2xl border border-transparent p-2.5 text-left transition hover:border-ouro-200 hover:bg-ouro-50/50">
              <Avatar nome={c.nome || c.telefone} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{c.nome || c.telefone}</span>
                <span className="block truncate text-xs text-slate-500">{c.eventos.at(-1)?.texto}</span>
              </span>
              <ChipEtapa etapa={c.etapa} compacto />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
