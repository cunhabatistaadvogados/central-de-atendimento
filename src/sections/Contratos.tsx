import { ArrowUpRight, FileSignature } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Vazio } from '@/components/ui'
import { faltando } from '@/lib/contrato'
import { haQuanto } from '@/lib/formato'
import { useDados } from '@/lib/store'
import type { StatusContrato } from '@/lib/tipos'

const STATUS: { chave: StatusContrato; nome: string; cor: string; texto: string }[] = [
  { chave: 'rascunho', nome: 'Em preparo', cor: 'bg-slate-100 text-slate-600', texto: 'Falta dado ou o OK do advogado' },
  { chave: 'pronto', nome: 'Pronto para enviar', cor: 'bg-ouro-100 text-ouro-700', texto: 'Advogado liberou; é só mandar' },
  { chave: 'enviado', nome: 'Aguardando assinatura', cor: 'bg-marinho-100 text-marinho-700', texto: 'Link do D4Sign com a família' },
  { chave: 'assinado', nome: 'Assinado', cor: 'bg-emerald-100 text-emerald-700', texto: 'Contrato fechado' },
]

type AbrirCliente = (id: string, aba?: 'resumo' | 'conversa' | 'contrato' | 'historico') => void

export default function Contratos({ abrirCliente }: { abrirCliente: AbrirCliente }) {
  const { clientes } = useDados()
  const [filtro, setFiltro] = useState<StatusContrato | 'todos'>('todos')
  const comContrato = clientes.filter((c) => c.contrato && c.etapa !== 'perdido')
  const lista = comContrato.filter((c) => filtro === 'todos' || c.contrato!.status === filtro)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS.map((s) => {
          const n = comContrato.filter((c) => c.contrato!.status === s.chave).length
          const ativo = filtro === s.chave
          return (
            <button
              key={s.chave}
              type="button"
              onClick={() => setFiltro(ativo ? 'todos' : s.chave)}
              className={`rounded-[22px] border p-5 text-left transition ${ativo ? 'border-ouro-400 bg-ouro-50 shadow-cartao' : 'cartao hover:border-ouro-300'}`}
            >
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${s.cor}`}>{s.nome}</span>
              <p className="titulo-serif mt-3 text-[42px] leading-none">{n}</p>
              <p className="mt-1 text-xs text-slate-500">{s.texto}</p>
            </button>
          )
        })}
      </div>

      <section className="cartao overflow-hidden">
        <div className="flex items-center justify-between border-b border-marinho-900/[0.06] px-5 py-4">
          <h2 className="titulo-serif text-2xl">{filtro === 'todos' ? 'Todos os contratos' : STATUS.find((s) => s.chave === filtro)?.nome}</h2>
          <p className="text-xs text-slate-400">O rascunho nasce sozinho quando a família escolhe o horário da reunião.</p>
        </div>
        {lista.length === 0 ? (
          <Vazio icone={<FileSignature className="h-6 w-6" />} titulo="Nenhum contrato aqui" texto="Quando o robô marcar uma reunião, o contrato aparece já na versão certa." />
        ) : (
          <ul className="divide-y divide-marinho-900/[0.05]">
            {lista.map((c) => {
              const k = c.contrato!
              const st = STATUS.find((s) => s.chave === k.status)!
              const faltam = faltando(k.dados)
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => abrirCliente(c.id, 'contrato')} className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-ouro-50/50">
                    <Avatar nome={c.nome || c.telefone} />
                    <span className="min-w-[180px] flex-1">
                      <span className="block text-sm font-bold">{k.dados.menor ? k.dados.nome || 'Criança (nome a preencher)' : k.dados.nome || c.nome}</span>
                      <span className="block text-xs text-slate-500">
                        {k.dados.menor ? `representado(a) por ${k.dados.repNome || c.nome}` : 'contratante maior de idade'}
                      </span>
                    </span>
                    <span className="w-48 text-xs">
                      <span className="block font-bold text-marinho-800">{k.comParteFixa ? 'R$ 1.000 + 3 SM + 30%' : '3 SM + 30% dos atrasados'}</span>
                      <span className="text-slate-400">{k.comParteFixa ? 'versão sem laudo' : 'versão padrão'}</span>
                    </span>
                    <span className="w-44 text-xs">
                      {faltam.length ? <span className="font-semibold text-orange-600">Falta: {faltam[0]}{faltam.length > 1 ? ` +${faltam.length - 1}` : ''}</span> : <span className="font-semibold text-emerald-600">Dados completos</span>}
                      <span className="block text-slate-400">{k.okAdvogado ? 'OK do advogado' : 'sem OK do advogado'}</span>
                    </span>
                    <span className="w-40 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${st.cor}`}>{st.nome}</span>
                    </span>
                    <span className="w-20 text-right text-[11px] text-slate-400">{haQuanto(k.assinadoEm ?? k.enviadoEm ?? k.geradoEm ?? c.atualizadoEm)}</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
