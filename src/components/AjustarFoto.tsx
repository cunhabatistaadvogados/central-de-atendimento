import { Check, RefreshCw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Ajustar a foto antes de salvar, igual ao sistema do Marcello: arrastar para
 * centralizar e aproximar com a barra, dentro do circulo que aparece no topo.
 *
 * Sem biblioteca: a imagem e desenhada num canvas na posicao e no zoom
 * escolhidos, e o resultado sai como JPEG 256x256 (foto de celular tem 4 MB).
 *
 * Em portal: o topo fica dentro de .entrar, que tem transform, e position:
 * fixed dentro disso nao cobre a tela.
 */

const QUADRO = 260 // tamanho do circulo na tela, em px
const SAIDA = 256

export default function AjustarFoto({ arquivo, onCancelar, onSalvar }: { arquivo: File; onCancelar: () => void; onSalvar: (foto: File) => Promise<void> }) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [salvando, setSalvando] = useState(false)
  const arraste = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => setImagem(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  // Escala base: o lado menor da foto preenche o circulo (zoom 1 = sem sobra).
  const base = imagem ? QUADRO / Math.min(imagem.naturalWidth, imagem.naturalHeight) : 1
  const escala = base * zoom
  const largura = (imagem?.naturalWidth ?? 0) * escala
  const altura = (imagem?.naturalHeight ?? 0) * escala

  // Nao deixa sobrar fundo vazio dentro do circulo.
  function limitar(p: { x: number; y: number }, l = largura, a = altura) {
    const maxX = Math.max(0, (l - QUADRO) / 2)
    const maxY = Math.max(0, (a - QUADRO) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) }
  }

  function mudarZoom(z: number) {
    setZoom(z)
    if (!imagem) return
    const e = base * z
    setPos((p) => limitar(p, imagem.naturalWidth * e, imagem.naturalHeight * e))
  }

  async function salvar() {
    if (!imagem) return
    setSalvando(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = SAIDA
      canvas.height = SAIDA
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Este navegador não consegue preparar a foto.')
      // O que esta dentro do circulo, em coordenadas da imagem original.
      const lado = QUADRO / escala
      const cx = imagem.naturalWidth / 2 - pos.x / escala
      const cy = imagem.naturalHeight / 2 - pos.y / escala
      ctx.drawImage(imagem, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, SAIDA, SAIDA)
      const blob = await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não consegui converter a foto.'))), 'image/jpeg', 0.88))
      await onSalvar(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
    } finally {
      setSalvando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-marinho-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[26px] bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="titulo-serif text-xl text-marinho-900">Ajustar foto</h2>
          <button type="button" onClick={onCancelar} aria-label="Cancelar" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Arraste para centralizar e use a barra para aproximar.</p>

        <div
          className="relative mx-auto mt-4 cursor-grab touch-none overflow-hidden rounded-full bg-slate-100 ring-4 ring-ouro-100 active:cursor-grabbing"
          style={{ width: QUADRO, height: QUADRO }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            arraste.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
          }}
          onPointerMove={(e) => {
            const a = arraste.current
            if (!a) return
            setPos(limitar({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y }))
          }}
          onPointerUp={() => {
            arraste.current = null
          }}
          onPointerCancel={() => {
            arraste.current = null
          }}
        >
          {imagem ? (
            <img
              src={imagem.src}
              alt="Pré-visualização"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{ width: largura, height: altura, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
            />
          ) : (
            <span className="flex h-full items-center justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomOut className="h-4 w-4 text-slate-400" />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} aria-label="Aproximar" className="w-full accent-ouro-500" />
          <ZoomIn className="h-4 w-4 text-slate-400" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancelar} className="botao-claro py-2.5 text-xs">
            Cancelar
          </button>
          <button type="button" onClick={() => void salvar()} disabled={!imagem || salvando} className="botao-primario py-2.5 text-xs disabled:cursor-wait">
            {salvando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {salvando ? 'Salvando...' : 'Salvar foto'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
