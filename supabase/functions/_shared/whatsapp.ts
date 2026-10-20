// Envio pela API oficial do WhatsApp (Cloud API da Meta).
// Segredos no Supabase (nunca no codigo): WHATSAPP_ACCESS_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID, opcional META_GRAPH_VERSION.

export interface ResultadoEnvio {
  ok: boolean
  wamid?: string
  erro?: string
}

export async function enviarTexto(para: string, texto: string): Promise<ResultadoEnvio> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const numeroId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const versao = Deno.env.get('META_GRAPH_VERSION') ?? 'v25.0'
  // Falha silenciosa e pior que falha barulhenta (licao do sistema do Dr.
  // Marcello): sem segredo, o erro volta e fica gravado na mensagem.
  if (!token || !numeroId) return { ok: false, erro: 'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausente nos segredos do Supabase' }
  const resp = await fetch(`https://graph.facebook.com/${versao}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto, preview_url: false } }),
  })
  const corpo = await resp.json().catch(() => null)
  if (!resp.ok) return { ok: false, erro: corpo?.error?.message ?? `Graph respondeu ${resp.status}` }
  return { ok: true, wamid: corpo?.messages?.[0]?.id }
}

/** Assinatura da Meta (X-Hub-Signature-256): HMAC-SHA256 do corpo cru com o App Secret. */
export async function assinaturaValida(corpoCru: string, cabecalho: string | null): Promise<boolean> {
  const segredo = Deno.env.get('META_APP_SECRET')
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpoCru))
  const hex = [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const esperado = cabecalho.slice(7)
  if (hex.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < hex.length; i++) diferenca |= hex.charCodeAt(i) ^ esperado.charCodeAt(i)
  return diferenca === 0
}
