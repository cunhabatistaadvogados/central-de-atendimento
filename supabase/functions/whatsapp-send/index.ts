// A equipe responde pela tela. Confere que quem chama e da equipe, envia
// pela Cloud API, grava a mensagem e pausa o robo naquela conversa (quem
// assumiu foi uma pessoa; o robo so volta se alguem religar).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarMidia, enviarTexto, type TipoDaMeta } from '../_shared/whatsapp.ts'

// Mesmo rotulo do webhook e da tela: e o texto da previa quando nao ha legenda.
const ROTULO: Record<string, string> = { imagem: '📷 Foto', audio: '🎤 Áudio', video: '🎥 Vídeo', documento: '📄 Documento' }
const DA_META: Record<string, TipoDaMeta> = { imagem: 'image', audio: 'audio', video: 'video', documento: 'document' }

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

  // midia: caminho no bucket "midias" que a tela acabou de subir (pasta do cliente).
  const { cliente_id, texto, responde_a, midia, midia_tipo, midia_nome } = await req.json().catch(() => ({}))
  const limpo = String(texto ?? '').trim()
  if (!cliente_id || (!limpo && !midia)) return json({ error: 'cliente_id e texto (ou arquivo) são obrigatórios.' }, 400)
  if (midia && (!DA_META[midia_tipo] || !String(midia).startsWith(`${cliente_id}/`))) return json({ error: 'Arquivo inválido.' }, 400)

  const banco = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: cliente } = await banco.from('clientes').select('id, telefone, robo').eq('id', cliente_id).single()
  if (!cliente) return json({ error: 'Cliente não encontrado.' }, 404)
  const { data: membro } = await banco.from('equipe').select('nome').eq('user_id', usuario.user?.id).single()
  const autor = membro?.nome ?? 'Equipe'
  const citada = typeof responde_a === 'string' && responde_a.startsWith('wamid.') ? responde_a : undefined

  let envio
  if (midia) {
    // A Meta baixa pelo link temporario (10 min basta: ela busca na hora).
    const { data: link, error } = await banco.storage.from('midias').createSignedUrl(midia, 600)
    if (error || !link?.signedUrl) return json({ error: `Arquivo não encontrado: ${error?.message ?? ''}` }, 400)
    envio = await enviarMidia(cliente.telefone, DA_META[midia_tipo], link.signedUrl, limpo || undefined, midia_nome || undefined, citada)
  } else {
    envio = await enviarTexto(cliente.telefone, limpo, citada)
  }
  await banco.from('mensagens').insert({
    cliente_id,
    de: 'equipe',
    texto: limpo || (midia_tipo === 'documento' && midia_nome ? `📄 ${midia_nome}` : ROTULO[midia_tipo]),
    autor,
    wamid: envio.wamid ?? null,
    status_envio: envio.ok ? 'sent' : 'failed',
    erro_envio: envio.erro ?? null,
    responde_a: citada ?? null,
    midia: midia ?? null,
    midia_tipo: midia ? midia_tipo : null,
    midia_nome: midia ? (midia_nome ?? null) : null,
  })
  if (!cliente.robo?.pausado) {
    await banco.from('clientes').update({ robo: { ...cliente.robo, pausado: true, motivoPausa: `${autor} assumiu a conversa` }, nao_lidas: 0 }).eq('id', cliente_id)
    await banco.from('eventos').insert({ cliente_id, tipo: 'equipe', texto: `${autor} assumiu a conversa` })
  }
  // Fora da janela de 24h a Meta recusa texto livre: o erro volta para a tela.
  return envio.ok ? json({ ok: true }) : json({ error: envio.erro }, 502)
})
