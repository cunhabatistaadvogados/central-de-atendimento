import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

/** Sem as variaveis o sistema roda em modo demonstracao (dados neste navegador). */
export const supabaseConfigurado = Boolean(url && chave)

/**
 * Chegou por link de e-mail? "invite" (convite da equipe) ou "recovery"
 * (esqueci a senha). Lido ANTES de criar o cliente: o supabase-js abre a
 * sessao com o token do endereco e depois limpa o endereco.
 */
export const tipoDoLinkDeEmail: 'invite' | 'recovery' | null = (() => {
  const h = new URLSearchParams(window.location.hash.slice(1))
  const tipo = h.get('type') ?? new URLSearchParams(window.location.search).get('type')
  return tipo === 'invite' || tipo === 'recovery' ? tipo : null
})()

/** O link do e-mail venceu ou ja foi usado: o Supabase devolve o erro no endereco. */
export const erroDoLinkDeEmail: string | null = (() => {
  const h = new URLSearchParams(window.location.hash.slice(1))
  return h.get('error_description')?.replace(/\+/g, ' ') ?? null
})()

export const supabase = supabaseConfigurado
  ? createClient(url!, chave!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
