// Teste da ligacao com a D4Sign (22/10/2026): so LE a lista de cofres da conta,
// para conferir que as chaves D4SIGN_TOKEN_API e D4SIGN_CRYPT_KEY funcionam.
// Nao cria, nao envia, nao assina nada. So responde para quem e da equipe.
// Arquivo unico, sem import local: publicado pelo editor do painel.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const comoUsuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: ehEquipe } = await comoUsuario.rpc('eh_da_equipe')
  if (!ehEquipe) return json({ error: 'Acesso só para a equipe do escritório.' }, 403)

  const token = Deno.env.get('D4SIGN_TOKEN_API')
  const cripto = Deno.env.get('D4SIGN_CRYPT_KEY')
  if (!token) return json({ ok: false, erro: 'D4SIGN_TOKEN_API ausente nos segredos' })

  const q = new URLSearchParams({ tokenAPI: token, ...(cripto ? { cryptKey: cripto } : {}) })
  const resp = await fetch(`https://secure.d4sign.com.br/api/v1/safes?${q}`, { headers: { Accept: 'application/json' } })
  const texto = await resp.text()
  let corpo: unknown = null
  try {
    corpo = JSON.parse(texto)
  } catch {
    corpo = texto.slice(0, 300)
  }
  // Devolve so nome e codigo dos cofres: nada de chave na resposta.
  const cofres = Array.isArray(corpo) ? corpo.map((c: Record<string, string>) => ({ nome: c['name-safe'], uuid: c['uuid_safe'] })) : null
  return json({ ok: resp.ok && Array.isArray(corpo), status: resp.status, cofres, resposta: cofres ? undefined : corpo, usouCryptKey: Boolean(cripto) })
})
