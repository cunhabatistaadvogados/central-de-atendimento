import { ArrowLeft, Bot, CircleUser, Hand, MessagesSquare, PlayCircle, Search, Send, Smartphone, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, ChipEtapa, ChipOrigem, Vazio } from '@/components/ui'
import { desde, esperandoEquipe } from '@/lib/atendimento'
import { dataCurta, haQuanto, hora, mesmoDia } from '@/lib/formato'
import { useDados } from '@/lib/store'
import type { Cliente, Mensagem } from '@/lib/tipos'

type Filtro = 'todas' | 'equipe' | 'robo'

export const RESPOSTAS_PRONTAS = [
  {
    nome: 'Lista de documentos',
    texto: 'Para o contrato e o pedido no INSS, me manda por aqui: foto do RG (frente e verso), CPF, comprovante de endereço e o CadÚnico. Se tiver, o laudo também.',
  },
  {
    nome: 'Como assinar',
    texto: 'O contrato chega aqui no seu WhatsApp, por um link do D4Sign. Você abre no celular, confere e assina com um clique. Não precisa imprimir nada.',
  },
  { nome: 'Confirmar reunião', texto: 'Confirmado: o Dr. André fala com você no horário combinado. Qualquer coisa, é só chamar aqui.' },
  { nome: 'Quando pago?', texto: 'Só no final, quando o benefício sair. Antes disso você não paga nada ao escritório.' },
]

function Balao({ m }: { m: Mensagem }) {
  const nosso = m.de !== 'cliente'
  return (
    <div className={`flex ${nosso ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-[0_1px_1px_rgba(0,0,0,.06)] sm:max-w-[68%] ${
          m.de === 'cliente' ? 'rounded-tl-md bg-white text-marinho-900' : m.de === 'robo' ? 'rounded-tr-md bg-marinho-100 text-marinho-900' : 'rounded-tr-md bg-ouro-100 text-marinho-900'
        }`}
      >
        {nosso && (
          <p className={`mb-0.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${m.de === 'robo' ? 'text-marinho-600' : 'text-ouro-700'}`}>
            {m.de === 'robo' ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {m.de === 'robo' ? 'Robô CB&AA' : m.autor}
          </p>
        )}
        {m.texto}
        <span className="ml-2 inline-block translate-y-1 text-[10px] text-slate-400">{hora(m.em)}</span>
      </div>
    </div>
  )
}

export function Bolhas({ mensagens }: { mensagens: Mensagem[] }) {
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
            <Balao m={m} />
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
          <span className="truncate">{ultima?.texto}</span>
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
  const { clientes, responder, receber, religarRobo, pausarRobo, marcarLido } = useDados()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<string | null>(foco)
  const [texto, setTexto] = useState('')
  const [comoCliente, setComoCliente] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
    if (atual?.naoLidas) marcarLido(atual.id)
  }, [atual?.id, atual?.mensagens.length, atual?.naoLidas, marcarLido])

  function enviar() {
    const t = texto.trim()
    if (!t || !atual) return
    if (comoCliente) receber(atual.id, t)
    else responder(atual.id, t, autor)
    setTexto('')
  }

  return (
    <div className="cartao flex h-[calc(100dvh-230px)] min-h-[560px] overflow-hidden p-0 lg:h-[calc(100dvh-210px)]">
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
          <div className="flex flex-wrap items-center gap-3 border-b border-marinho-900/[0.06] px-4 py-3">
            <button type="button" onClick={() => setSelecionado(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => abrirCliente(atual.id)} className="flex min-w-0 items-center gap-3 text-left">
              <Avatar nome={atual.nome || atual.telefone} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold hover:underline">{atual.nome || 'Sem nome ainda'}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Smartphone className="h-3 w-3" /> {atual.telefone} <ChipOrigem origem={atual.origem} />
                </span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <ChipEtapa etapa={atual.etapa} compacto />
              {atual.robo.pausado ? (
                <button type="button" onClick={() => religarRobo(atual.id)} className="botao-claro py-1.5 text-xs" title="O robô volta a responder sozinho">
                  <PlayCircle className="h-4 w-4 text-emerald-600" /> Religar robô
                </button>
              ) : (
                <button type="button" onClick={() => pausarRobo(atual.id, `${autor} pausou o robô`)} className="botao-claro py-1.5 text-xs">
                  <Hand className="h-4 w-4 text-ouro-600" /> Assumir
                </button>
              )}
            </div>
          </div>

          <div className={`flex items-center gap-2 px-4 py-2 text-[11px] font-semibold ${atual.robo.pausado ? 'bg-ouro-50 text-ouro-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {atual.robo.pausado ? <CircleUser className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            {atual.robo.pausado ? `Equipe no comando · ${atual.robo.motivoPausa ?? ''}` : 'Robô atendendo · responde sozinho e passa para a equipe na hora certa'}
            {esperandoEquipe(atual) && <span className="ml-auto rounded-full bg-ouro-500 px-2 py-0.5 text-[10px] font-extrabold text-marinho-950">esperando {haQuanto(desde(atual)).replace('há ', '')}</span>}
          </div>

          <div className="papel-whatsapp rolagem-fina flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
            <Bolhas mensagens={atual.mensagens} />
            <div ref={fim} />
          </div>

          <div className="border-t border-marinho-900/[0.06] bg-white p-3">
            <div className="rolagem-fina mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {RESPOSTAS_PRONTAS.map((r) => (
                <button key={r.nome} type="button" onClick={() => setTexto(r.texto)} className="shrink-0 rounded-full border border-ouro-200 bg-ouro-50 px-3 py-1 text-[11px] font-bold text-ouro-700 hover:bg-ouro-100">
                  {r.nome}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                rows={1}
                placeholder={comoCliente ? 'Escreva como se fosse o cliente (teste)' : atual.robo.pausado ? 'Responder como equipe' : 'Responder como equipe (o robô pausa nesta conversa)'}
                className={`campo max-h-32 min-h-[44px] resize-none ${comoCliente ? 'border-sky-300 bg-sky-50' : ''}`}
              />
              <button type="button" onClick={enviar} disabled={!texto.trim()} className={comoCliente ? 'botao bg-sky-600 text-white hover:bg-sky-700' : 'botao-primario'} aria-label="Enviar">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-400">
              <input type="checkbox" checked={comoCliente} onChange={(e) => setComoCliente(e.target.checked)} className="accent-sky-600" />
              Demonstração: escrever como o cliente para ver o robô responder
            </label>
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
