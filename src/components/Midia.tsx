import { FileText, Paperclip, Reply, X } from 'lucide-react'
import { useEffect, useState, type TouchEvent } from 'react'
import { linkDaMidia } from '@/lib/repositorio'
import type { Mensagem, TipoMidia } from '@/lib/tipos'

/*
 * Foto, audio, video e documento dentro do balao, e a resposta citada, nos
 * dois visuais das Conversas e no Historico (pedido do Edu em 21/10/2026:
 * "tem que ter todas funcionalidades do zap"). Duas origens de arquivo:
 * - o que chega pela Meta, guardado no bucket privado "midias" (link temporario);
 * - o anexo do Pixel Hub, que veio no texto como "[anexo] https://..." (link publico).
 */

// Mesmo rotulo do webhook e do whatsapp-send: e o texto gravado quando nao ha legenda.
export const ROTULO_MIDIA: Record<TipoMidia, string> = { imagem: '📷 Foto', audio: '🎤 Áudio', video: '🎥 Vídeo', documento: '📄 Documento', figurinha: '🌟 Figurinha' }

const ANEXO = /\[anexo\]\s+(\S+)/g

function tipoPeloLink(url: string): TipoMidia {
  const ext = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'imagem'
  if (ext === 'webp') return 'figurinha'
  if (['ogg', 'oga', 'opus', 'mp3', 'm4a', 'aac', 'amr', 'wav'].includes(ext)) return 'audio'
  if (['mp4', '3gp', 'mov', 'webm'].includes(ext)) return 'video'
  return 'documento'
}

function nomeDoLink(url: string): string {
  try {
    return decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'arquivo')
  } catch {
    return 'arquivo'
  }
}

/** O texto que sobra no balao: sem os "[anexo] link" e sem o rotulo da midia. */
export function textoSemMidia(m: Mensagem): string {
  const t = m.texto.replace(ANEXO, '').trim()
  if (m.midiaTipo && (t === ROTULO_MIDIA[m.midiaTipo] || (m.midiaNome && t === `📄 ${m.midiaNome}`))) return ''
  return t
}

/** Texto curto da mensagem: lista de conversas e citacao. */
export function previaDaMensagem(m: Mensagem): string {
  const t = textoSemMidia(m)
  if (t) return t
  if (m.midiaTipo) return m.midiaTipo === 'documento' ? `📄 ${m.midiaNome ?? 'Documento'}` : ROTULO_MIDIA[m.midiaTipo]
  const anexo = m.texto.match(/\[anexo\]\s+(\S+)/)
  return anexo ? ROTULO_MIDIA[tipoPeloLink(anexo[1])] : ''
}

export function podeCitar(m: Mensagem): boolean {
  // So o que tem id da Meta: mensagem do Pixel Hub ou da demonstracao nao tem.
  return Boolean(m.wamid?.startsWith('wamid.'))
}

export function quemFalou(m: Mensagem, nomeDoCliente: string): string {
  return m.de === 'cliente' ? nomeDoCliente || 'Cliente' : m.de === 'robo' ? 'Mary CB&AA' : m.autor || 'Equipe'
}

// Link temporario por caminho, guardado na memoria da aba: a lista rola e o
// balao remonta, sem pedir outro link ao banco a cada vez.
const links = new Map<string, { url: string | null; ate: number }>()

function useLink(caminho?: string): string | null | undefined {
  const [, redesenhar] = useState(0)
  const guardado = caminho ? links.get(caminho) : undefined
  const pronto = guardado !== undefined && guardado.ate > Date.now()
  useEffect(() => {
    if (!caminho || pronto) return
    let vivo = true
    linkDaMidia(caminho)
      .then(
        (url) => links.set(caminho, { url, ate: Date.now() + 5 * 3600000 }),
        () => links.set(caminho, { url: null, ate: Date.now() + 60000 }),
      )
      .then(() => vivo && redesenhar((n) => n + 1))
    return () => {
      vivo = false
    }
  }, [caminho, pronto])
  return pronto ? guardado.url : undefined
}

function Arquivo({ tipo, url, nome }: { tipo: TipoMidia; url: string; nome?: string }) {
  if (tipo === 'imagem' || tipo === 'figurinha')
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={nome ?? ROTULO_MIDIA[tipo]}
          loading="lazy"
          className={tipo === 'figurinha' ? 'h-32 w-32 object-contain' : 'max-h-72 w-full max-w-[300px] rounded-md bg-black/5 object-cover'}
        />
      </a>
    )
  // preload none: o historico tem mais de mil audios, so baixa quando tocar.
  if (tipo === 'audio') return <audio controls preload="none" src={url} className="h-10 w-[260px] max-w-full" />
  if (tipo === 'video') return <video controls preload="metadata" src={url} className="max-h-72 w-full max-w-[300px] rounded-md bg-black" />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex max-w-[300px] items-center gap-2 rounded-md bg-black/5 px-3 py-2 text-[13px] font-semibold text-[#111b21] hover:bg-black/10">
      <FileText className="h-5 w-5 shrink-0 text-[#d94f3d]" />
      <span className="min-w-0 truncate">{nome ?? 'Documento'}</span>
    </a>
  )
}

/** A midia da mensagem (da Meta ou do Pixel Hub), em cima do texto do balao. */
export function MidiaDaMensagem({ m }: { m: Mensagem }) {
  const link = useLink(m.midia)
  const anexos = [...m.texto.matchAll(ANEXO)].map((a) => a[1])
  if (!m.midiaTipo && anexos.length === 0) return null
  return (
    <div className="mb-1 flex flex-col gap-1.5">
      {m.midiaTipo &&
        (link ? (
          <Arquivo tipo={m.midiaTipo} url={link} nome={m.midiaNome} />
        ) : (
          <p className="rounded-md bg-black/5 px-3 py-2 text-[12.5px] italic text-[#667781]">
            {ROTULO_MIDIA[m.midiaTipo]} · {!m.midia || link === null ? 'arquivo ainda não chegou' : 'carregando...'}
          </p>
        ))}
      {anexos.map((url) => (
        <Arquivo key={url} tipo={tipoPeloLink(url)} url={url} nome={nomeDoLink(url)} />
      ))}
    </div>
  )
}

/** A mensagem citada, em cima do balao, como no WhatsApp. Toque leva ate ela. */
export function Citacao({ m, mensagens, nomeDoCliente }: { m: Mensagem; mensagens: Mensagem[]; nomeDoCliente: string }) {
  if (!m.respondeA) return null
  const alvo = mensagens.find((x) => x.wamid === m.respondeA)
  return (
    <button
      type="button"
      onClick={() => alvo && document.getElementById(`msg-${alvo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      className="mb-1 block w-full min-w-[160px] rounded-md border-l-4 border-[#06cf9c] bg-black/5 px-2 py-1 text-left"
    >
      <span className="block text-[12px] font-bold text-[#06a17b]">{alvo ? quemFalou(alvo, nomeDoCliente) : 'Mensagem citada'}</span>
      <span className="line-clamp-2 text-[12.5px] leading-snug text-[#667781]">{alvo ? previaDaMensagem(alvo) : 'Mensagem anterior, fora desta conversa.'}</span>
    </button>
  )
}

/** Botao "Responder" do balao: aparece ao passar o mouse; no celular, arrastar o balao para a direita. */
export function BotaoResponder({ onClick, lado }: { onClick: () => void; lado: 'esquerda' | 'direita' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Responder citando esta mensagem"
      title="Responder citando"
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-[#54656f] opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100 ${
        lado === 'direita' ? '-right-9' : '-left-9'
      }`}
    >
      <Reply className="h-4 w-4" />
    </button>
  )
}

/** Arrastar para a direita responde, como no WhatsApp do celular. */
export function useArrastarParaResponder(onResponder?: () => void) {
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null)
  if (!onResponder) return {}
  return {
    onTouchStart: (e: TouchEvent) => setInicio({ x: e.touches[0].clientX, y: e.touches[0].clientY }),
    onTouchEnd: (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (inicio && t.clientX - inicio.x > 60 && Math.abs(t.clientY - inicio.y) < 40) onResponder()
      setInicio(null)
    },
  }
}

/** Faixa em cima do campo: a mensagem citada e o arquivo escolhido, cada um com X. */
export function FaixaDoEnvio({
  respondendo,
  nomeDoCliente,
  onCancelarResposta,
  arquivo,
  onTirarArquivo,
}: {
  respondendo: Mensagem | null
  nomeDoCliente: string
  onCancelarResposta: () => void
  arquivo: File | null
  onTirarArquivo: () => void
}) {
  if (!respondendo && !arquivo) return null
  return (
    <div className="mb-1.5 space-y-1">
      {respondendo && (
        <div className="flex items-start gap-2 rounded-[10px] border-l-4 border-[#06cf9c] bg-white px-3 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-[#06a17b]">Respondendo a {quemFalou(respondendo, nomeDoCliente)}</span>
            <span className="line-clamp-1 text-[12.5px] text-[#667781]">{previaDaMensagem(respondendo)}</span>
          </span>
          <button type="button" onClick={onCancelarResposta} aria-label="Cancelar a resposta citada" className="shrink-0 rounded-full p-1 text-[#54656f] hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {arquivo && (
        <div className="flex items-center gap-2 rounded-[10px] bg-white px-3 py-1.5 text-[12.5px] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
          <Paperclip className="h-4 w-4 shrink-0 text-[#54656f]" />
          <span className="min-w-0 flex-1 truncate font-semibold text-[#111b21]">{arquivo.name}</span>
          <span className="shrink-0 text-[#667781]">{(arquivo.size / 1048576).toFixed(1)} MB · o texto vai como legenda</span>
          <button type="button" onClick={onTirarArquivo} aria-label="Tirar o arquivo" className="shrink-0 rounded-full p-1 text-[#54656f] hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/** Clipe de anexar: foto, audio, video ou documento. */
export function BotaoAnexar({ onEscolher, className }: { onEscolher: (f: File) => void; className?: string }) {
  return (
    <label className={`cursor-pointer ${className ?? ''}`} title="Anexar foto, áudio, vídeo ou documento" aria-label="Anexar arquivo">
      <Paperclip className="h-5 w-5" />
      <input
        type="file"
        className="hidden"
        accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onEscolher(f)
          e.target.value = ''
        }}
      />
    </label>
  )
}
