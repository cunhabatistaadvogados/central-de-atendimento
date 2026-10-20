import { Camera, EyeOff, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import AjustarFoto from '@/components/AjustarFoto'
import { iniciais } from '@/lib/atendimento'
import { linkDaFoto, PAPEIS, type Membro, type Online } from '@/lib/equipe'

/**
 * As fotinhas no topo, igual ao sistema do Marcello (pedido do Edu em
 * 19/10/2026; antes era um cartao no pe do menu): colegas online lado a lado
 * com o ponto verde e a sua por ultimo, com o anel pulsando, clicavel para
 * trocar a foto. O desenvolvedor ve a propria com o olho cortado, porque para
 * a equipe ele nunca aparece.
 */

function Foto({ nome, caminho, tamanho, classe = '' }: { nome: string; caminho?: string | null; tamanho: number; classe?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void linkDaFoto(caminho).then((u) => vivo && setUrl(u))
    return () => {
      vivo = false
    }
  }, [caminho])
  const estilo = { width: tamanho, height: tamanho }
  return url ? (
    <img src={url} alt={nome} style={estilo} className={`rounded-full object-cover ${classe}`} />
  ) : (
    <span style={{ ...estilo, fontSize: tamanho * 0.32 }} className={`flex items-center justify-center rounded-full bg-marinho-800 font-extrabold text-white ${classe}`}>
      {iniciais(nome)}
    </span>
  )
}

export default function QuemEstaOnline({
  online,
  eu,
  minhaFoto = null,
  mostrarColegas = true,
  compacto = false,
  onEscolherFoto,
}: {
  online: Online[]
  eu?: Membro | null
  minhaFoto?: string | null
  mostrarColegas?: boolean
  compacto?: boolean
  onEscolherFoto?: (arquivo: File) => Promise<void>
}) {
  const colegas = mostrarColegas ? online.filter((p) => p.user_id !== eu?.user_id) : []
  const entrada = useRef<HTMLInputElement>(null)
  const [paraAjustar, setParaAjustar] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  if (compacto) {
    if (!colegas.length) return null
    return (
      <div className="flex -space-x-2" title={colegas.map((p) => p.nome).join(', ')}>
        {colegas.slice(0, 3).map((p) => (
          <span key={p.user_id} className="relative">
            <Foto nome={p.nome} caminho={p.foto} tamanho={32} classe="ring-2 ring-marinho-900" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-marinho-900" />
          </span>
        ))}
      </div>
    )
  }

  function escolher(arquivo: File | undefined) {
    if (entrada.current) entrada.current.value = ''
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha uma imagem.')
      window.setTimeout(() => setErro(''), 6000)
      return
    }
    setErro('')
    setParaAjustar(arquivo)
  }

  async function salvarAjustada(foto: File) {
    if (!onEscolherFoto) return
    setEnviando(true)
    try {
      await onEscolherFoto(foto)
      setParaAjustar(null)
    } catch (causa) {
      setParaAjustar(null)
      setErro(causa instanceof Error ? causa.message : 'Não foi possível trocar a foto.')
      window.setTimeout(() => setErro(''), 8000)
    } finally {
      setEnviando(false)
    }
  }

  // Lado a lado, sem sobrepor: sobrepostas, uma cobria o ponto verde da
  // outra (licao do sistema do Marcello).
  const visiveis = colegas.slice(0, 4)
  const resto = colegas.length - visiveis.length
  const invisivel = eu?.papel === 'desenvolvedor' || eu?.aparece_online === false
  return (
    <div className="relative flex items-center">
      {visiveis.length > 0 && (
        <div className="mr-2 flex items-center gap-1.5" aria-label={`${colegas.length} colega(s) online`}>
          {visiveis.map((p) => (
            <span key={p.user_id} className="relative" title={`${p.nome} · ${PAPEIS[p.papel]} · online`}>
              <Foto nome={p.nome} caminho={p.foto} tamanho={40} classe="ring-2 ring-papel" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-papel" />
            </span>
          ))}
          {resto > 0 && (
            <span
              title={colegas.slice(visiveis.length).map((p) => p.nome).join(', ')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-marinho-100 text-[11px] font-extrabold text-marinho-800 ring-2 ring-papel"
            >
              +{resto}
            </span>
          )}
        </div>
      )}

      {eu && (
        <>
          {/* Voce: clique para trocar a foto. */}
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando || !onEscolherFoto}
            title={`${eu.nome} · ${PAPEIS[eu.papel]}${invisivel ? ' · invisível para a equipe' : ''} · trocar foto`}
            aria-label="Trocar minha foto"
            className="foto-pulsante group relative rounded-full transition hover:scale-105 disabled:cursor-wait"
          >
            <Foto nome={eu.nome} caminho={minhaFoto} tamanho={40} />
            <span className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition ${enviando ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {enviando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </span>
            {invisivel && (
              <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-500 text-white ring-2 ring-papel">
                <EyeOff className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
          <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
        </>
      )}

      {paraAjustar && <AjustarFoto arquivo={paraAjustar} onCancelar={() => setParaAjustar(null)} onSalvar={salvarAjustada} />}

      {erro && <p className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 shadow-lg">{erro}</p>}
    </div>
  )
}
