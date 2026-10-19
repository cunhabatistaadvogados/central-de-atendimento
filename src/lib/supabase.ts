import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

/** Sem as variaveis o sistema roda em modo demonstracao (dados neste navegador). */
export const supabaseConfigurado = Boolean(url && chave)

export const supabase = supabaseConfigurado
  ? createClient(url!, chave!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
