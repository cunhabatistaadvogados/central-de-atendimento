// Administrador cria o acesso de alguem da equipe direto pela tela (pedido do
// Edu em 20/10/2026): o Supabase manda o convite por e-mail (remetente: o
// Gmail do escritorio, configurado no SMTP do painel) e a pessoa cria a
// propria senha pelo link. Antes era preciso entrar no painel do Supabase.
//
// Arquivo unico, sem import de _shared: publica colando no editor do painel.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const SITE = 'https://cunhabatistaadvogados.github.io/central-de-atendimento/'
const PAPEIS = ['atendimento', 'advogado', 'administrador']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: ehAdmin } = await comoUsuario.rpc('eh_administrador')
  if (!ehAdmin) return json({ error: 'Só administradores criam acessos.' }, 403)
  const { data: ehDev } = await comoUsuario.rpc('eh_desenvolvedor')

  const corpo = await req.json().catch(() => ({}))
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const nome = String(corpo.nome ?? '').trim()
  const papel = String(corpo.papel ?? 'atendimento')
  // De onde veio o pedido (site publicado ou teste local): o link do e-mail volta para la.
  const voltar = typeof corpo.voltar === 'string' && /^https?:\/\//.test(corpo.voltar) ? corpo.voltar : SITE
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
  if (!nome) return json({ error: 'Informe o nome.' }, 400)
  if (!PAPEIS.includes(papel) && !(papel === 'desenvolvedor' && ehDev)) return json({ error: 'Papel inválido.' }, 400)

  const banco = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  let userId: string | null = null
  let convidado = true
  const convite = await banco.auth.admin.inviteUserByEmail(email, { redirectTo: voltar, data: { nome } })
  if (convite.error) {
    // Ja tem login (criado antes no painel, por exemplo): so libera o acesso.
    if (!/already|registered|exists/i.test(convite.error.message)) {
      return json({ error: `O convite não saiu: ${convite.error.message}` }, 502)
    }
    convidado = false
    for (let pagina = 1; pagina <= 10 && !userId; pagina++) {
      const { data, error } = await banco.auth.admin.listUsers({ page: pagina, perPage: 200 })
      if (error) return json({ error: error.message }, 502)
      userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
      if (data.users.length < 200) break
    }
    if (!userId) return json({ error: 'O e-mail já tem login, mas não consegui encontrá-lo.' }, 502)
  } else {
    userId = convite.data.user?.id ?? null
  }
  if (!userId) return json({ error: 'O Supabase não devolveu o usuário criado.' }, 502)

  const { error } = await banco.from('equipe').upsert({ user_id: userId, nome, papel, ativo: true }, { onConflict: 'user_id' })
  if (error) return json({ error: `Login criado, mas não consegui liberar o acesso: ${error.message}` }, 500)
  return json({ ok: true, convidado })
})
