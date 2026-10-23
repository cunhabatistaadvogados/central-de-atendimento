import { ArrowLeft, Bot, CircleUser, Hand, MessageCircle, MessagesSquare, PlayCircle, RotateCcw, Search, Send, Smartphone, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { repetirPergunta as perguntaParaRepetir } from '@motor/robo'
import { BotaoAnexar, BotaoResponder, Citacao, FaixaDoEnvio, MidiaDaMensagem, podeCitar, previaDaMensagem, textoSemMidia, useArrastarParaResponder } from '@/components/Midia'
import { Avatar, ChipEtapa, ChipOrigem, Vazio } from '@/components/ui'
import { desde, esperandoEquipe } from '@/lib/atendimento'
import { etapa as infoEtapa, RESPOSTAS_PRONTAS } from '@/lib/escritorio'
import { dataCurta, haQuanto, hora, mesmoDia } from '@/lib/formato'
import { EVENTO_MODO_WHATSAPP, guardarVisual, useTelaDeCelular, visualGuardado } from '@/lib/modo-whatsapp'
import { useDados } from '@/lib/store'
import type { Cliente, Mensagem } from '@/lib/tipos'
import { ConversaWhatsApp, ListaWhatsApp, type Filtro } from '@/sections/ConversasWhatsApp'

function Balao({ m, mensagens, nomeDoCliente, onResponder }: { m: Mensagem; mensagens: Mensagem[]; nomeDoCliente: string; onResponder?: (m: Mensagem) => void }) {
  const nosso = m.de !== 'cliente'
  const responder = onResponder && podeCitar(m) ? () => onResponder(m) : undefined
  const arrastar = useArrastarParaResponder(responder)
  return (
    <div id={`msg-${m.id}`} className={`flex ${nosso ? 'justify-end' : 'justify-start'}`}>
      <div
        {...arrastar}
        className={`group relative max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-[0_1px_1px_rgba(0,0,0,.06)] sm:max-w-[68%] ${
          m.de === 'cliente' ? 'rounded-tl-md bg-white text-marinho-900' : m.de === 'robo' ? 'rounded-tr-md bg-marinho-100 text-marinho-900' : 'rounded-tr-md bg-ouro-100 text-marinho-900'
        }`}
      >
        {responder && <BotaoResponder onClick={responder} lado={nosso ? 'esquerda' : 'direita'} />}
        {nosso && (
          <p className={`mb-0.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${m.de === 'robo' ? 'text-marinho-600' : 'text-ouro-700'}`}>
            {m.de === 'robo' ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {m.de === 'robo' ? 'Mary CB&AA' : m.autor}
          </p>
        )}
        <Citacao m={m} mensagens={mensagens} nomeDoCliente={nomeDoCliente} />
        <MidiaDaMensagem m={m} />
        {textoSemMidia(m)}
        <span className="ml-2 inline-block translate-y-1 text-[10px] text-slate-400">
          {hora(m.em)}
          {nosso && m.statusEnvio === 'read' && <span className="ml-1 text-sky-500">✓✓</span>}
          {nosso && m.statusEnvio === 'delivered' && <span className="ml-1">✓✓</span>}
          {nosso && m.statusEnvio === 'sent' && <span className="ml-1">✓</span>}
        </span>
        {/* Falha silenciosa e pior que falha barulhenta: mensagem que a Meta
            recusou ganha etiqueta vermelha com o motivo, na propria conversa. */}
        {m.statusEnvio === 'failed' && (
          <p className="mt-1.5 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
            Não foi entregue{m.erroEnvio ? `: ${m.erroEnvio}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

export function Bolhas({ mensagens, nomeDoCliente = '', onResponder }: { mensagens: Mensagem[]; nomeDoCliente?: string; onResponder?: (m: Mensagem) => void }) {
  let diaAnterior = ''
  return (
    <>
      {mensagens.map((m) => {
        const dia = new Date(m.em).toDateString()
        const separador = dia !== diaAnterior
        diaAnterior = dia
        return (
          <div key={m.id} className="space-y-2">
            {separador && (
              <div className="flex justify-center py-1">
                <span className="rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                  {mesmoDia(new Date(m.em), new Date()) ? 'Hoje' : dataCurta(m.em)}
                </span>
              </div>
            )}
            <Balao m={m} mensagens={mensagens} nomeDoCliente={nomeDoCliente} onResponder={onResponder} />
          </div>
        )
      })}
    </>
  )
}

function ItemDaLista({ c, ativo, onClick }: { c: Cliente; ativo: boolean; onClick: () => void }) {
  const ultima = c.mensagens.at(-1)
  const espera = esperandoEquipe(c)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${ativo ? 'bg-marinho-800 text-white' : 'hover:bg-ouro-50/70'}`}
    >
      <Avatar nome={c.nome || c.telefone} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{c.nome || c.telefone}</span>
          <span className={`shrink-0 text-[10px] font-semibold ${ativo ? 'text-white/50' : 'text-slate-400'}`}>{haQuanto(ultima?.em)}</span>
        </span>
        <span className={`mt-0.5 flex items-center gap-1.5 text-xs ${ativo ? 'text-white/60' : 'text-slate-500'}`}>
          {ultima?.de === 'robo' && <Bot className="h-3 w-3 shrink-0" />}
          <span className="truncate">{ultima && previaDaMensagem(ultima)}</span>
        </span>
      </span>
      {espera ? (
        <span className="pulso-ouro h-2.5 w-2.5 shrink-0 rounded-full bg-ouro-500" title="Esperando a equipe" />
      ) : c.naoLidas > 0 ? (
        <span className="min-w-5 shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-center text-[10px] font-extrabold text-white">{c.naoLidas}</span>
      ) : null}
    </button>
  )
}

export default function Conversas({ foco, limparFoco, abrirCliente, autor }: { foco: string | null; limparFoco: () => void; abrirCliente: (id: string) => void; autor: string }) {
  const { clientes, responder, repetirPergunta, receber, religarRobo, pausarRobo, marcarLido, marcarResolvida, demonstracao } = useDados()
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<string | null>(foco)
  const [texto, setTexto] = useState('')
  const [comoCliente, setComoCliente] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  // Visual WhatsApp no celular: escolha lembrada no aparelho. O botao verde do
  // cabecalho (Home) liga de fora, pelo evento.
  const [visualWhatsApp, setVisualWhatsApp] = useState(visualGuardado)
  const telaDeCelular = useTelaDeCelular()
  const telaWhats = visualWhatsApp && telaDeCelular
  const trocarVisual = (whatsapp: boolean) => {
    guardarVisual(whatsapp)
    setVisualWhatsApp(whatsapp)
  }
  useEffect(() => {
    const ligar = () => setVisualWhatsApp(true)
    window.addEventListener(EVENTO_MODO_WHATSAPP, ligar)
    return () => window.removeEventListener(EVENTO_MODO_WHATSAPP, ligar)
  }, [])

  useEffect(() => {
    if (foco) {
      setSelecionado(foco)
      limparFoco()
    }
  }, [foco, limparFoco])

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return clientes
      .filter((c) => c.mensagens.length > 0)
      .filter((c) => (filtro === 'equipe' ? esperandoEquipe(c) : filtro === 'robo' ? !c.robo.pausado : true))
      .filter((c) => !b || c.nome.toLowerCase().includes(b) || c.telefone.includes(b))
  }, [clientes, filtro, busca])

  const atual = clientes.find((c) => c.id === selecionado) ?? null
  const qtdEquipe = clientes.filter(esperandoEquipe).length

  // Resposta citada e arquivo valem so para a conversa em que foram escolhidos:
  // trocar de conversa nao leva a citacao junto.
  const [citada, setCitada] = useState<{ cid: string; m: Mensagem } | null>(null)
  const [anexo, setAnexo] = useState<{ cid: string; f: File } | null>(null)
  const respondendo = citada && citada.cid === atual?.id ? citada.m : null
  const arquivo = anexo && anexo.cid === atual?.id ? anexo.f : null
  const responderA = (m: Mensagem) => atual && setCitada({ cid: atual.id, m })
  const escolherArquivo = (f: File) => atual && setAnexo({ cid: atual.id, f })

  useEffect(() => {
    // Rola so a caixa das mensagens. O scrollIntoView de antes rolava a
    // pagina inteira junto e, no celular, jogava o campo para tras do menu.
    const caixa = fim.current?.parentElement
    if (caixa) caixa.scrollTop = caixa.scrollHeight
    if (atual?.naoLidas) marcarLido(atual.id)
  }, [atual?.id, atual?.mensagens.length, atual?.naoLidas, marcarLido])

  // Conversa aberta no celular, visual padrao: a pagina para com o cartao
  // logo abaixo do cabecalho, e ele ocupa ate o menu flutuante. O topo da
  // conversa fica parado e so as mensagens rolam (pedido do Edu, 19/10/2026).
  const cartao = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (atual?.id && telaDeCelular && !visualWhatsApp) cartao.current?.scrollIntoView({ block: 'start' })
  }, [atual?.id, telaDeCelular, visualWhatsApp])

  async function enviar() {
    const t = texto.trim()
    if ((!t && !arquivo) || !atual || enviando) return
    setErroEnvio('')
    if (comoCliente && demonstracao) {
      if (!t) return
      receber(atual.id, t)
      setTexto('')
      return
    }
    setEnviando(true)
    try {
      await responder(atual.id, t, autor, { respondeA: respondendo?.wamid, arquivo: arquivo ?? undefined })
      setTexto('')
      setCitada(null)
      setAnexo(null)
    } catch (e) {
      // O texto fica na caixa para tentar de novo; o motivo aparece embaixo.
      setErroEnvio(e instanceof Error ? e.message : 'Não foi possível enviar.')
    } finally {
      setEnviando(false)
    }
  }

  // "Repetir pergunta do robo": so com o robo atendendo e esperando resposta
  // (caso Sabrina, 23/10/2026). Ele manda de novo e continua lendo a resposta.
  const pendente = atual ? (perguntaParaRepetir(atual.robo, new Date())?.texto ?? null) : null
  async function repetir() {
    if (!atual || enviando) return
    setErroEnvio('')
    setEnviando(true)
    try {
      await repetirPergunta(atual.id, autor)
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : 'Não foi possível repetir a pergunta.')
    } finally {
      setEnviando(false)
    }
  }

  if (telaWhats) {
    return atual ? (
      <ConversaWhatsApp
        c={atual}
        demonstracao={demonstracao}
        texto={texto}
        setTexto={setTexto}
        enviando={enviando}
        erroEnvio={erroEnvio}
        limparErro={() => setErroEnvio('')}
        comoCliente={comoCliente}
        setComoCliente={setComoCliente}
        enviar={enviar}
        respondendo={respondendo}
        onResponder={demonstracao ? undefined : responderA}
        onCancelarResposta={() => setCitada(null)}
        arquivo={arquivo}
        onEscolherArquivo={demonstracao ? undefined : escolherArquivo}
        onTirarArquivo={() => setAnexo(null)}
        onVoltar={() => setSelecionado(null)}
        onVisualPadrao={() => trocarVisual(false)}
        abrirCliente={abrirCliente}
        religar={() => religarRobo(atual.id)}
        pausar={() => pausarRobo(atual.id, `${autor} pausou o robô`)}
        resolver={() => marcarResolvida(atual.id, autor)}
        perguntaPendente={pendente}
        repetir={repetir}
      />
    ) : (
      <ListaWhatsApp
        lista={lista}
        busca={busca}
        setBusca={setBusca}
        filtro={filtro}
        setFiltro={setFiltro}
        qtdEquipe={qtdEquipe}
        demonstracao={demonstracao}
        onAbrir={setSelecionado}
        onChatNormal={() => trocarVisual(false)}
      />
    )
  }

  return (
    // 166px = cabecalho do celular (66) + menu flutuante (84) + 8 de folga em
    // cima e embaixo, medidos numa tela de 375x812.
    <div
      ref={cartao}
      className={`cartao flex scroll-mt-[74px] overflow-hidden p-0 lg:h-[calc(100dvh-210px)] lg:min-h-[560px] ${
        atual ? 'h-[calc(100dvh-166px-env(safe-area-inset-bottom))] min-h-[420px]' : 'h-[calc(100dvh-230px)] min-h-[560px]'
      }`}
    >
      <div className={`flex w-full flex-col border-r border-marinho-900/[0.06] md:w-[340px] md:shrink-0 ${atual ? 'hidden md:flex' : 'flex'}`}>
        <div className="space-y-3 border-b border-marinho-900/[0.06] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou telefone" className="campo py-2 pl-9" />
          </div>
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1 text-xs font-bold">
            {(
              [
                ['todas', 'Todas'],
                ['equipe', `Equipe (${qtdEquipe})`],
                ['robo', 'Com o robô'],
              ] as [Filtro, string][]
            ).map(([k, n]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)} className={`flex-1 rounded-lg py-1.5 transition ${filtro === k ? 'bg-white text-marinho-900 shadow-sm' : 'text-slate-500'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="rolagem-fina flex-1 space-y-1 overflow-y-auto p-2">
          {lista.length === 0 ? (
            <Vazio icone={<MessagesSquare className="h-6 w-6" />} titulo="Nenhuma conversa aqui" texto="Mude o filtro ou a busca." />
          ) : (
            lista.map((c) => <ItemDaLista key={c.id} c={c} ativo={c.id === selecionado} onClick={() => setSelecionado(c.id)} />)
          )}
        </div>
      </div>

      {atual ? (
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Uma linha so, em qualquer largura: no celular o "Religar robo"
              quebrava em duas linhas e o cabecalho comia a conversa (print do
              Edu de 19/10/2026). Etapa e origem cedem lugar primeiro. */}
          <div className="flex items-center gap-1.5 border-b border-marinho-900/[0.06] px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
            <button type="button" onClick={() => setSelecionado(null)} className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => abrirCliente(atual.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3">
              <Avatar nome={atual.nome || atual.telefone} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold hover:underline">
                  {atual.nome || (
                    <>
                      <span className="sm:hidden">{atual.telefone}</span>
                      <span className="hidden sm:inline">Sem nome ainda</span>
                    </>
                  )}
                </span>
                {/* No celular so cabe a etapa; o telefone fica na ficha. */}
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
                  <Smartphone className="hidden h-3 w-3 shrink-0 sm:block" />
                  <span className="hidden truncate sm:inline">{atual.telefone}</span>
                  <span className="hidden sm:inline">
                    <ChipOrigem origem={atual.origem} />
                  </span>
                  <span className="truncate font-semibold text-slate-500 sm:hidden">{infoEtapa(atual.etapa).nome}</span>
                </span>
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span className="hidden sm:inline-flex">
                <ChipEtapa etapa={atual.etapa} compacto />
              </span>
              {atual.robo.pausado ? (
                <button type="button" onClick={() => religarRobo(atual.id)} className="botao-claro whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-4" title="O robô volta a responder sozinho">
                  <PlayCircle className="h-4 w-4 text-emerald-600" />
                  <span>
                    Religar<span className="hidden sm:inline"> robô</span>
                  </span>
                </button>
              ) : (
                <button type="button" onClick={() => pausarRobo(atual.id, `${autor} pausou o robô`)} className="botao-claro whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-4">
                  <Hand className="h-4 w-4 text-ouro-600" /> Assumir
                </button>
              )}
              <button
                type="button"
                onClick={() => trocarVisual(true)}
                aria-label="Abrir no modo WhatsApp"
                title="Modo WhatsApp: conversa em tela cheia"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1daa61] text-white lg:hidden"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-4 py-2 text-[11px] font-semibold ${atual.robo.pausado ? 'bg-ouro-50 text-ouro-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {atual.robo.pausado ? <CircleUser className="h-3.5 w-3.5 shrink-0" /> : <Bot className="h-3.5 w-3.5 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">
              {atual.robo.pausado ? `Equipe no comando · ${atual.robo.motivoPausa ?? ''}` : 'Robô atendendo · responde sozinho e passa para a equipe na hora certa'}
            </span>
            {esperandoEquipe(atual) && (
              <>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-ouro-500 px-2 py-0.5 text-[10px] font-extrabold text-marinho-950">esperando {haQuanto(desde(atual)).replace('há ', '')}</span>
                <button
                  type="button"
                  onClick={() => marcarResolvida(atual.id, autor)}
                  title="Não precisa responder: sai de 'esperando a equipe' até o cliente escrever de novo"
                  className="shrink-0 whitespace-nowrap rounded-full border border-ouro-300 bg-white px-2 py-0.5 text-[10px] font-extrabold text-ouro-700 hover:bg-ouro-100"
                >
                  ✓ Marcar como resolvida
                </button>
              </>
            )}
          </div>

          <div className="papel-whatsapp rolagem-fina flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
            <Bolhas mensagens={atual.mensagens} nomeDoCliente={atual.nome} onResponder={demonstracao ? undefined : responderA} />
            <div ref={fim} />
          </div>

          <div className="border-t border-marinho-900/[0.06] bg-white p-3">
            <div className="rolagem-fina mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {pendente && (
                <button
                  type="button"
                  onClick={repetir}
                  disabled={enviando}
                  title={`O robô manda de novo, sem pausar: "${pendente}"`}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Repetir pergunta do robô
                </button>
              )}
              {RESPOSTAS_PRONTAS.map((r) => (
                <button key={r.nome} type="button" onClick={() => setTexto(r.texto)} className="shrink-0 rounded-full border border-ouro-200 bg-ouro-50 px-3 py-1 text-[11px] font-bold text-ouro-700 hover:bg-ouro-100">
                  {r.nome}
                </button>
              ))}
            </div>
            <FaixaDoEnvio
              respondendo={respondendo}
              nomeDoCliente={atual.nome}
              onCancelarResposta={() => setCitada(null)}
              arquivo={arquivo}
              onTirarArquivo={() => setAnexo(null)}
            />
            <div className="flex items-end gap-2">
              {!demonstracao && (
                <BotaoAnexar onEscolher={escolherArquivo} className="mb-[3px] shrink-0 rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" />
              )}
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void enviar()
                  }
                }}
                rows={1}
                placeholder={comoCliente ? 'Escreva como o cliente (teste)' : atual.robo.pausado ? 'Responder como equipe' : 'Responder (pausa o robô)'}
                className={`campo max-h-32 min-h-[44px] resize-none ${comoCliente ? 'border-sky-300 bg-sky-50' : ''}`}
              />
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={(!texto.trim() && !arquivo) || enviando}
                className={comoCliente && demonstracao ? 'botao bg-sky-600 text-white hover:bg-sky-700' : 'botao-primario'}
                aria-label="Enviar"
              >
                {enviando ? <span className="text-xs">Enviando...</span> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {erroEnvio && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erroEnvio}</p>}
            {demonstracao ? (
              <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-400">
                <input type="checkbox" checked={comoCliente} onChange={(e) => setComoCliente(e.target.checked)} className="accent-sky-600" />
                Demonstração: escrever como o cliente para ver o robô responder
              </label>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">Sai pelo WhatsApp oficial do escritório. Fora das 24h depois da última mensagem do cliente, a Meta só aceita modelo aprovado.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Vazio icone={<MessagesSquare className="h-6 w-6" />} titulo="Escolha uma conversa" texto="As marcadas em dourado estão esperando alguém da equipe." />
        </div>
      )}
    </div>
  )
}
