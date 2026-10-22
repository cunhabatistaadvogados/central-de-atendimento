// Reuniao da Central na agenda do Outlook (22/10/2026). O evento fica na agenda
// do Dr. Andre (prev@) com a Andreia (atendimento@) convidada; o cliente nao
// recebe nada (a reuniao e chamada de video pelo WhatsApp). O app "Central
// CBAA" no Entra so enxerga essas duas caixas (ApplicationAccessPolicy).
// Acoes:
//   salvar   cria o evento ou remarca o que ja existe
//   apagar   cancela o evento (reuniao desmarcada ou cliente perdido)
//   teste    so confere o acesso: le a agenda do prev@, nada muda
// Arquivo unico, sem import local: publicado pelo editor do painel.
import { createClient } from 'npm:@supabase/supabase-js@2'

const TENANT = '0a931a5c-90c1-41fe-a2a4-21d32a6af386'
const APP = '028e0355-000f-470c-8a5e-07cd1ed3cf9c'
const AGENDA = 'prev@cunhabatista.com.br'
const CONVIDADA = { address: 'atendimento@cunhabatista.com.br', name: 'Andreia' }
const DURACAO_MIN = 30
const GRAPH = 'https://graph.microsoft.com/v1.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

let token: { valor: string; ate: number } | null = null

async function tokenDoGraph(): Promise<string> {
  if (token && token.ate > Date.now() + 60000) return token.valor
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: APP,
      client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  const dados = await resp.json().catch(() => ({}))
  if (!resp.ok || !dados.access_token) throw new Error(`Microsoft recusou o login do app: ${dados.error_description ?? dados.error ?? resp.status}`)
  token = { valor: dados.access_token, ate: Date.now() + (dados.expires_in ?? 3600) * 1000 }
  return token.valor
}

async function graph(metodo: string, caminho: string, corpo?: unknown) {
  const resp = await fetch(`${GRAPH}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${await tokenDoGraph()}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await resp.text()
  let dados: Record<string, unknown> = {}
  try {
    dados = texto ? JSON.parse(texto) : {}
  } catch {
    // resposta sem JSON (DELETE devolve vazio)
  }
  return { ok: resp.ok, status: resp.status, dados }
}

function motivo(r: { status: number; dados: Record<string, unknown> }): string {
  const e = r.dados.error as { message?: string } | undefined
  return e?.message ?? `HTTP ${r.status}`
}

/** Graph quer data sem fuso junto com timeZone: vai tudo em UTC. */
function emUtc(d: Date) {
  return { dateTime: d.toISOString().slice(0, 19), timeZone: 'UTC' }
}

function telefoneLegivel(t: string): string {
  const d = t.replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t
}

function evento(nome: string, telefone: string, inicio: Date, autor: string) {
  const fim = new Date(inicio.getTime() + DURACAO_MIN * 60000)
  const fone = telefone ? telefoneLegivel(telefone) : 'sem WhatsApp na ficha'
  return {
    subject: `Reunião BPC: ${nome}`,
    body: {
      contentType: 'text',
      content: `Chamada de vídeo pelo WhatsApp com ${nome}, ${fone}.\nMarcada na Central CB&AA por ${autor}.`,
    },
    start: emUtc(inicio),
    end: emUtc(fim),
    location: { displayName: 'WhatsApp (chamada de vídeo)' },
    attendees: [{ emailAddress: CONVIDADA, type: 'required' }],
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const comoUsuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: ehEquipe } = await comoUsuario.rpc('eh_da_equipe')
  if (!ehEquipe) return json({ error: 'Acesso só para a equipe do escritório.' }, 403)
  if (!Deno.env.get('MS_CLIENT_SECRET')) return json({ error: 'MS_CLIENT_SECRET ausente nos segredos do Supabase.' })

  const { acao, cliente_id, inicio, nome, telefone, autor = 'a equipe' } = await req.json().catch(() => ({}))

  try {
    if (acao === 'teste') {
      const r = await graph('GET', `/users/${AGENDA}/calendar?$select=name,owner`)
      return json({ ok: r.ok, status: r.status, agenda: r.ok ? r.dados.name : undefined, erro: r.ok ? undefined : motivo(r) })
    }

    if (!cliente_id) return json({ error: 'Falta o cliente.' }, 400)
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: linha, error } = await db.from('clientes').select('outlook_evento_id').eq('id', cliente_id).single()
    if (error) return json({ error: `Cliente não encontrado: ${error.message}` }, 404)
    const atual: string | null = linha.outlook_evento_id
    const anotar = (texto: string) => db.from('eventos').insert({ id: crypto.randomUUID(), cliente_id, tipo: 'sistema', texto, em: new Date().toISOString() })

    if (acao === 'salvar') {
      const quando = new Date(inicio)
      if (Number.isNaN(quando.getTime())) return json({ error: 'Data da reunião inválida.' }, 400)
      const corpo = evento(nome || 'cliente', telefone ?? '', quando, autor)
      let r = atual ? await graph('PATCH', `/users/${AGENDA}/events/${atual}`, corpo) : null
      // Evento apagado direto no Outlook: cria de novo.
      if (!r || r.status === 404) r = await graph('POST', `/users/${AGENDA}/events`, corpo)
      if (!r.ok) {
        await anotar(`Outlook: não consegui pôr a reunião na agenda (${motivo(r)})`)
        return json({ error: `O Outlook não aceitou: ${motivo(r)}` })
      }
      const novoId = r.dados.id as string
      if (novoId !== atual) await db.from('clientes').update({ outlook_evento_id: novoId }).eq('id', cliente_id)
      const legivel = quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
      await anotar(`Outlook: reunião ${atual ? 'remarcada' : 'na agenda do Dr. André'} para ${legivel}, Andreia convidada`)
      return json({ ok: true, evento: novoId })
    }

    if (acao === 'apagar') {
      if (!atual) return json({ ok: true, nada: true })
      const r = await graph('DELETE', `/users/${AGENDA}/events/${atual}`)
      if (!r.ok && r.status !== 404) {
        await anotar(`Outlook: não consegui tirar a reunião da agenda (${motivo(r)})`)
        return json({ error: `O Outlook não aceitou: ${motivo(r)}` })
      }
      await db.from('clientes').update({ outlook_evento_id: null }).eq('id', cliente_id)
      await anotar('Outlook: reunião tirada da agenda do Dr. André')
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message })
  }
})
