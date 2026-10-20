import { useEffect, useState } from 'react'

/**
 * Modo WhatsApp das Conversas no celular (pedido do Edu em 19/10/2026, igual
 * ao sistema do Marcello): lista e conversa em tela cheia, com a cara do app.
 * O topo e o campo de escrever ficam parados e so as mensagens rolam.
 *
 * O botao verde do cabecalho do celular (Home) liga o modo de fora da tela de
 * Conversas. Por isso a escolha mora aqui, lembrada no aparelho, e um evento
 * avisa a tela se ela ja estiver aberta.
 */

export const CHAVE_DO_VISUAL = 'cbaa:conversa-visual'
export const EVENTO_MODO_WHATSAPP = 'cbaa:modo-whatsapp'

// Sem armazenamento (aba anonima em alguns celulares) a escolha vale ate
// recarregar: sem isto o botao do cabecalho nao ligava nada, porque a tela de
// Conversas nasce depois do evento e leria um armazenamento vazio.
let escolhaNaMemoria: boolean | null = null

export function visualGuardado(): boolean {
  if (escolhaNaMemoria !== null) return escolhaNaMemoria
  try {
    return window.localStorage.getItem(CHAVE_DO_VISUAL) === 'whatsapp'
  } catch {
    return false
  }
}

export function guardarVisual(whatsapp: boolean) {
  escolhaNaMemoria = whatsapp
  try {
    window.localStorage.setItem(CHAVE_DO_VISUAL, whatsapp ? 'whatsapp' : 'padrao')
  } catch {
    // fica so na memoria
  }
}

export function ligarModoWhatsApp() {
  guardarVisual(true)
  window.dispatchEvent(new Event(EVENTO_MODO_WHATSAPP))
}

/** Celular ou tablet: abaixo do lg, onde o menu lateral some. */
export function useTelaDeCelular(): boolean {
  const consulta = '(max-width: 1023px)'
  const [celular, setCelular] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const mudar = () => setCelular(m.matches)
    m.addEventListener('change', mudar)
    return () => m.removeEventListener('change', mudar)
  }, [])
  return celular
}
