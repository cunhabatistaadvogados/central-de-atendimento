import type { Etapa } from '@motor/robo'
import { dinheiro, ehIdoso, horariosEntre, proximosLivres, rendaPorPessoa, SALARIO_MINIMO, temLaudo } from '@motor/robo'
import { AlarmClock, Bot, CalendarCheck2, Check, CheckCircle2, Circle, FileSignature, MessagesSquare, Smartphone, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, ChipEtapa, ChipOrigem, ChipPublico, PainelLateral } from '@/components/ui'
import { conflitoDeHorario, horariosOcupados, publicos, textoDoLaudo } from '@/lib/atendimento'
import { ETAPAS, MOTIVOS_DE_PERDA } from '@/lib/escritorio'
import { dataHora, haQuanto } from '@/lib/formato'
import { useGradeDaAgenda } from '@/lib/grade'
import { formatarTelefone, numeroDoWhatsApp } from '@/lib/repositorio'
import { useDados } from '@/lib/store'
import type { Cliente, Documentos } from '@/lib/tipos'
import { Bolhas } from './Conversas'
import EditorDeContrato from './EditorDeContrato'

type AbaFicha = 'resumo' | 'conversa' | 'contrato' | 'historico'

function Linha({ rotulo, valor, alerta }: { rotulo: string; valor?: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-white px-3.5 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{rotulo}</p>
      <p className={`mt-0.5 text-sm font-bold ${valor ? (alerta ? 'text-orange-700' : 'text-marinho-900') : 'text-slate-300'}`}>{valor || 'ainda não contou'}</p>
    </div>
  )
}

const DOCS: [keyof Documentos, string][] = [
  ['rg', 'RG (frente e verso)'],
  ['cpf', 'CPF'],
  ['comprovante', 'Comprovante de endereço'],
  ['cadunico', 'CadÚnico'],
  ['laudo', 'Laudo médico'],
]

function Resumo({ c, autor }: { c: Cliente; autor: string }) {
  const { documentos, resolverPendencia, confirmarReuniao, cancelarReuniao, demonstracao, clientes } = useDados()
  const f = c.robo.ficha
  const rpp = rendaPorPessoa(f)
  // Horario exato que a familia escolheu com o robo ja vem no campo.
  const [data, setData] = useState(() => (c.reuniao?.pedidoEm ? paraCampo(c.reuniao.pedidoEm) : ''))
  const [remarcando, setRemarcando] = useState(false)
  const [avisar, setAvisar] = useState(true)
  const conflito = data ? conflitoDeHorario(clientes, new Date(data).toISOString(), c.id) : undefined
  // Proximos horarios livres da grade (Agenda > Horarios do robo), sem os ja tomados.
  const grade = useGradeDaAgenda(demonstracao)
  const livres = useMemo(() => proximosLivres(new Date(), { grade, ocupados: horariosOcupados(clientes, c.id) }, 6), [grade, clientes, c.id])
  const [dia, hora] = data ? data.split('T') : ['', '']
  // Horas do dia escolhido: as da grade e as meias horas das 7h as 20h.
  const horasDoDia = useMemo(() => {
    const daGrade = dia ? (grade.horarios[String(new Date(`${dia}T12:00`).getDay())] ?? []) : []
    return [...new Set([...daGrade, ...horariosEntre('07:00', '20:30', 30), ...(hora ? [hora] : [])])].sort()
  }, [dia, hora, grade])
  const para = f.para === 'proprio' ? 'O(a) próprio(a)' : f.para === 'filho' ? 'Filho' : f.para === 'filha' ? 'Filha' : f.quem ? f.quem.replace(/^su[ao] /, '').replace(/^./, (x) => x.toUpperCase()) : undefined

  // Horario + aviso a familia: confirmar o pedido do robo, remarcar, ou marcar
  // do zero quando a equipe assumiu antes do robo oferecer horario (23/10/2026).
  // Sem o calendario do navegador (abria por cima da ficha e mostrava minutos
  // soltos): botoes com os proximos horarios livres da grade, e dia + hora.
  const escolherHorario = (rotulo: string) => (
    <>
      {livres.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-slate-500">Próximos horários livres</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {livres.map((iso) => {
              const valor = paraCampo(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setData(valor)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${data === valor ? 'border-marinho-800 bg-marinho-800 text-white' : 'border-marinho-100 bg-white text-marinho-700 hover:bg-marinho-50'}`}
                >
                  {rotuloDoHorario(iso)}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] font-bold text-slate-500">{livres.length > 0 ? 'Ou outro dia e hora' : 'Dia e hora'}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input type="date" value={dia} min={paraCampo(new Date().toISOString()).slice(0, 10)} onChange={(e) => setData(e.target.value ? `${e.target.value}T${hora || '09:00'}` : '')} className="campo w-auto py-2" aria-label="Dia da reunião" />
        <select value={hora} disabled={!dia} onChange={(e) => setData(`${dia}T${e.target.value}`)} className="campo w-auto py-2" aria-label="Hora da reunião">
          {!hora && <option value="">Hora</option>}
          {horasDoDia.map((h) => (
            <option key={h} value={h}>
              {horaCurta(h)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!dia || !hora}
          onClick={() => {
            confirmarReuniao(c.id, new Date(data).toISOString(), autor, avisar)
            setRemarcando(false)
            setData('')
          }}
          className="botao-primario shrink-0 py-2"
        >
          {rotulo}
        </button>
      </div>
      {conflito && <p className="mt-2 text-[11px] font-bold text-red-600">Atenção: {conflito.nome || conflito.telefone} já tem reunião nesse horário.</p>}
      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
        <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="h-3.5 w-3.5 accent-marinho-800" />
        Avisar a família pelo WhatsApp com a data e a hora
      </label>
    </>
  )

  const caminho = [
    { nome: 'Qualificação pelo robô', ok: ['qualificado', 'reuniao', 'contrato', 'contratado'].includes(c.etapa) },
    { nome: 'Reunião com o advogado', ok: Boolean(c.reuniao?.confirmada) },
    { nome: 'Documentos recebidos', ok: Object.values(c.documentos).filter(Boolean).length >= 4 },
    { nome: 'Contrato enviado', ok: c.contrato?.status === 'enviado' || c.contrato?.status === 'assinado' },
    { nome: 'Contrato assinado', ok: c.contrato?.status === 'assinado' },
  ]

  return (
    <div className="space-y-5">
      <section className="cartao p-5">
        <p className="rotulo mb-4 text-ouro-600">Caminho até o contrato</p>
        <ol className="flex flex-wrap items-center gap-2">
          {caminho.map((p, i) => (
            <li key={p.nome} className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${p.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {p.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {p.nome}
              </span>
              {i < caminho.length - 1 && <span className="h-px w-3 bg-slate-200" />}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <p className="rotulo mb-2 px-1 text-ouro-600">O que a família contou ao robô</p>
        <div className="grid gap-2 rounded-[22px] bg-ouro-50/60 p-2 sm:grid-cols-2 lg:grid-cols-3">
          <Linha rotulo="Benefício para" valor={para && `${para}${f.idade !== undefined ? `, ${f.idade} anos` : ''}`} />
          <Linha rotulo="Diagnóstico" valor={ehIdoso(f) ? 'Idoso 65+ (sem laudo)' : f.semDeficiencia ? 'Sem doença ou deficiência' : f.diagnostico} alerta={f.semDeficiencia && !ehIdoso(f)} />
          <Linha rotulo="Laudo" valor={textoDoLaudo(f)} alerta={!temLaudo(f)} />
          <Linha
            rotulo="Fase médica parceira"
            valor={f.faseMedica === 'aceitou' ? 'Aceitou' : f.faseMedica === 'recusou' ? 'Recusou por agora' : f.faseMedica === 'explicada' ? 'Quis saber como funciona' : undefined}
          />
          <Linha rotulo="Rotina" valor={f.rotina} />
          <Linha rotulo="Tratamento" valor={f.tratamentoTexto} />
          <Linha rotulo="CadÚnico" valor={f.cadunico === 'atualizado' ? 'Atualizado' : f.cadunico === 'desatualizado' ? 'Precisa atualizar' : f.cadunico === 'nao' ? 'Não tem' : undefined} alerta={f.cadunico !== 'atualizado'} />
          <Linha rotulo="Casa" valor={f.pessoasCasa !== undefined ? `${f.pessoasCasa} pessoa(s)${f.casaTexto ? `: ${f.casaTexto}` : ''}` : f.casaTexto} />
          <Linha
            rotulo="Renda por pessoa (estimativa)"
            valor={rpp !== undefined ? `${dinheiro(rpp)} (${Math.round((rpp / SALARIO_MINIMO) * 100)}% do mínimo)` : f.rendaCasa !== undefined ? `Casa: ${dinheiro(f.rendaCasa)}` : undefined}
            alerta={rpp !== undefined && rpp > SALARIO_MINIMO / 4}
          />
          <Linha rotulo="Renda, como contou" valor={f.rendaTexto} />
          <Linha
            rotulo="Já recebe benefício (a própria pessoa)"
            valor={f.beneficioProprio === 'sim' ? `Sim${f.beneficioProprioTexto ? ` (${f.beneficioProprioTexto})` : ''}: o advogado olha antes` : f.beneficioProprio === 'nao' ? 'Não' : undefined}
            alerta={f.beneficioProprio === 'sim'}
          />
          <Linha rotulo="Outros benefícios na casa" valor={f.outrosBeneficios === 'sim' ? `Sim${f.outrosBeneficiosTexto ? ` (${f.outrosBeneficiosTexto})` : ''}` : f.outrosBeneficios === 'nao' ? 'Não' : undefined} />
          {ehIdoso(f) && <Linha rotulo="Biometria (CNH, CIN ou título)" valor={f.biometria === 'sim' ? 'Tem' : f.biometria === 'nao' ? 'Não tem: equipe orienta' : undefined} alerta={f.biometria === 'nao'} />}
          <Linha
            rotulo="Pedido anterior no INSS"
            valor={f.pedidoAnterior === 'negado' ? `Negado${f.tempoNegado ? `, ${f.tempoNegado}` : ''}` : f.pedidoAnterior === 'em_analise' ? 'Em análise' : f.pedidoAnterior === 'nao' ? 'Nunca pediu' : f.pedidoAnterior === 'sim' ? 'Já pediu' : undefined}
            alerta={f.diasNegado !== undefined && f.diasNegado <= 30}
          />
          <Linha rotulo="Cidade" valor={f.cidade ?? c.cidade} />
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-400">
          A renda por pessoa é só a soma do que a família contou: quem entra na conta (LOAS, art. 20, §1º e §14) o advogado confere. Regra geral: até 1/4 do salário mínimo
          por pessoa; acima disso há exceções que só o advogado avalia. O robô nunca dá veredito.
        </p>
        {(f.duvidas?.length || f.anotacoes?.length) && (
          <div className="mt-3 space-y-2">
            {(f.duvidas ?? []).map((d, i) => (
              <p key={`d${i}`} className="rounded-2xl bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900">
                <span className="font-extrabold">Dúvida para o advogado:</span> "{d}"
              </p>
            ))}
            {(f.anotacoes ?? []).map((a, i) => (
              <p key={`a${i}`} className="rounded-2xl bg-orange-50 px-3.5 py-2.5 text-xs text-orange-900">
                <span className="font-extrabold">Anotação do robô:</span> {a}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="cartao p-5">
          <p className="rotulo mb-3 text-ouro-600">Documentos</p>
          <div className="space-y-1.5">
            {DOCS.map(([k, nome]) => (
              <label key={k} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ouro-50/60">
                <input type="checkbox" checked={c.documentos[k]} onChange={(e) => documentos(c.id, { ...c.documentos, [k]: e.target.checked })} className="h-4 w-4 accent-marinho-800" />
                <span className={`text-sm ${c.documentos[k] ? 'font-bold text-marinho-900' : 'text-slate-500'}`}>{nome}</span>
                {k === 'laudo' && f.laudo === 'sem' && f.faseMedica !== 'recusou' && <span className="ml-auto text-[10px] font-bold text-orange-600">fase médica</span>}
              </label>
            ))}
          </div>
        </section>

        <section className="cartao p-5">
          <p className="rotulo mb-3 text-ouro-600">Reunião e retornos</p>
          {c.reuniao ? (
            <div className={`rounded-2xl p-3.5 ${c.reuniao.confirmada ? 'bg-emerald-50' : 'bg-orange-50'}`}>
              <p className="flex items-center gap-2 text-sm font-bold">
                <CalendarCheck2 className={`h-4 w-4 ${c.reuniao.confirmada ? 'text-emerald-600' : 'text-orange-600'}`} />
                {c.reuniao.confirmada && c.reuniao.data ? dataHora(c.reuniao.data) : `Pedido: ${c.reuniao.quando}`} · {c.reuniao.advogado}
              </p>
              {c.reuniao.confirmada && !demonstracao && <p className="mt-1 pl-6 text-[11px] text-emerald-700">Na agenda do Outlook do Dr. André, com a Andreia convidada.</p>}
              {(!c.reuniao.confirmada || remarcando) && escolherHorario(remarcando ? 'Remarcar' : 'Confirmar')}
              {c.reuniao.confirmada && !remarcando && (
                <div className="mt-2 flex gap-3 pl-6 text-[11px] font-bold">
                  <button type="button" onClick={() => setRemarcando(true)} className="text-marinho-700 hover:underline">
                    Remarcar
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm('Desmarcar a reunião? Ela sai da agenda do Outlook, volta para "a confirmar" e a família recebe um aviso pelo WhatsApp.') && cancelarReuniao(c.id, autor, avisar)}
                    className="text-red-600 hover:underline"
                  >
                    Desmarcar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Sem reunião ainda. O robô oferece dois horários quando a qualificação termina, ou marque aqui o horário combinado com a família.</p>
              {escolherHorario('Marcar reunião')}
            </div>
          )}
          <div className="mt-3 space-y-2">
            {c.pendencias.length === 0 && <p className="text-xs text-slate-400">Nenhum retorno agendado.</p>}
            {c.pendencias.map((p) => {
              const vencida = !p.resolvida && new Date(p.retornoEm) <= new Date()
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${p.resolvida ? 'border-slate-100 opacity-50' : vencida ? 'border-orange-200 bg-orange-50' : 'border-marinho-900/[0.07]'}`}>
                  <AlarmClock className={`h-4 w-4 shrink-0 ${vencida ? 'text-orange-600' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-bold ${p.resolvida ? 'line-through' : ''}`}>{p.texto}</span>
                    <span className="block text-[10px] text-slate-400">retorno do robô {vencida ? `vencido ${haQuanto(p.retornoEm)}` : `em ${dataHora(p.retornoEm)}`}</span>
                  </span>
                  {!p.resolvida && (
                    <button type="button" onClick={() => resolverPendencia(c.id, p.id)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" title="Resolvida" aria-label="Marcar como resolvida">
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

/**
 * Cliente sem WhatsApp (contrato importado antes do numero, 21/10/2026): a
 * equipe digita e grava no Enter ou ao sair do campo, nunca a cada tecla, para
 * nao gravar numero pela metade.
 */
function SemWhatsApp({ gravar }: { gravar: (telefone: string) => void }) {
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const confirmar = () => {
    const numero = numeroDoWhatsApp(valor)
    if (!numero) return
    if (numero.length < 12 || numero.length > 13) return setErro('Digite com DDD, só números.')
    setErro('')
    gravar(formatarTelefone(numero))
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && confirmar()}
        onBlur={confirmar}
        inputMode="tel"
        aria-label="WhatsApp do cliente"
        placeholder="sem WhatsApp: digite o número"
        className="w-52 rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 text-xs text-white outline-none placeholder:text-white/45 focus:border-ouro-400"
      />
      {erro && <span className="text-ouro-200">{erro}</span>}
    </span>
  )
}

export default function FichaDoCliente({ id, abaInicial, onFechar, abrirConversa, autor }: { id: string; abaInicial?: AbaFicha; onFechar: () => void; abrirConversa: (id: string) => void; autor: string }) {
  const { cliente, moverEtapa, atualizarCliente } = useDados()
  const c = cliente(id)
  const [aba, setAba] = useState<AbaFicha>(abaInicial ?? 'resumo')
  if (!c) return null

  return (
    <PainelLateral aberto onFechar={onFechar}>
      <header className="relative overflow-hidden bg-marinho-900 px-5 pb-0 pt-5 text-white sm:px-7">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ouro-500/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <Avatar nome={c.nome || c.telefone} tamanho="h-14 w-14 text-base" />
          <div className="min-w-0 flex-1">
            <input
              value={c.nome}
              onChange={(e) => atualizarCliente(c.id, { nome: e.target.value })}
              placeholder="Nome do cliente"
              className="titulo-serif w-full rounded-lg bg-transparent text-[28px] leading-tight text-white outline-none placeholder:text-white/30 focus:bg-white/5"
            />
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <Smartphone className="h-3.5 w-3.5" /> {c.telefone || <SemWhatsApp gravar={(telefone) => atualizarCliente(c.id, { telefone })} />} <ChipOrigem origem={c.origem} />
              {publicos(c.robo.ficha).map((p) => (
                <ChipPublico key={p} publico={p} />
              ))}{' '}
              · chegou {haQuanto(c.criadoEm)}
            </p>
            {c.anuncio?.titulo && (
              <p className="mt-1 truncate text-[11px] text-white/45" title={c.anuncio.texto ?? undefined}>
                Anúncio: {c.anuncio.titulo}
              </p>
            )}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar ficha" className="rounded-xl p-2 text-white/60 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <ChipEtapa etapa={c.etapa} />
          <select value={c.etapa} onChange={(e) => moverEtapa(c.id, e.target.value as Etapa, autor)} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white outline-none">
            {ETAPAS.map((e) => (
              <option key={e.chave} value={e.chave} className="text-marinho-900">
                Mover para: {e.nome}
              </option>
            ))}
          </select>
          {/* Perdido pela ficha tambem pede o motivo, como no Funil. */}
          {c.etapa === 'perdido' && (
            <select
              value={c.motivoPerda ?? ''}
              onChange={(e) => moverEtapa(c.id, 'perdido', autor, e.target.value)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold outline-none ${c.motivoPerda ? 'border-white/15 bg-white/10 text-white' : 'border-ouro-300 bg-ouro-500/25 text-ouro-100'}`}
            >
              {!c.motivoPerda && <option value="" disabled className="text-marinho-900">Escolha o motivo</option>}
              {[...new Set([...MOTIVOS_DE_PERDA, ...(c.motivoPerda ? [c.motivoPerda] : [])])].map((m) => (
                <option key={m} value={m} className="text-marinho-900">
                  Motivo: {m}
                </option>
              ))}
            </select>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.robo.pausado ? 'bg-ouro-500/20 text-ouro-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
            <Bot className="h-3 w-3" /> {c.robo.pausado ? 'equipe no comando' : 'robô atendendo'}
          </span>
          <button type="button" onClick={() => abrirConversa(c.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ouro-500 px-3 py-1.5 text-[11px] font-extrabold text-marinho-950 hover:bg-ouro-400">
            <MessagesSquare className="h-3.5 w-3.5" /> Responder no WhatsApp
          </button>
        </div>
        <nav className="relative mt-5 flex gap-1">
          {(
            [
              ['resumo', 'Resumo'],
              ['conversa', 'Conversa'],
              ['contrato', 'Contrato'],
              ['historico', 'Histórico'],
            ] as [AbaFicha, string][]
          ).map(([k, n]) => (
            <button key={k} type="button" onClick={() => setAba(k)} className={`rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${aba === k ? 'bg-papel text-marinho-900' : 'text-white/55 hover:text-white'}`}>
              {k === 'contrato' && <FileSignature className="mr-1 inline h-3.5 w-3.5" />}
              {n}
            </button>
          ))}
        </nav>
      </header>
      <div className="rolagem-fina flex-1 overflow-y-auto p-5 sm:p-7">
        {aba === 'resumo' && <Resumo c={c} autor={autor} />}
        {aba === 'conversa' && (
          <div className="papel-whatsapp space-y-2 rounded-[22px] p-4">
            <Bolhas mensagens={c.mensagens} />
          </div>
        )}
        {aba === 'contrato' && <EditorDeContrato cliente={c} />}
        {aba === 'historico' && (
          <ol className="relative space-y-4 border-l-2 border-ouro-200 pl-6">
            {[...c.eventos].reverse().map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-papel ${e.tipo === 'robo' ? 'bg-marinho-600' : e.tipo === 'contrato' ? 'bg-ouro-500' : e.tipo === 'etapa' ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                <p className="text-sm font-semibold text-marinho-900">{e.texto}</p>
                <p className="text-[11px] text-slate-400">{dataHora(e.em)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </PainelLateral>
  )
}

/** ISO para o valor do <input type="datetime-local"> (hora do computador). */
/** "seg 26/10, 9h" para o botao do horario livre. */
function rotuloDoHorario(iso: string): string {
  const d = new Date(iso)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return `${semana} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${horaCurta(paraCampo(iso).slice(11))}`
}

/** "09:00" -> "9h"; "13:40" -> "13h40". */
function horaCurta(h: string): string {
  const [a, b] = h.split(':')
  return `${Number(a)}h${b === '00' ? '' : b}`
}

function paraCampo(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
