import { CalendarDays, Clock, Settings2, Video } from 'lucide-react'
import { useState } from 'react'
import { Avatar, ChipEtapa, Vazio } from '@/components/ui'
import { mesmoDia } from '@/lib/formato'
import { useDados } from '@/lib/store'
import type { Cliente } from '@/lib/tipos'
import HorariosDoRobo from './HorariosDoRobo'

function Grupo({ titulo, itens, abrirCliente, destaque = false }: { titulo: string; itens: Cliente[]; abrirCliente: (id: string) => void; destaque?: boolean }) {
  if (!itens.length) return null
  return (
    <section>
      <p className={`rotulo mb-3 px-1 ${destaque ? 'text-orange-600' : 'text-ouro-600'}`}>
        {titulo} · {itens.length}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {itens.map((c) => {
          const r = c.reuniao!
          // Pedido com horario exato (escolhido com o robo) tambem mostra a data.
          const quando = r.confirmada ? r.data : r.pedidoEm
          const d = quando ? new Date(quando) : null
          return (
            <button key={c.id} type="button" onClick={() => abrirCliente(c.id)} className="cartao flex gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-ouro-300">
              <div className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${r.confirmada ? 'bg-marinho-800 text-white' : 'bg-orange-50 text-orange-700'}`}>
                {d ? (
                  <>
                    <span className="text-[10px] font-bold uppercase opacity-70">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                    <span className="titulo-serif text-2xl leading-none">{d.getDate()}</span>
                    <span className="text-[11px] font-bold text-ouro-300">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Avatar nome={c.nome || c.telefone} tamanho="h-7 w-7 text-[10px]" />
                  <p className="truncate text-sm font-bold">{c.nome || c.telefone}</p>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Video className="h-3.5 w-3.5" /> {r.advogado} · {r.confirmada ? 'confirmada' : `pedido: ${r.quando}`}
                </p>
                <div className="mt-2">
                  <ChipEtapa etapa={c.etapa} compacto />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function Agenda({ abrirCliente, autor }: { abrirCliente: (id: string) => void; autor: string }) {
  const { clientes } = useDados()
  const [grade, setGrade] = useState(false)
  const hoje = new Date()
  const amanha = new Date(hoje.getTime() + 86400000)
  const com = clientes.filter((c) => c.reuniao && c.etapa !== 'perdido')
  const aConfirmar = com.filter((c) => !c.reuniao!.confirmada)
  const confirmadas = com.filter((c) => c.reuniao!.confirmada && c.reuniao!.data).sort((a, b) => a.reuniao!.data!.localeCompare(b.reuniao!.data!))
  const deHoje = confirmadas.filter((c) => mesmoDia(new Date(c.reuniao!.data!), hoje))
  const deAmanha = confirmadas.filter((c) => mesmoDia(new Date(c.reuniao!.data!), amanha))
  const proximas = confirmadas.filter((c) => new Date(c.reuniao!.data!) > amanha && !mesmoDia(new Date(c.reuniao!.data!), amanha))
  const passadas = confirmadas.filter((c) => new Date(c.reuniao!.data!) < hoje && !mesmoDia(new Date(c.reuniao!.data!), hoje))

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button type="button" onClick={() => setGrade((v) => !v)} className={grade ? 'botao-primario py-2' : 'botao-claro py-2'}>
          <Settings2 className="h-4 w-4" /> Horários do robô
        </button>
      </div>
      {grade && <HorariosDoRobo autor={autor} />}
      {!com.length && <Vazio icone={<CalendarDays className="h-6 w-6" />} titulo="Agenda vazia" texto="Quando o robô terminar uma qualificação, ele oferece dois horários livres e o pedido aparece aqui." />}
      <Grupo titulo="Pedidas pelo robô, a confirmar" itens={aConfirmar} abrirCliente={abrirCliente} destaque />
      <Grupo titulo="Hoje" itens={deHoje} abrirCliente={abrirCliente} />
      <Grupo titulo="Amanhã" itens={deAmanha} abrirCliente={abrirCliente} />
      <Grupo titulo="Próximos dias" itens={proximas} abrirCliente={abrirCliente} />
      <Grupo titulo="Já aconteceram" itens={passadas} abrirCliente={abrirCliente} />
    </div>
  )
}
