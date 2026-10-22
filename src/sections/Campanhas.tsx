import { Megaphone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Vazio } from '@/components/ui'
import { publicos } from '@/lib/atendimento'
import { ORIGENS } from '@/lib/escritorio'
import { pct } from '@/lib/formato'
import { useDados } from '@/lib/store'
import type { Cliente } from '@/lib/tipos'

/*
 * Campanhas (pedido do Edu em 21/10/2026): de onde vem cada contato e ate onde
 * ele chegou. Uma linha por anuncio do Meta (titulo do referral) ou por
 * origem + publico (o Google nao manda nada, so a frase do link da campanha).
 *
 * Conta so quem escreveu pelo WhatsApp: o historico do Pixel Hub e os
 * contratos importados sao de antes das campanhas e inflariam o "Anuncio".
 */

type Periodo = '7' | '30' | '90' | 'tudo'
type Publico = 'todos' | 'Autista' | 'Idoso'

const QUALIFICADO = ['qualificado', 'reuniao', 'contrato', 'contratado']
const REUNIAO = ['reuniao', 'contrato', 'contratado']

interface Linha {
  nome: string
  origem: string
  contatos: number
  qualificados: number
  reunioes: number
  assinados: number
}

function nomeDaCampanha(c: Cliente): string {
  if (c.anuncio?.titulo) return c.anuncio.titulo
  const p = publicos(c.robo.ficha)
  return p.length ? `${ORIGENS[c.origem] ?? c.origem} · ${p.join(' e ')}` : (ORIGENS[c.origem] ?? c.origem)
}

function somar(lista: Cliente[], nome: string, origem: string): Linha {
  return {
    nome,
    origem,
    contatos: lista.length,
    qualificados: lista.filter((c) => QUALIFICADO.includes(c.etapa)).length,
    reunioes: lista.filter((c) => REUNIAO.includes(c.etapa) || c.reuniao).length,
    assinados: lista.filter((c) => c.contrato?.status === 'assinado' || c.etapa === 'contratado').length,
  }
}

function Taxa({ de, para }: { de: number; para: number }) {
  return <span className="ml-1 text-[11px] font-semibold text-slate-400">{de ? pct(para / de) : ''}</span>
}

export default function Campanhas() {
  const { clientes } = useDados()
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [publico, setPublico] = useState<Publico>('todos')

  const daCampanha = useMemo(() => {
    const limite = periodo === 'tudo' ? 0 : Date.now() - Number(periodo) * 86400000
    return clientes.filter(
      (c) =>
        !c.historico &&
        c.mensagens.some((m) => m.de === 'cliente') &&
        new Date(c.criadoEm).getTime() >= limite &&
        (publico === 'todos' || publicos(c.robo.ficha).includes(publico)),
    )
  }, [clientes, periodo, publico])

  const porOrigem = useMemo(
    () =>
      Object.entries(ORIGENS)
        .map(([k, nome]) => somar(daCampanha.filter((c) => c.origem === k), nome, k))
        .filter((l) => l.contatos > 0),
    [daCampanha],
  )

  const porCampanha = useMemo(() => {
    const grupos = new Map<string, Cliente[]>()
    for (const c of daCampanha) {
      const nome = nomeDaCampanha(c)
      grupos.set(nome, [...(grupos.get(nome) ?? []), c])
    }
    return [...grupos.entries()].map(([nome, lista]) => somar(lista, nome, lista[0].origem)).sort((a, b) => b.contatos - a.contatos)
  }, [daCampanha])

  const total = somar(daCampanha, 'Total', '')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-white p-1 text-xs font-bold shadow-sm">
          {(
            [
              ['7', '7 dias'],
              ['30', '30 dias'],
              ['90', '90 dias'],
              ['tudo', 'Tudo'],
            ] as [Periodo, string][]
          ).map(([k, n]) => (
            <button key={k} type="button" onClick={() => setPeriodo(k)} className={`rounded-lg px-3 py-1.5 transition ${periodo === k ? 'bg-marinho-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-white p-1 text-xs font-bold shadow-sm">
          {(['todos', 'Autista', 'Idoso'] as Publico[]).map((k) => (
            <button key={k} type="button" onClick={() => setPublico(k)} className={`rounded-lg px-3 py-1.5 transition ${publico === k ? 'bg-ouro-500 text-marinho-950' : 'text-slate-500 hover:bg-slate-100'}`}>
              {k === 'todos' ? 'Todos os públicos' : k}
            </button>
          ))}
        </div>
      </div>

      {daCampanha.length === 0 ? (
        <div className="cartao">
          <Vazio icone={<Megaphone className="h-6 w-6" />} titulo="Nenhum contato neste período" texto="Mude o período ou o público." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {porOrigem.map((o) => (
              <div key={o.origem} className="cartao p-4 sm:p-5">
                <p className="rotulo text-slate-400">{o.nome}</p>
                <p className="titulo-serif mt-2 text-[36px] leading-none text-marinho-900">{o.contatos}</p>
                <p className="mt-1 text-xs text-slate-500">contatos</p>
                <p className="mt-3 text-xs font-semibold text-marinho-800">
                  {o.assinados} contrato{o.assinados === 1 ? '' : 's'} <span className="text-emerald-600">({pct(o.assinados / o.contatos)})</span>
                </p>
              </div>
            ))}
          </div>

          <div className="cartao overflow-hidden">
            <div className="border-b border-marinho-900/[0.06] px-5 py-4">
              <h2 className="titulo-serif text-2xl">Por campanha</h2>
              <p className="mt-1 text-xs text-slate-500">Anúncio do Meta pelo título. Google e site pela frase do link e pelo público (autista ou idoso).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="rotulo border-b border-marinho-900/[0.06] text-slate-400">
                    <th className="px-5 py-3 font-extrabold">Campanha</th>
                    <th className="px-3 py-3 text-right font-extrabold">Contatos</th>
                    <th className="px-3 py-3 text-right font-extrabold">Qualificados</th>
                    <th className="px-3 py-3 text-right font-extrabold">Reuniões</th>
                    <th className="px-5 py-3 text-right font-extrabold">Contratos</th>
                  </tr>
                </thead>
                <tbody>
                  {[...porCampanha, total].map((l) => (
                    <tr key={l.nome} className={`border-b border-marinho-900/[0.04] ${l.nome === 'Total' ? 'bg-ouro-50/60 font-extrabold' : ''}`}>
                      <td className="px-5 py-3">
                        <span className="font-bold text-marinho-900">{l.nome}</span>
                        {l.origem && l.nome !== ORIGENS[l.origem] && <span className="ml-2 text-[11px] text-slate-400">{ORIGENS[l.origem]}</span>}
                      </td>
                      <td className="px-3 py-3 text-right">{l.contatos}</td>
                      <td className="px-3 py-3 text-right">
                        {l.qualificados}
                        <Taxa de={l.contatos} para={l.qualificados} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {l.reunioes}
                        <Taxa de={l.contatos} para={l.reunioes} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {l.assinados}
                        <Taxa de={l.contatos} para={l.assinados} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[11px] text-slate-400">
              Conta só quem escreveu pelo WhatsApp a partir da data de entrada. O histórico do Pixel Hub e os contratos importados ficam de fora. A porcentagem é sobre os contatos da linha.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
