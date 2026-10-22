// Teste do interprete (22/10/2026): recebe {casos: [{pergunta, resposta}]} e
// devolve o que o Claude entendeu e o que o robo faria com isso. So a equipe
// chama. Publicado pelo painel como arquivo unico (interprete.ts + robo.ts
// colados no lugar dos imports).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { interpretar, MODELO_DO_INTERPRETE } from '../_shared/interprete.ts'

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

  const { casos = [] } = await req.json().catch(() => ({}))
  const resultados = []
  for (const c of (casos as { pergunta: string; resposta: string }[]).slice(0, 10)) {
    const inicio = Date.now()
    const i = await interpretar(c.pergunta, c.resposta)
    resultados.push({ ...c, ...i, ms: Date.now() - inicio })
  }
  return json({ modelo: MODELO_DO_INTERPRETE, resultados })
})
