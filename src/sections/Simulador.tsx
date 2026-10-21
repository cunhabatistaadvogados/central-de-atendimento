import { contratoComParteFixa, dinheiro, novoEstado, rendaPorPessoa, responder, VERSAO_DO_ROTEIRO, type EstadoRobo, type Sinal } from '@motor/robo'
import { ArrowRightLeft, BadgeCheck, Bot, ChevronLeft, FileSignature, RotateCcw, Send, Signal, Wifi } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SeloCB } from '@/components/Marca'
import { etapa } from '@/lib/escritorio'
import { hora } from '@/lib/formato'

interface Fala {
  de: 'cliente' | 'robo'
  texto: string
  em: string
}

const ATALHOS: { nome: string; falas: string[] }[] = [
  { nome: 'Anúncio: autismo com laudo', falas: ['Oi, meu filho tem laudo de autismo e quero saber sobre o BPC/LOAS'] },
  { nome: 'Veio pelo site', falas: ['Gostaria de falar com um advogado previdenciário'] },
  { nome: 'Sem laudo', falas: ['minha filha tem autismo mas ainda não tem laudo'] },
  { nome: 'Idoso', falas: ['Oi, quero saber do LOAS do idoso para minha mãe'] },
  { nome: '60 a 64 anos', falas: ['oi, é pra mim, tenho 63 anos'] },
  { nome: 'Pergunta o preço', falas: ['quanto custa pra entrar com o bpc do meu filho?'] },
  { nome: 'Desconfiado', falas: ['isso é golpe?'] },
]

const SUGESTOES = ['sim', 'não', 'Juliana, ele tem 6 anos', 'faz terapia pelo SUS', 'somos 4, renda de R$ 1.200', 'preciso falar com meu marido', 'dá pra parcelar?', 'amanhã de manhã']

function rotuloSinal(s: Sinal): string {
  if (s.tipo === 'etapa') return `Etapa: ${etapa(s.etapa).nome}`
  if (s.tipo === 'encaminhar') return `Passou para a equipe: ${s.motivo}`
  if (s.tipo === 'pendencia') return `Retorno em ${s.dias} dia(s): ${s.texto}`
  if (s.tipo === 'pendencia_resolvida') return `Pendência resolvida: ${s.texto}`
  if (s.tipo === 'duvida') return `Dúvida para o advogado: ${s.texto}`
  if (s.tipo === 'encerrar') return `Encerrado: ${s.motivo}`
  if (s.tipo === 'origem') return `Origem: ${[s.origem, s.campanha].filter(Boolean).join(' · ')}`
  return `Reunião pedida: ${s.quando}`
}

export default function Simulador() {
  const [estado, setEstado] = useState<EstadoRobo>(novoEstado)
  const [falas, setFalas] = useState<Fala[]>([])
  const [sinais, setSinais] = useState<Sinal[]>([])
  const [texto, setTexto] = useState('')
  const [digitando, setDigitando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [falas.length, digitando])

  function mandar(t: string, base = estado) {
    const limpo = t.trim()
    if (!limpo || digitando) return
    const agora = new Date()
    setFalas((f) => [...f, { de: 'cliente', texto: limpo, em: agora.toISOString() }])
    setTexto('')
    const r = responder(base, limpo, agora)
    setEstado(r.estado)
    setSinais((s) => [...s, ...r.sinais])
    if (!r.respostas.length) return
    setDigitando(true)
    // Ritmo humano: o robo de verdade espera 20 a 60 s; aqui, um instante.
    window.setTimeout(() => {
      setFalas((f) => [...f, ...r.respostas.map((x) => ({ de: 'robo' as const, texto: x, em: new Date().toISOString() }))])
      setDigitando(false)
    }, 650 + Math.min(1400, r.respostas.join(' ').length * 8))
  }

  function recomecar(primeira?: string) {
    const novo = novoEstado()
    setEstado(novo)
    setFalas([])
    setSinais([])
    if (primeira) window.setTimeout(() => mandar(primeira, novo), 60)
  }

  const f = estado.ficha
  const rpp = rendaPorPessoa(f)
  const dados: [string, string | undefined][] = [
    ['Nome', f.nome],
    ['Para quem', f.para && (f.para === 'proprio' ? 'próprio(a)' : f.para === 'familiar' ? f.quem : f.para)],
    ['Idade', f.idade !== undefined ? `${f.idade} anos` : undefined],
    ['Área', f.area === 'idoso' ? 'BPC/LOAS Idoso' : undefined],
    ['Diagnóstico', f.semDeficiencia ? 'sem doença ou deficiência' : f.diagnostico],
    ['Laudo', f.laudo && `${f.laudo}${f.laudoAno ? ` (${f.laudoAno})` : ''}`],
    ['Fase médica', f.faseMedica],
    ['Rotina', f.rotina],
    ['Tratamento', f.tratamentoTexto],
    ['CadÚnico', f.cadunico],
    ['Pessoas na casa', f.pessoasCasa?.toString()],
    ['Renda da casa', f.rendaCasa !== undefined ? dinheiro(f.rendaCasa) : undefined],
    ['Renda por pessoa', rpp !== undefined ? dinheiro(rpp) : undefined],
    ['Já recebe benefício', f.beneficioProprio],
    ['Outros benefícios', f.outrosBeneficios],
    ['Biometria', f.biometria],
    ['Pedido anterior', f.pedidoAnterior && `${f.pedidoAnterior}${f.tempoNegado ? `, ${f.tempoNegado}` : ''}`],
    ['Horário', f.horario],
    ['Origem', [f.origem, f.campanha].filter(Boolean).join(' · ') || undefined],
    ['Dúvidas', f.duvidas?.join(' | ')],
    ['Anotações', f.anotacoes?.join(' | ')],
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_1fr]">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="rounded-[44px] bg-marinho-950 p-3 shadow-[0_30px_60px_rgba(7,22,41,.35)]">
          <div className="overflow-hidden rounded-[34px] bg-[#efeae2]">
            <div className="flex items-center justify-between bg-marinho-900 px-6 pb-1 pt-3 text-[11px] font-semibold text-white/80">
              <span>{hora(new Date().toISOString())}</span>
              <span className="flex items-center gap-1">
                <Signal className="h-3 w-3" /> <Wifi className="h-3 w-3" />
              </span>
            </div>
            <div className="flex items-center gap-3 bg-marinho-900 px-3 pb-3 pt-1 text-white">
              <ChevronLeft className="h-5 w-5 text-white/70" />
              <SeloCB className="h-9 w-9 rounded-full" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="flex items-center gap-1 text-sm font-bold">
                  CB&amp;AA Advogados <BadgeCheck className="h-3.5 w-3.5 text-ouro-400" />
                </p>
                <p className="text-[11px] text-white/55">{digitando ? 'digitando...' : estado.pausado ? 'equipe vai responder' : 'online'}</p>
              </div>
              <button type="button" onClick={() => recomecar()} title="Recomeçar" aria-label="Recomeçar" className="rounded-full p-2 text-white/60 hover:bg-white/10">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="papel-whatsapp rolagem-fina h-[520px] space-y-2 overflow-y-auto px-3 py-4">
              {falas.length === 0 && (
                <div className="mx-auto mt-6 max-w-[290px] rounded-xl bg-[#fff5c4] px-3 py-2 text-center text-[11px] leading-snug text-slate-600 shadow-sm">
                  Escreva como se fosse a família, ou comece por um dos casos ao lado. Nada aqui vai para o WhatsApp de verdade.
                </div>
              )}
              {falas.map((m, i) => (
                <div key={i} className={`flex ${m.de === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[84%] whitespace-pre-line rounded-xl px-3 py-1.5 text-[13.5px] leading-relaxed shadow-[0_1px_0.5px_rgba(0,0,0,.13)] ${m.de === 'cliente' ? 'rounded-tr-sm bg-[#d9fdd3]' : 'rounded-tl-sm bg-white'}`}>
                    {m.texto}
                    <span className="ml-2 inline-block translate-y-1 text-[10px] text-slate-400">{hora(m.em)}</span>
                  </div>
                </div>
              ))}
              {digitando && (
                <div className="flex justify-start">
                  <div className="digitando flex gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  </div>
                </div>
              )}
              {estado.pausado && !digitando && falas.length > 0 && (
                <div className="flex justify-center pt-2">
                  <span className="rounded-lg bg-ouro-100 px-3 py-1.5 text-center text-[11px] font-bold text-ouro-700">Robô parou: {estado.motivoPausa}</span>
                </div>
              )}
              <div ref={fim} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                mandar(texto)
              }}
              className="flex items-center gap-2 bg-[#f0f2f5] px-2.5 py-2.5"
            >
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem" className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm outline-none" />
              <button type="submit" disabled={!texto.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-marinho-800 text-white disabled:opacity-40" aria-label="Enviar">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => mandar(s)} className="rounded-full border border-marinho-900/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-marinho-700 hover:border-ouro-300">
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <section className="cartao p-5">
          <p className="rotulo mb-3 text-ouro-600">Começar por um caso real</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ATALHOS.map((a) => (
              <button key={a.nome} type="button" onClick={() => recomecar(a.falas[0])} className="botao-claro justify-start text-left text-xs">
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-ouro-600" /> {a.nome}
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="cartao p-5">
            <p className="rotulo text-ouro-600">O que o robô já sabe</p>
            <dl className="mt-3 divide-y divide-marinho-900/[0.05] text-sm">
              {dados.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className={`text-right font-bold ${v ? 'text-marinho-900' : 'text-slate-300'}`}>{v ?? '-'}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="space-y-5">
            <div className="rounded-[22px] bg-marinho-900 p-5 text-white">
              <p className="rotulo text-ouro-300">Contrato que sairia</p>
              <p className="titulo-serif mt-1 flex items-center gap-2 text-2xl">
                <FileSignature className="h-5 w-5 text-ouro-400" />
                {f.laudo || f.idade !== undefined ? (contratoComParteFixa(f) ? 'Com valor fixo (R$ 1.000)' : 'Padrão') : 'Ainda não dá para saber'}
              </p>
              <p className="mt-1 text-xs text-white/50">Definido pelo laudo: sem laudo, pela fase médica parceira, leva o valor fixo. Laudo de qualquer ano e idoso: versão padrão.</p>
            </div>
            <div className="cartao p-5">
              <p className="rotulo text-ouro-600">Sinais para o sistema</p>
              {sinais.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">Etapas, retornos e passagens para a equipe aparecem aqui, na ordem.</p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {sinais.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marinho-500" />
                      <span className="font-semibold text-marinho-800">{rotuloSinal(s)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-4 text-[10px] text-slate-300">Pergunta atual: {estado.ultimaPergunta ?? '-'} · roteiro {VERSAO_DO_ROTEIRO}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
