import { Check, Copy, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Campo, Modal } from '@/components/ui'
import type { TextoPersonalizado } from '@/lib/textos-personalizados'

/**
 * Textos personalizados da equipe (pedido do Edu, 23/10/2026): criar, editar,
 * copiar e usar na resposta. Todos da equipe veem a mesma lista.
 */
export default function TextosPersonalizados({
  aberto,
  onFechar,
  textos,
  erro,
  textoDaResposta,
  onUsar,
  salvar,
  apagar,
}: {
  aberto: boolean
  onFechar: () => void
  textos: TextoPersonalizado[]
  erro: string
  /** O que ja esta escrito na caixa de resposta: vira um texto novo com um clique. */
  textoDaResposta: string
  onUsar: (texto: string) => void
  salvar: (t: { id?: string; titulo: string; texto: string }) => Promise<void>
  apagar: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<{ id?: string; titulo: string; texto: string }>({ titulo: '', texto: '' })
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const fechar = () => {
    setForm({ titulo: '', texto: '' })
    setAviso('')
    setApagando(null)
    onFechar()
  }

  const gravar = async () => {
    setSalvando(true)
    setAviso('')
    try {
      await salvar(form)
      setForm({ titulo: '', texto: '' })
      setAviso(form.id ? 'Texto atualizado.' : 'Texto salvo. Já aparece para toda a equipe.')
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const copiar = (t: TextoPersonalizado) =>
    void navigator.clipboard
      .writeText(t.texto)
      .then(() => {
        setCopiado(t.id)
        window.setTimeout(() => setCopiado(null), 1500)
      })
      .catch(() => setAviso('O navegador não deixou copiar: use o botão "Usar".'))

  return (
    <Modal aberto={aberto} onFechar={fechar} titulo="Textos personalizados">
      <div className="rolagem-fina -mr-2 max-h-[70vh] space-y-5 overflow-y-auto pr-2">
        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erro}</p>}

        <div className="space-y-3 rounded-2xl border border-marinho-900/10 bg-papel p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-marinho-700">{form.id ? 'Editar texto' : 'Novo texto'}</p>
          <Campo rotulo="Título" dica="Aparece no botão da conversa. Ex.: Apresentação do Dr. André">
            <input className="campo" maxLength={60} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </Campo>
          <Campo rotulo="Texto">
            <textarea className="campo min-h-[140px] resize-y" maxLength={4000} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          </Campo>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="botao-primario" disabled={salvando || !form.titulo.trim() || !form.texto.trim() || Boolean(erro)} onClick={gravar}>
              {salvando ? 'Salvando...' : form.id ? 'Salvar alteração' : 'Salvar texto'}
            </button>
            {!form.id && textoDaResposta.trim() && !form.texto && (
              <button type="button" className="botao-claro text-xs" onClick={() => setForm({ ...form, texto: textoDaResposta })}>
                Usar o que escrevi na resposta
              </button>
            )}
            {form.id && (
              <button type="button" className="botao-claro text-xs" onClick={() => setForm({ titulo: '', texto: '' })}>
                Cancelar
              </button>
            )}
          </div>
          {aviso && <p className="text-xs font-semibold text-marinho-700">{aviso}</p>}
        </div>

        {textos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum texto ainda. O primeiro que você salvar aparece aqui e nos botões da conversa.</p>
        ) : (
          <ul className="space-y-3">
            {textos.map((t) => (
              <li key={t.id} className="rounded-2xl border border-marinho-900/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-marinho-900">{t.titulo}</p>
                    {t.autor && <p className="text-[11px] text-slate-400">por {t.autor}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => copiar(t)} title="Copiar" aria-label={`Copiar ${t.titulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-marinho-800">
                      {copiado === t.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setForm({ id: t.id, titulo: t.titulo, texto: t.texto })} title="Editar" aria-label={`Editar ${t.titulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-marinho-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {apagando === t.id ? (
                      <button
                        type="button"
                        onClick={() => void apagar(t.id).then(() => setApagando(null)).catch((e: Error) => setAviso(e.message))}
                        className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Apagar mesmo?
                      </button>
                    ) : (
                      <button type="button" onClick={() => setApagando(t.id)} title="Apagar" aria-label={`Apagar ${t.titulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">{t.texto}</p>
                <button
                  type="button"
                  onClick={() => {
                    onUsar(t.texto)
                    fechar()
                  }}
                  className="mt-3 rounded-full border border-ouro-200 bg-ouro-50 px-3 py-1 text-[11px] font-bold text-ouro-700 hover:bg-ouro-100"
                >
                  Usar na resposta
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400">Todos da equipe veem e podem usar estes textos. Os 4 textos prontos do escritório continuam nos botões da conversa.</p>
      </div>
    </Modal>
  )
}
