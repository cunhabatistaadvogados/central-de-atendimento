import {
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Columns3,
  FileSignature,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import type { Sessao } from '@/App'
import { ArteDoMenu, MarcaHorizontal, SeloCB } from '@/components/Marca'
import { esperandoEquipe } from '@/lib/atendimento'
import { hojeExtenso, mesmoDia } from '@/lib/formato'
import { ligarModoWhatsApp } from '@/lib/modo-whatsapp'
import { useDados } from '@/lib/store'
import QuemEstaOnline from '@/components/QuemEstaOnline'
import { PAPEIS, useConfigQuemEstaOnline, useQuemEstaOnline } from '@/lib/equipe'
import Agenda from '@/sections/Agenda'
import Clientes from '@/sections/Clientes'
import Contratos from '@/sections/Contratos'
import Conversas from '@/sections/Conversas'
import FichaDoCliente from '@/sections/FichaDoCliente'
import Funil from '@/sections/Funil'
import Preferencias from '@/sections/Preferencias'
import Simulador from '@/sections/Simulador'
import VisaoGeral from '@/sections/VisaoGeral'

export type Aba = 'visao' | 'conversas' | 'funil' | 'clientes' | 'contratos' | 'agenda' | 'robo' | 'ajustes'
type Icone = ComponentType<{ className?: string; strokeWidth?: number }>

const ABAS: { chave: Aba; nome: string; curto: string; icone: Icone }[] = [
  { chave: 'visao', nome: 'Visão geral', curto: 'Visão', icone: ChartNoAxesCombined },
  { chave: 'conversas', nome: 'Conversas', curto: 'Conversas', icone: MessagesSquare },
  { chave: 'funil', nome: 'Funil BPC/LOAS', curto: 'Funil', icone: Columns3 },
  { chave: 'clientes', nome: 'Clientes', curto: 'Clientes', icone: UsersRound },
  { chave: 'contratos', nome: 'Contratos', curto: 'Contratos', icone: FileSignature },
  { chave: 'agenda', nome: 'Agenda', curto: 'Agenda', icone: CalendarDays },
  { chave: 'robo', nome: 'Testar o robô', curto: 'Robô', icone: Bot },
  { chave: 'ajustes', nome: 'Preferências', curto: 'Ajustes', icone: Settings2 },
]

const META: Record<Aba, { olho: string; titulo: string; sub: string }> = {
  visao: { olho: 'Painel do escritório', titulo: 'Visão geral', sub: 'O atendimento BPC/LOAS de ponta a ponta, do primeiro "oi" ao contrato assinado.' },
  conversas: { olho: 'WhatsApp', titulo: 'Conversas', sub: 'O robô qualifica; quando ele passa a bola, a equipe responde daqui.' },
  funil: { olho: 'Jornada do cliente', titulo: 'Funil BPC/LOAS', sub: 'Arraste o cartão para mudar a etapa. O robô avança sozinho até a reunião.' },
  clientes: { olho: 'Base de atendimento', titulo: 'Clientes', sub: 'Quem chegou, o que contou e o que falta para fechar.' },
  contratos: { olho: 'Fechamento', titulo: 'Contratos', sub: 'Gerados a partir da minuta do escritório, já na versão certa para cada caso.' },
  agenda: { olho: 'Tempo do advogado', titulo: 'Agenda', sub: 'Reuniões pedidas pelo robô e confirmadas pela equipe.' },
  robo: { olho: 'Simulador', titulo: 'Testar o robô', sub: 'Converse como se fosse a família e veja exatamente o que o robô responde.' },
  ajustes: { olho: 'Configuração', titulo: 'Preferências', sub: 'Roteiro, honorários, retornos automáticos e integrações.' },
}

export default function Home({ sessao, onSair }: { sessao: Sessao; onSair: () => void }) {
  const { clientes, erro: erroDosDados, carregando, recarregar, demonstracao } = useDados()
  const membro = sessao.membro ?? null
  const [quemEstaOnlineLigado, setQuemEstaOnlineLigado] = useConfigQuemEstaOnline(Boolean(membro))
  const online = useQuemEstaOnline(membro, quemEstaOnlineLigado)
  const [aba, setAba] = useState<Aba>('visao')
  const [fichaAberta, setFichaAberta] = useState<{ id: string; aba?: 'resumo' | 'conversa' | 'contrato' | 'historico' } | null>(null)
  const [conversaFoco, setConversaFoco] = useState<string | null>(null)

  const abrirCliente = useCallback((id: string, abaDaFicha?: 'resumo' | 'conversa' | 'contrato' | 'historico') => setFichaAberta({ id, aba: abaDaFicha }), [])
  const abrirConversa = useCallback((id: string) => {
    setFichaAberta(null)
    setConversaFoco(id)
    setAba('conversas')
  }, [])

  const barraCelular = useRef<HTMLDivElement>(null)
  const [barraNoFim, setBarraNoFim] = useState(false)
  // Item ativo sempre a vista na barra do celular, mesmo depois de rolar.
  useEffect(() => {
    const botao = barraCelular.current?.querySelector<HTMLElement>(`[data-aba="${aba}"]`)
    botao?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [aba])

  const contagens = useMemo(() => {
    const hoje = new Date()
    return {
      conversas: clientes.filter(esperandoEquipe).length,
      contratos: clientes.filter((c) => c.contrato && c.contrato.status !== 'assinado' && c.contrato.status !== 'enviado' && c.etapa !== 'perdido').length,
      agenda: clientes.filter((c) => c.reuniao?.data && mesmoDia(new Date(c.reuniao.data), hoje)).length,
    }
  }, [clientes])

  const meta = META[aba]
  const irPara = (a: Aba) => {
    setAba(a)
    // A ficha abre colada no menu: clicar no menu troca de tela e fecha a ficha.
    setFichaAberta(null)
    window.scrollTo({ top: 0 })
  }

  const selo = (chave: Aba, ativo: boolean) => {
    const n = chave === 'conversas' ? contagens.conversas : chave === 'contratos' ? contagens.contratos : chave === 'agenda' ? contagens.agenda : 0
    if (!n) return ativo ? <ChevronRight className="h-4 w-4 text-ouro-500" /> : null
    const cor = chave === 'conversas' ? 'bg-ouro-500 text-marinho-950' : chave === 'agenda' ? 'bg-orange-500 text-white' : 'bg-white/90 text-marinho-900'
    return <span className={`min-w-6 rounded-full px-1.5 py-1 text-center text-[10px] font-extrabold ${ativo ? 'bg-marinho-800 text-white' : cor}`}>{n}</span>
  }

  return (
    <div className="min-h-dvh bg-papel">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[286px] flex-col overflow-hidden bg-marinho-900 text-white lg:flex">
        <ArteDoMenu />
        <div className="grade-suave absolute inset-0 opacity-40" />
        <div className="absolute -right-24 top-24 h-64 w-64 rounded-full bg-ouro-500/10 blur-3xl" />
        <div className="relative flex h-full flex-col">
          <div className="px-6 pb-6 pt-8 [@media(max-height:820px)]:pb-4 [@media(max-height:820px)]:pt-5">
            <MarcaHorizontal />
            {sessao.demonstracao && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-ouro-500/30 bg-ouro-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ouro-300">
                <Sparkles className="h-3 w-3" /> Modo demonstração
              </p>
            )}
          </div>
          <div className="mx-6 h-px bg-gradient-to-r from-ouro-500/40 via-white/10 to-transparent" />
          <nav aria-label="Navegação principal" className="rolagem-fina mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto px-4 [@media(max-height:820px)]:mt-3 [@media(max-height:820px)]:space-y-0.5">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Menu</p>
            {ABAS.map((item) => {
              const ativo = aba === item.chave
              const Icone = item.icone
              return (
                <button
                  key={item.chave}
                  type="button"
                  onClick={() => irPara(item.chave)}
                  aria-current={ativo ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all [@media(max-height:820px)]:py-2 ${
                    ativo ? 'bg-white text-marinho-900 shadow-[0_12px_28px_rgba(0,0,0,.2)]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors [@media(max-height:820px)]:h-8 [@media(max-height:820px)]:w-8 ${
                      ativo ? 'bg-ouro-100 text-ouro-700' : 'bg-white/[0.055] text-white/60 group-hover:text-white'
                    }`}
                  >
                    <Icone className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-left">{item.nome}</span>
                  {selo(item.chave, ativo)}
                </button>
              )
            })}
          </nav>
          {membro && quemEstaOnlineLigado ? (
            <div className="mx-4 mb-4 [@media(max-height:760px)]:hidden">
              <QuemEstaOnline online={online} />
            </div>
          ) : (
          <div className="relative mx-4 mb-4 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.05] p-4 [@media(max-height:900px)]:hidden">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-ouro-500/15 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ouro-500 text-marinho-950">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-white/90">Sigilo e LGPD</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/40">Só a equipe vê os dados dos clientes</p>
              </div>
            </div>
          </div>
          )}
          <div className="flex items-center gap-3 border-t border-white/10 px-6 py-5">
            <SeloCB className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white/90">{sessao.nome}</p>
              <p className="mt-0.5 truncate text-[10px] text-white/40">
                {membro ? `${PAPEIS[membro.papel]}${membro.papel === 'desenvolvedor' ? ' · invisível' : ''}` : sessao.demonstracao ? 'Acesso de demonstração' : sessao.email}
              </p>
            </div>
            <button
              type="button"
              onClick={onSair}
              aria-label="Sair do sistema"
              title="Sair do sistema"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/45 transition hover:bg-white/[0.1] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-marinho-900/95 px-4 py-3 text-white backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SeloCB className="h-9 w-9" />
            <div className="leading-none">
              <p className="titulo-serif text-lg">
                Cunha Batista <span className="text-ouro-400">&amp;</span>
              </p>
              {/* No celular o menu lateral some: o selo de demonstracao vem para
                  o cabecalho, senao ficticio passa por real. */}
              {sessao.demonstracao ? (
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-ouro-300">Modo demonstração</p>
              ) : (
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Central de atendimento</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {membro && quemEstaOnlineLigado && <QuemEstaOnline online={online} compacto />}
            {/* Modo WhatsApp (igual ao do Marcello): leva as Conversas ja em
                tela cheia, lista e conversa como no app. "Chat normal", la
                dentro, volta ao visual de sempre. */}
            <button
              type="button"
              onClick={() => {
                ligarModoWhatsApp()
                irPara('conversas')
              }}
              aria-label="Abrir as conversas no modo WhatsApp"
              title="Modo WhatsApp"
              className="pulso-whatsapp flex h-10 w-10 items-center justify-center rounded-xl bg-[#1daa61] text-white"
            >
              <MessageCircle className="h-[19px] w-[19px]" />
            </button>
            <button type="button" onClick={onSair} aria-label="Sair" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white/60">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative min-h-dvh pb-28 lg:ml-[286px] lg:pb-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
          <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-ouro-300/15 blur-3xl" />
          <div className="absolute left-1/3 -top-48 h-80 w-80 rounded-full bg-marinho-100/60 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-[1460px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-12">
          <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="rotulo mb-2 flex items-center gap-2 text-ouro-600">
                <span className="h-px w-6 bg-ouro-500" />
                {meta.olho}
              </div>
              <h1 className="titulo-serif text-[34px] leading-none text-marinho-900 sm:text-[42px]">{meta.titulo}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">{meta.sub}</p>
            </div>
            <p className="text-xs font-semibold text-slate-400">{hojeExtenso()}</p>
          </div>

          {erroDosDados && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">{erroDosDados}</span>
              <button type="button" onClick={recarregar} className="botao-claro ml-auto py-1.5 text-xs">
                Tentar de novo
              </button>
            </div>
          )}
          {!demonstracao && carregando && <p className="mb-5 text-sm text-slate-400">Carregando os atendimentos do banco do escritório...</p>}
          <div key={aba} className="entrar">
            {aba === 'visao' && <VisaoGeral abrirCliente={abrirCliente} irPara={irPara} />}
            {aba === 'conversas' && <Conversas foco={conversaFoco} limparFoco={() => setConversaFoco(null)} abrirCliente={abrirCliente} autor={sessao.nome} />}
            {aba === 'funil' && <Funil abrirCliente={abrirCliente} autor={sessao.nome} />}
            {aba === 'clientes' && <Clientes abrirCliente={abrirCliente} />}
            {aba === 'contratos' && <Contratos abrirCliente={abrirCliente} />}
            {aba === 'agenda' && <Agenda abrirCliente={abrirCliente} />}
            {aba === 'robo' && <Simulador />}
            {aba === 'ajustes' && <Preferencias membro={membro} quemEstaOnline={quemEstaOnlineLigado} aoMudarQuemEstaOnline={setQuemEstaOnlineLigado} />}
          </div>
        </div>
      </main>

      {/* Barra do celular flutuante, igual a do sistema do Marcello (pedido do
          Edu em 19/10/2026): todos os itens sempre a vista, sem menu "Mais",
          presa no rodape enquanto a pagina rola por baixo. */}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-[22px] border border-marinho-900/10 bg-white/95 shadow-[0_18px_55px_rgba(11,31,56,.22)] backdrop-blur-xl lg:hidden"
        aria-label="Navegação móvel"
      >
        {/* Com 8 itens a barra espremia os nomes ("Conve...", print do Edu de
            19/10/2026). Agora cada botao tem largura fixa e a faixa rola para
            o lado; a sombra na borda mostra que tem mais. */}
        <div
          ref={barraCelular}
          onScroll={(e) => {
            const f = e.currentTarget
            setBarraNoFim(f.scrollLeft + f.clientWidth >= f.scrollWidth - 4)
          }}
          className="sem-barra flex snap-x gap-0.5 overflow-x-auto overscroll-x-contain px-1.5 py-1.5"
          style={{ paddingBottom: 'max(.375rem, env(safe-area-inset-bottom))' }}
        >
          {ABAS.map((item) => {
            const Icone = item.icone
            const ativo = aba === item.chave
            const n = item.chave === 'conversas' ? contagens.conversas : item.chave === 'contratos' ? contagens.contratos : item.chave === 'agenda' ? contagens.agenda : 0
            return (
              <button
                key={item.chave}
                type="button"
                data-aba={item.chave}
                onClick={() => irPara(item.chave)}
                aria-current={ativo ? 'page' : undefined}
                aria-label={item.nome}
                className={`relative flex w-[66px] shrink-0 snap-start flex-col items-center gap-1 rounded-[17px] py-2.5 text-[10px] font-bold transition-colors ${
                  ativo ? 'bg-marinho-800 text-white' : 'text-slate-500'
                }`}
              >
                <Icone className={`h-5 w-5 ${ativo ? 'text-ouro-400' : ''}`} strokeWidth={2} />
                <span className="whitespace-nowrap">{item.curto}</span>
                {n > 0 && !ativo && (
                  <span className={`absolute right-3 top-1.5 h-2 w-2 rounded-full ring-2 ring-white ${item.chave === 'agenda' ? 'bg-orange-500' : 'bg-ouro-500'}`} />
                )}
              </button>
            )
          })}
        </div>
        {!barraNoFim && <span className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/95 to-transparent" />}
      </nav>

      {fichaAberta && (
        <FichaDoCliente
          id={fichaAberta.id}
          abaInicial={fichaAberta.aba}
          onFechar={() => setFichaAberta(null)}
          abrirConversa={abrirConversa}
          autor={sessao.nome}
        />
      )}
    </div>
  )
}
