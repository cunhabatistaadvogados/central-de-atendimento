import { AlertCircle, ArrowLeft, Bot, Check, CheckCheck, ChevronDown, Hand, List as ListaIcone, MessageSquareText, MoreVertical, PlayCircle, Search, Send, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BotaoAnexar, BotaoResponder, Citacao, FaixaDoEnvio, MidiaDaMensagem, podeCitar, previaDaMensagem, textoSemMidia, useArrastarParaResponder } from '@/components/Midia'
import { Avatar } from '@/components/ui'
import { desde, esperandoEquipe } from '@/lib/atendimento'
import { etapa as infoEtapa, RESPOSTAS_PRONTAS } from '@/lib/escritorio'
import { haQuanto, hora, mesmoDia } from '@/lib/formato'
import type { Cliente, Mensagem } from '@/lib/tipos'

/*
 * O visual WhatsApp das Conversas no celular (pedido do Edu em 19/10/2026,
 * igual ao do sistema do Marcello). Tudo o que se faz aqui passa pelas MESMAS
 * funcoes do visual padrao (enviar, religar, pausar): so muda a casca. Uma
 * regra nova de envio nao pode existir num visual e faltar no outro.
 *
 * Os dois vao por portal no body: a tela de Conversas fica dentro do .entrar,
 * e o transform da animacao vira o "chao" de todo position:fixed la dentro.
 * Sem o portal a tela cheia nasceria do tamanho da secao.
 */

/** O papel do WhatsApp: bege com um rabisco discreto, o mesmo do Marcello. */
const FUNDO_WHATSAPP = {
  backgroundColor: '#efeae2',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23c4b8a8' stroke-width='1.1' stroke-linecap='round' opacity='.34'%3E%3Cpath d='M10 14h10M12 22c3-3 7-3 10 0'/%3E%3Ccircle cx='58' cy='16' r='5'/%3E%3Cpath d='M50 44l5 5 8-9M20 58h14M22 66h10'/%3E%3Cpath d='M64 62c0 3-3 5-6 5s-6-2-6-5 3-5 6-5 6 2 6 5z'/%3E%3Cpath d='M32 30l6 6 6-6'/%3E%3C/g%3E%3C/svg%3E\")",
} as const

export type Filtro = 'todas' | 'equipe' | 'robo'

function rotuloDoDia(iso: string): string {
  const d = new Date(iso)
  const hoje = new Date()
  if (mesmoDia(d, hoje)) return 'Hoje'
  if (mesmoDia(d, new Date(hoje.getTime() - 86400000))) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: d.getFullYear() === hoje.getFullYear() ? undefined : 'numeric' })
}

function rotuloDaLista(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hoje = new Date()
  if (mesmoDia(d, hoje)) return hora(iso)
  if (mesmoDia(d, new Date(hoje.getTime() - 86400000))) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** A tela cheia trava a pagina de tras: sem isto ela rolava junto com o dedo. */
function useTravarPagina() {
  useEffect(() => {
    const html = document.documentElement
    const antes = { html: html.style.overflow, body: document.body.style.overflow }
    // Nos dois: o html tem overflow-x: clip (index.css), e com ele o overflow
    // do body nao chega a viewport; travar so o body nao segurava nada.
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = antes.html
      document.body.style.overflow = antes.body
    }
  }, [])
}

/* ---------------------------------------------------------------- lista */

export function ListaWhatsApp({
  lista,
  busca,
  setBusca,
  filtro,
  setFiltro,
  qtdEquipe,
  demonstracao,
  onAbrir,
  onChatNormal,
}: {
  lista: Cliente[]
  busca: string
  setBusca: (v: string) => void
  filtro: Filtro
  setFiltro: (f: Filtro) => void
  qtdEquipe: number
  demonstracao: boolean
  onAbrir: (id: string) => void
  onChatNormal: () => void
}) {
  useTravarPagina()
  return createPortal(
    // z-[35]: cobre o cabecalho escuro (z-30) mas fica ABAIXO do menu de
    // baixo (z-40), como as abas do proprio WhatsApp. Sem o menu a lista
    // viraria um beco sem saida. A conversa aberta (z-[45]) cobre tudo.
    <div className="fixed inset-0 z-[35] flex flex-col bg-white lg:hidden" role="dialog" aria-label="Conversas">
      <div className="flex items-center justify-between gap-2 bg-white px-4 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold leading-tight text-[#111b21]">Conversas</h2>
          {demonstracao && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ouro-600">Modo demonstração</p>}
        </div>
        <button
          type="button"
          onClick={onChatNormal}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-marinho-900 px-3 py-2 text-[11px] font-extrabold text-white active:bg-marinho-800"
        >
          <ListaIcone className="h-3.5 w-3.5" />
          Chat normal
        </button>
      </div>

      <div className="px-3">
        <label className="flex items-center gap-2 rounded-full bg-[#f0f2f5] px-3.5 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#8696a0]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar nome ou telefone"
            className="w-full min-w-0 bg-transparent text-[15px] text-[#111b21] outline-none placeholder:text-[#8696a0]"
          />
        </label>
        <div className="sem-barra flex gap-2 overflow-x-auto py-2.5">
          {(
            [
              ['todas', 'Todas'],
              ['equipe', `Esperando equipe${qtdEquipe ? ` ${qtdEquipe}` : ''}`],
              ['robo', 'Com o robô'],
            ] as [Filtro, string][]
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                filtro === valor ? 'bg-[#d9fdd3] text-[#008069]' : 'bg-[#f0f2f5] text-[#54656f]'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Folga embaixo do tamanho do menu flutuante, para a ultima conversa
          nao ficar escondida atras dele. */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        {lista.length === 0 && <p className="px-6 py-10 text-center text-[13px] text-[#667781]">Nenhuma conversa aqui.</p>}
        {lista.map((c) => {
          const ultima = c.mensagens.at(-1)
          const espera = esperandoEquipe(c)
          const nome = c.nome || c.telefone
          return (
            <button key={c.id} type="button" onClick={() => onAbrir(c.id)} className="flex w-full items-center gap-3 bg-white px-3 text-left active:bg-[#f5f6f6]">
              <Avatar nome={nome} tamanho="h-12 w-12 text-[14px]" />
              <span className="min-w-0 flex-1 border-b border-[#f0f2f5] py-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[15.5px] font-semibold text-[#111b21]">{nome}</span>
                    {espera && <span className="shrink-0 rounded-md bg-ouro-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-ouro-700">equipe</span>}
                  </span>
                  <span className={`shrink-0 text-[11.5px] ${c.naoLidas > 0 ? 'font-bold text-[#1daa61]' : 'text-[#667781]'}`}>{rotuloDaLista(ultima?.em)}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-[13.5px] text-[#667781]">
                    {ultima?.de === 'robo' && <Bot className="h-3.5 w-3.5 shrink-0 text-[#008069]" />}
                    {ultima?.de === 'equipe' && <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#53bdeb]" />}
                    <span className="truncate">{((ultima && previaDaMensagem(ultima)) || 'Sem mensagens').replace(/\s+/g, ' ')}</span>
                  </span>
                  {c.naoLidas > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#1daa61] px-1.5 text-[11px] font-bold text-white">{c.naoLidas}</span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------- conversa */

function Confirmacao({ status }: { status?: string }) {
  if (status === 'read') return <CheckCheck className="h-4 w-4 text-[#53bdeb]" />
  if (status === 'delivered') return <CheckCheck className="h-4 w-4" />
  if (status === 'sent') return <Check className="h-4 w-4" />
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-[#b42318]" />
  return null
}

function BalaoWhatsApp({
  m,
  comRabinho,
  comNome,
  mensagens,
  nomeDoCliente,
  onResponder,
}: {
  m: Mensagem
  comRabinho: boolean
  comNome: boolean
  mensagens: Mensagem[]
  nomeDoCliente: string
  onResponder?: (m: Mensagem) => void
}) {
  const nosso = m.de !== 'cliente'
  const responder = onResponder && podeCitar(m) ? () => onResponder(m) : undefined
  const arrastar = useArrastarParaResponder(responder)
  return (
    <div id={`msg-${m.id}`} className={`flex ${nosso ? 'justify-end' : 'justify-start'} ${comRabinho ? 'mt-1.5' : ''}`}>
      <div
        {...arrastar}
        className={`group relative max-w-[85%] rounded-[7.5px] px-[9px] pb-[7px] pt-[6px] shadow-[0_1px_0.5px_rgba(11,20,26,.13)] ${nosso ? 'bg-[#d9fdd3]' : 'bg-white'} ${
          comRabinho ? (nosso ? 'rounded-tr-none' : 'rounded-tl-none') : ''
        }`}
      >
        {responder && <BotaoResponder onClick={responder} lado={nosso ? 'esquerda' : 'direita'} />}
        {comRabinho && (
          <svg viewBox="0 0 8 13" width="8" height="13" aria-hidden="true" className={`absolute top-0 ${nosso ? '-right-2' : '-left-2'}`}>
            <path
              fill={nosso ? '#d9fdd3' : '#ffffff'}
              d={nosso ? 'M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z' : 'M2.812 0H8v11.193L1.533 2.568C.474 1.156 1.042 0 2.812 0z'}
            />
          </svg>
        )}
        {/* Quem falou do nosso lado: o robo ou a pessoa da equipe. So na
            primeira de cada sequencia, como o nome nos grupos do WhatsApp. */}
        {nosso && comNome && (
          <p className={`mb-0.5 flex items-center gap-1 text-[12px] font-bold ${m.de === 'robo' ? 'text-[#008069]' : 'text-[#8a5f12]'}`}>
            {m.de === 'robo' && <Bot className="h-3.5 w-3.5" />}
            {m.de === 'robo' ? 'Mary CB&AA' : m.autor || 'Equipe'}
          </p>
        )}
        <Citacao m={m} mensagens={mensagens} nomeDoCliente={nomeDoCliente} />
        <MidiaDaMensagem m={m} />
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[20px] text-[#111b21]">
          {textoSemMidia(m)}
          {/* Espaco invisivel do tamanho da hora: se a ultima linha nao tem
              lugar para ela, o espaco desce e a hora nao cobre o texto. */}
          <span className={`invisible inline-block ${nosso ? 'w-[68px]' : 'w-[44px]'}`} aria-hidden="true" />
        </p>
        <span className="absolute bottom-[5px] right-[8px] flex items-center gap-[3px] text-[11px] leading-none text-[#667781]">
          {hora(m.em)}
          {nosso && <Confirmacao status={m.statusEnvio} />}
        </span>
        {/* Falha silenciosa e pior que falha barulhenta: o motivo aparece no
            proprio balao, como no visual padrao. */}
        {m.statusEnvio === 'failed' && (
          <p className="mt-1 text-[12px] font-semibold text-[#b42318]">Não foi entregue{m.erroEnvio ? `: ${m.erroEnvio}` : ''}</p>
        )}
      </div>
    </div>
  )
}

export function ConversaWhatsApp({
  c,
  demonstracao,
  texto,
  setTexto,
  enviando,
  erroEnvio,
  limparErro,
  comoCliente,
  setComoCliente,
  enviar,
  respondendo,
  onResponder,
  onCancelarResposta,
  arquivo,
  onEscolherArquivo,
  onTirarArquivo,
  onVoltar,
  onVisualPadrao,
  abrirCliente,
  religar,
  pausar,
}: {
  c: Cliente
  demonstracao: boolean
  texto: string
  setTexto: (t: string) => void
  enviando: boolean
  erroEnvio: string
  limparErro: () => void
  comoCliente: boolean
  setComoCliente: (v: boolean) => void
  enviar: () => Promise<void>
  respondendo: Mensagem | null
  onResponder?: (m: Mensagem) => void
  onCancelarResposta: () => void
  arquivo: File | null
  onEscolherArquivo?: (f: File) => void
  onTirarArquivo: () => void
  onVoltar: () => void
  onVisualPadrao: () => void
  abrirCliente: (id: string) => void
  religar: () => void
  pausar: () => void
}) {
  useTravarPagina()
  const [menu, setMenu] = useState(false)
  const [prontas, setProntas] = useState(false)
  const [noFim, setNoFim] = useState(true)
  const caixa = useRef<HTMLDivElement>(null)
  const conteudo = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  // Abre JA no fim, como o WhatsApp, e fica "grudada" no fim enquanto chega
  // mensagem nova, ate a pessoa subir para ler: ai para de puxar.
  const grudado = useRef(true)
  const espera = esperandoEquipe(c)
  const nome = c.nome || c.telefone

  useLayoutEffect(() => {
    grudado.current = true
    setNoFim(true)
    const k = caixa.current
    if (k) k.scrollTop = k.scrollHeight
  }, [c.id])
  useLayoutEffect(() => {
    const k = caixa.current
    if (k && grudado.current) k.scrollTop = k.scrollHeight
  }, [c.mensagens.length])
  // O campo cresce com o texto e a area das mensagens encolhe: sem isto a
  // ultima mensagem sumia atras do campo.
  useEffect(() => {
    const k = caixa.current
    if (!k || !conteudo.current) return
    const observador = new ResizeObserver(() => {
      if (grudado.current) k.scrollTop = k.scrollHeight
    })
    observador.observe(k)
    observador.observe(conteudo.current)
    return () => observador.disconnect()
  }, [c.id])

  // Depois de enviar, o campo volta a ter uma linha so.
  useEffect(() => {
    if (!texto && campo.current) campo.current.style.height = ''
  }, [texto])

  function irParaOFim() {
    const k = caixa.current
    if (!k) return
    grudado.current = true
    setNoFim(true)
    k.scrollTo({ top: k.scrollHeight, behavior: 'smooth' })
  }

  async function mandar() {
    if ((!texto.trim() && !arquivo) || enviando) return
    grudado.current = true
    setProntas(false)
    await enviar()
  }

  return createPortal(
    // z-[45]: cobre o menu de baixo (z-40), mas fica abaixo da ficha do
    // cliente (z-50), que abre por cima ao tocar no nome.
    <div className="fixed inset-0 z-[45] flex flex-col bg-[#efeae2] lg:hidden" role="dialog" aria-label={`Conversa com ${nome}`}>
      {/* Parte congelada: voltar, nome e o robo. So as mensagens rolam. */}
      <div className="relative z-10 bg-white text-[#111b21] shadow-[0_1px_2px_rgba(11,20,26,.12)]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-1 px-1.5 py-2">
          <button type="button" onClick={onVoltar} aria-label="Voltar para as conversas" className="shrink-0 rounded-full p-2 text-[#54656f] active:bg-black/5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => abrirCliente(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title="Abrir a ficha do cliente">
            <Avatar nome={nome} tamanho="h-10 w-10 text-[13px]" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[16px] font-semibold">{c.nome || 'Sem nome ainda'}</span>
              <span className="block truncate text-[12.5px] text-[#667781]">
                {/* Curto de proposito: "Equipe no comando · Qualificado" ja
                    cortava numa tela de 375px. */}
                {infoEtapa(c.etapa).curto} · {c.robo.pausado ? 'equipe' : 'robô'}
              </span>
            </span>
          </button>
          {c.robo.pausado ? (
            <button
              type="button"
              onClick={religar}
              title="O robô volta a responder sozinho"
              className="flex shrink-0 items-center gap-1 rounded-full bg-[#e7f8ee] px-2.5 py-1.5 text-[12px] font-bold text-[#128c4a] active:bg-[#d6f3e2]"
            >
              <PlayCircle className="h-4 w-4" /> Religar
            </button>
          ) : (
            <button
              type="button"
              onClick={pausar}
              title="Pausa o robô e a equipe assume esta conversa"
              className="flex shrink-0 items-center gap-1 rounded-full bg-ouro-50 px-2.5 py-1.5 text-[12px] font-bold text-ouro-700 active:bg-ouro-100"
            >
              <Hand className="h-4 w-4" /> Assumir
            </button>
          )}
          <div className="relative shrink-0">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Mais opções" aria-expanded={menu} className="rounded-full p-2 text-[#54656f] active:bg-black/5">
              <MoreVertical className="h-5 w-5" />
            </button>
            {menu && (
              <div className="absolute right-0 top-11 z-20 w-64 overflow-hidden rounded-[10px] bg-white py-1.5 text-[14.5px] text-[#111b21] shadow-[0_6px_24px_rgba(11,20,26,.25)]">
                <button type="button" onClick={() => { setMenu(false); abrirCliente(c.id) }} className="block w-full px-4 py-2.5 text-left active:bg-black/5">
                  Ver a ficha do cliente
                </button>
                {demonstracao && (
                  <button type="button" onClick={() => { setMenu(false); setComoCliente(!comoCliente) }} className="block w-full px-4 py-2.5 text-left active:bg-black/5">
                    {comoCliente ? 'Voltar a escrever como equipe' : 'Escrever como o cliente (teste)'}
                  </button>
                )}
                <button type="button" onClick={() => { setMenu(false); onVisualPadrao() }} className="block w-full px-4 py-2.5 text-left active:bg-black/5">
                  Voltar ao visual padrão
                </button>
              </div>
            )}
          </div>
        </div>
        {espera && (
          <p className="flex items-center gap-1.5 border-t border-ouro-200/60 bg-ouro-50 px-4 py-1.5 text-[12px] font-semibold text-ouro-700">
            <span className="pulso-ouro h-2 w-2 shrink-0 rounded-full bg-ouro-500" />
            <span className="min-w-0 truncate">Esperando a equipe {haQuanto(desde(c))}</span>
          </p>
        )}
      </div>

      {/* Parte de baixo: as mensagens ocupam tudo o que sobra. */}
      <div
        ref={caixa}
        onScroll={(e) => {
          const k = e.currentTarget
          const fim = k.scrollHeight - k.scrollTop - k.clientHeight < 80
          grudado.current = fim
          if (fim !== noFim) setNoFim(fim)
        }}
        onClick={() => menu && setMenu(false)}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
        style={FUNDO_WHATSAPP}
      >
        <div ref={conteudo} className="flex flex-col gap-[3px] pb-2">
          {c.mensagens.map((m, i) => {
            const anterior = i > 0 ? c.mensagens[i - 1] : null
            const novoDia = !anterior || !mesmoDia(new Date(anterior.em), new Date(m.em))
            const mesmoLado = !novoDia && anterior !== null && (anterior.de === 'cliente') === (m.de === 'cliente')
            const mesmaPessoa = mesmoLado && anterior?.de === m.de && anterior?.autor === m.autor
            return (
              <div key={m.id}>
                {novoDia && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-[8px] bg-white px-3 py-1 text-[12.5px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">{rotuloDoDia(m.em)}</span>
                  </div>
                )}
                <BalaoWhatsApp
                  m={m}
                  comRabinho={!mesmoLado}
                  comNome={!mesmaPessoa}
                  mensagens={c.mensagens}
                  nomeDoCliente={c.nome}
                  onResponder={
                    onResponder &&
                    ((x) => {
                      onResponder(x)
                      campo.current?.focus()
                    })
                  }
                />
              </div>
            )
          })}
        </div>
      </div>

      {!noFim && (
        <button
          type="button"
          onClick={irParaOFim}
          aria-label="Ir para a última mensagem"
          className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#54656f] shadow-[0_2px_6px_rgba(11,20,26,.25)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      {/* Campo de escrever, tambem congelado embaixo. */}
      <div className="px-1.5 pt-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}>
        {prontas && (
          <div className="sem-barra mb-1.5 flex gap-1.5 overflow-x-auto px-1">
            {RESPOSTAS_PRONTAS.map((r) => (
              <button
                key={r.nome}
                type="button"
                onClick={() => {
                  setTexto(r.texto)
                  setProntas(false)
                  campo.current?.focus()
                }}
                className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#008069] shadow-[0_1px_0.5px_rgba(11,20,26,.13)] active:bg-[#f0f2f5]"
              >
                {r.nome}
              </button>
            ))}
          </div>
        )}
        {erroEnvio && (
          <div className="mx-1 mb-1.5 flex items-start gap-2 rounded-[10px] bg-[#fdecea] px-3 py-2 text-[12.5px] font-semibold text-[#b42318]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{erroEnvio}</span>
            <button type="button" onClick={limparErro} aria-label="Fechar aviso" className="shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {comoCliente && demonstracao && (
          <p className="mx-1 mb-1.5 rounded-[10px] bg-sky-50 px-3 py-1.5 text-[12px] font-semibold text-sky-700">Teste: você está escrevendo como o cliente.</p>
        )}
        <div className="mx-1">
          <FaixaDoEnvio respondendo={respondendo} nomeDoCliente={c.nome} onCancelarResposta={onCancelarResposta} arquivo={arquivo} onTirarArquivo={onTirarArquivo} />
        </div>
        <div className="flex items-end gap-1.5">
          <div
            className={`flex min-h-[48px] min-w-0 flex-1 items-end rounded-[24px] bg-white pl-1 pr-2 shadow-[0_1px_0.5px_rgba(11,20,26,.13)] ${
              comoCliente && demonstracao ? 'ring-2 ring-sky-300' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setProntas((v) => !v)}
              aria-label="Respostas prontas"
              aria-expanded={prontas}
              className={`mb-[6px] shrink-0 rounded-full p-2 active:bg-black/5 ${prontas ? 'text-[#008069]' : 'text-[#54656f]'}`}
            >
              <MessageSquareText className="h-5 w-5" />
            </button>
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                // Cresce com o texto ate umas 5 linhas, como no app.
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={(e) => {
                // No computador o Enter envia; no celular ele quebra a linha,
                // como no WhatsApp, e quem envia e o botao verde.
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                  e.preventDefault()
                  void mandar()
                }
              }}
              rows={1}
              placeholder={comoCliente && demonstracao ? 'Mensagem do cliente' : c.robo.pausado ? 'Mensagem' : 'Mensagem (pausa o robô)'}
              className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent px-1 py-[13px] text-[16px] leading-[21px] text-[#111b21] outline-none placeholder:text-[#8696a0]"
            />
            {onEscolherArquivo && <BotaoAnexar onEscolher={onEscolherArquivo} className="mb-[6px] shrink-0 rounded-full p-2 text-[#54656f] active:bg-black/5" />}
          </div>
          <button
            type="button"
            onClick={() => void mandar()}
            disabled={(!texto.trim() && !arquivo) || enviando}
            aria-label="Enviar"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-[0_1px_2px_rgba(11,20,26,.2)] transition disabled:opacity-60 ${
              comoCliente && demonstracao ? 'bg-sky-600 active:bg-sky-700' : 'bg-[#1daa61] active:bg-[#178a4f]'
            }`}
          >
            {enviando ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
