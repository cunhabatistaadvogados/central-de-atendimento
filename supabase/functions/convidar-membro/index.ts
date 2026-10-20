// Acessos da equipe pela tela, so para administradores (pedido do Edu em
// 20/10/2026). Antes era preciso entrar no painel do Supabase.
//
//   convidar  cria o login e manda o convite por e-mail (remetente: o Gmail do
//             escritorio, no SMTP do painel); a pessoa cria a senha pelo link
//   link      gera o link de acesso para mandar pelo WhatsApp: o e-mail do
//             escritorio e Microsoft 365 e a quarentena dele segura convite que
//             vem de @gmail.com com "crie sua senha" (visto em 20/10/2026)
//   excluir   apaga o login (a linha da equipe vai junto, on delete cascade)
//   situacao  quem ja criou a senha e quando entrou pela ultima vez
//
// Travas no SERVIDOR: aqui roda com a chave de servico, e com ela o gatilho
// que protege o papel de desenvolvedor nao age (auth.uid() nulo). Foi assim
// que um convite com o e-mail do Edu trocou o cadastro dele para "teste /
// administrador". Ninguem mexe no proprio acesso por aqui, e so o
// desenvolvedor mexe em desenvolvedor.
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
  if (!ehAdmin) return json({ error: 'Só administradores mexem nos acessos.' }, 403)
  const { data: ehDev } = await comoUsuario.rpc('eh_desenvolvedor')
  const { data: quem } = await comoUsuario.auth.getUser()
  const eu = quem.user?.id ?? null

  const corpo = await req.json().catch(() => ({}))
  const acao = String(corpo.acao ?? 'convidar')
  // De onde veio o pedido (site publicado ou teste local): o link volta para la.
  const voltar = typeof corpo.voltar === 'string' && /^https?:\/\//.test(corpo.voltar) ? corpo.voltar : SITE
  const banco = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  async function todos() {
    const lista = []
    for (let pagina = 1; pagina <= 10; pagina++) {
      const { data, error } = await banco.auth.admin.listUsers({ page: pagina, perPage: 200 })
      if (error) throw new Error(error.message)
      lista.push(...data.users)
      if (data.users.length < 200) break
    }
    return lista
  }

  // Trava comum: ninguem mexe em si mesmo, e desenvolvedor so pelo desenvolvedor.
  async function podeMexer(userId: string): Promise<string | null> {
    if (userId === eu) return 'Esse é o seu próprio acesso: não dá para mexer nele por aqui.'
    const { data } = await banco.from('equipe').select('papel').eq('user_id', userId).maybeSingle()
    if (data?.papel === 'desenvolvedor' && !ehDev) return 'Só o desenvolvedor mexe no acesso do desenvolvedor.'
    return null
  }

  try {
    if (acao === 'situacao') {
      const usuarios = await todos()
      const situacao: Record<string, { email: string; criouSenha: boolean; ultimoAcesso: string | null }> = {}
      for (const u of usuarios) {
        situacao[u.id] = { email: u.email ?? '', criouSenha: Boolean(u.email_confirmed_at), ultimoAcesso: u.last_sign_in_at ?? null }
      }
      return json({ ok: true, situacao })
    }

    if (acao === 'link' || acao === 'excluir') {
      const userId = String(corpo.user_id ?? '')
      if (!userId) return json({ error: 'Faltou dizer de quem.' }, 400)
      const barrado = await podeMexer(userId)
      if (barrado) return json({ error: barrado }, 403)
      const { data: alvo, error: erroAlvo } = await banco.auth.admin.getUserById(userId)
      if (erroAlvo || !alvo.user) return json({ error: 'Login não encontrado.' }, 404)

      if (acao === 'excluir') {
        const { error } = await banco.auth.admin.deleteUser(userId)
        if (error) return json({ error: `Não consegui excluir: ${error.message}` }, 502)
        // A linha da equipe sai junto (on delete cascade); garante mesmo assim.
        await banco.from('equipe').delete().eq('user_id', userId)
        return json({ ok: true })
      }

      // Quem ainda nao criou a senha recebe link de convite; quem ja criou,
      // link de senha nova. Gerar um link novo invalida o anterior.
      const tipo = alvo.user.email_confirmed_at ? 'recovery' : 'invite'
      const { data, error } = await banco.auth.admin.generateLink({ type: tipo, email: alvo.user.email!, options: { redirectTo: voltar } })
      if (error || !data?.properties?.action_link) return json({ error: `Não consegui gerar o link: ${error?.message ?? 'sem link'}` }, 502)
      return json({ ok: true, link: data.properties.action_link, tipo })
    }

    // convidar
    const email = String(corpo.email ?? '').trim().toLowerCase()
    const nome = String(corpo.nome ?? '').trim()
    const papel = String(corpo.papel ?? 'atendimento')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
    if (!nome) return json({ error: 'Informe o nome.' }, 400)
    if (!PAPEIS.includes(papel) && !(papel === 'desenvolvedor' && ehDev)) return json({ error: 'Papel inválido.' }, 400)

    const existente = (await todos()).find((u) => u.email?.toLowerCase() === email)
    if (existente) {
      const barrado = await podeMexer(existente.id)
      if (barrado) return json({ error: barrado }, 403)
    }

    let convidado = true
    let userId = existente?.id ?? null
    if (!existente || !existente.email_confirmed_at) {
      // Novo, ou convidado que ainda nao criou a senha: o convite sai (de novo).
      const convite = await banco.auth.admin.inviteUserByEmail(email, { redirectTo: voltar, data: { nome } })
      if (convite.error) return json({ error: `O convite não saiu: ${convite.error.message}` }, 502)
      userId = convite.data.user?.id ?? userId
    } else {
      convidado = false // ja tem senha: so libera o acesso
    }
    if (!userId) return json({ error: 'O Supabase não devolveu o usuário criado.' }, 502)

    const { error } = await banco.from('equipe').upsert({ user_id: userId, nome, papel, ativo: true }, { onConflict: 'user_id' })
    if (error) return json({ error: `Login criado, mas não consegui liberar o acesso: ${error.message}` }, 500)
    return json({ ok: true, convidado, user_id: userId })
  } catch (erro) {
    return json({ error: erro instanceof Error ? erro.message : 'Erro inesperado.' }, 500)
  }
})
