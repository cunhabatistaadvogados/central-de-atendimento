// A equipe responde pela tela. Confere que quem chama e da equipe, envia
// pela Cloud API, grava a mensagem e pausa o robo naquela conversa (quem
// assumiu foi uma pessoa; o robo so volta se alguem religar).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarTexto } from '../_shared/whatsapp.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: ehEquipe } = await comoUsuario.rpc('eh_da_equipe')
  if (!ehEquipe) return json({ error: 'Acesso só para a equipe do escritório.' }, 403)
  const { data: usuario } = await comoUsuario.auth.getUser()

  const { cliente_id, texto } = await req.json().catch(() => ({}))
  if (!cliente_id || !String(texto ?? '').trim()) return json({ error: 'cliente_id e texto são obrigatórios.' }, 400)

  const banco = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: cliente } = await banco.from('clientes').select('id, telefone, robo').eq('id', cliente_id).single()
  if (!cliente) return json({ error: 'Cliente não encontrado.' }, 404)
  const { data: membro } = await banco.from('equipe').select('nome').eq('user_id', usuario.user?.id).single()
  const autor = membro?.nome ?? 'Equipe'

  const envio = await enviarTexto(cliente.telefone, String(texto).trim())
  await banco.from('mensagens').insert({
    cliente_id,
    de: 'equipe',
    texto: String(texto).trim(),
    autor,
    wamid: envio.wamid ?? null,
    status_envio: envio.ok ? 'sent' : 'failed',
    erro_envio: envio.erro ?? null,
  })
  if (!cliente.robo?.pausado) {
    await banco.from('clientes').update({ robo: { ...cliente.robo, pausado: true, motivoPausa: `${autor} assumiu a conversa` }, nao_lidas: 0 }).eq('id', cliente_id)
    await banco.from('eventos').insert({ cliente_id, tipo: 'equipe', texto: `${autor} assumiu a conversa` })
  }
  // Fora da janela de 24h a Meta recusa texto livre: o erro volta para a tela.
  return envio.ok ? json({ ok: true }) : json({ error: envio.erro }, 502)
})
