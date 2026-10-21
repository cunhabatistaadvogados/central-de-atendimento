import type { Etapa } from '@motor/robo'
import { Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, ChipEtapa, ChipOrigem, ChipPublico, Vazio } from '@/components/ui'
import { publicos, textoDoLaudo } from '@/lib/atendimento'
import { ETAPAS } from '@/lib/escritorio'
import { dinheiro, rendaPorPessoa, temLaudo } from '@motor/robo'
import { haQuanto } from '@/lib/formato'
import { useDados } from '@/lib/store'

export default function Clientes({ abrirCliente }: { abrirCliente: (id: string) => void }) {
  const { clientes } = useDados()
  const [busca, setBusca] = useState('')
  const [etapa, setEtapa] = useState<Etapa | 'todas'>('todas')

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return clientes.filter((c) => (etapa === 'todas' || c.etapa === etapa) && (!b || c.nome.toLowerCase().includes(b) || c.telefone.includes(b)))
  }, [clientes, busca, etapa])

  return (
    <div className="cartao overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-marinho-900/[0.06] p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" className="campo pl-9" />
        </div>
        <select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa | 'todas')} className="campo sm:w-56">
          <option value="todas">Todas as etapas</option>
          {ETAPAS.map((e) => (
            <option key={e.chave} value={e.chave}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>
      {lista.length === 0 ? (
        <Vazio icone={<UsersRound className="h-6 w-6" />} titulo="Ninguém encontrado" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="rotulo border-b border-marinho-900/[0.06] text-slate-400">
                <th className="px-5 py-3 font-extrabold">Cliente</th>
                <th className="px-3 py-3 font-extrabold">Para quem</th>
                <th className="px-3 py-3 font-extrabold">Laudo</th>
                <th className="px-3 py-3 font-extrabold">Renda por pessoa</th>
                <th className="px-3 py-3 font-extrabold">Etapa</th>
                <th className="px-5 py-3 text-right font-extrabold">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const f = c.robo.ficha
                const rpp = rendaPorPessoa(f)
                return (
                  <tr key={c.id} onClick={() => abrirCliente(c.id)} className="cursor-pointer border-b border-marinho-900/[0.04] transition hover:bg-ouro-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nome={c.nome || c.telefone} tamanho="h-9 w-9 text-[11px]" />
                        <div>
                          <p className="font-bold">{c.nome || 'Sem nome ainda'}</p>
                          <p className="flex items-center gap-1.5 text-xs text-slate-400">
                            {c.telefone || 'sem WhatsApp'} <ChipOrigem origem={c.origem} />
                            {publicos(f).map((p) => (
                              <ChipPublico key={p} publico={p} />
                            ))}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {f.para === 'proprio' ? 'Próprio(a)' : f.para === 'filha' ? 'Filha' : f.para === 'filho' ? 'Filho' : (f.quem ?? '-')}
                      {f.idade !== undefined && <span className="text-slate-400"> · {f.idade} anos</span>}
                      {f.diagnostico && <span className="block text-[11px] text-slate-400">{f.diagnostico}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">{f.laudo ? <span className={`font-bold ${temLaudo(f) ? 'text-emerald-700' : 'text-orange-700'}`}>{textoDoLaudo(f)?.replace(' (sem valores até a equipe ver)', '')}</span> : '-'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{rpp !== undefined ? dinheiro(rpp) : '-'}</td>
                    <td className="px-3 py-3">
                      <ChipEtapa etapa={c.etapa} />
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">{haQuanto(c.atualizadoEm)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
