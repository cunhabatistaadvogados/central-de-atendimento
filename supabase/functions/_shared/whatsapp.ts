// Envio pela API oficial do WhatsApp (Cloud API da Meta).
// Segredos no Supabase (nunca no codigo): WHATSAPP_ACCESS_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID, opcional META_GRAPH_VERSION.

export interface ResultadoEnvio {
  ok: boolean
  wamid?: string
  erro?: string
}

function segredos() {
  return {
    token: Deno.env.get('WHATSAPP_ACCESS_TOKEN'),
    numeroId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
    versao: Deno.env.get('META_GRAPH_VERSION') ?? 'v25.0',
  }
}

// respondeA: wamid da mensagem citada. No celular da familia a resposta
// aparece "em cima" da mensagem, como quando se arrasta para responder.
async function postar(para: string, conteudo: Record<string, unknown>, respondeA?: string): Promise<ResultadoEnvio> {
  const { token, numeroId, versao } = segredos()
  // Falha silenciosa e pior que falha barulhenta (licao do sistema do Dr.
  // Marcello): sem segredo, o erro volta e fica gravado na mensagem.
  if (!token || !numeroId) return { ok: false, erro: 'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausente nos segredos do Supabase' }
  const resp = await fetch(`https://graph.facebook.com/${versao}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, ...(respondeA ? { context: { message_id: respondeA } } : {}), ...conteudo }),
  })
  const corpo = await resp.json().catch(() => null)
  if (!resp.ok) return { ok: false, erro: corpo?.error?.message ?? `Graph respondeu ${resp.status}` }
  return { ok: true, wamid: corpo?.messages?.[0]?.id }
}

export function enviarTexto(para: string, texto: string, respondeA?: string): Promise<ResultadoEnvio> {
  return postar(para, { type: 'text', text: { body: texto, preview_url: false } }, respondeA)
}

export type TipoDaMeta = 'image' | 'audio' | 'video' | 'document'

/** Arquivo por link (a Meta baixa do link temporario). Audio nao aceita legenda. */
export function enviarMidia(para: string, tipo: TipoDaMeta, link: string, legenda?: string, nome?: string, respondeA?: string): Promise<ResultadoEnvio> {
  const midia: Record<string, string> = { link }
  if (legenda && tipo !== 'audio') midia.caption = legenda
  if (nome && tipo === 'document') midia.filename = nome
  return postar(para, { type: tipo, [tipo]: midia }, respondeA)
}

/** Baixa a midia que a familia mandou: o id vira um link que so abre com o token. */
export async function baixarMidia(id: string): Promise<{ ok: true; bytes: Uint8Array; mime: string } | { ok: false; erro: string }> {
  const { token, versao } = segredos()
  if (!token) return { ok: false, erro: 'WHATSAPP_ACCESS_TOKEN ausente' }
  const auth = { Authorization: `Bearer ${token}` }
  const info = await fetch(`https://graph.facebook.com/${versao}/${id}`, { headers: auth })
  const dados = await info.json().catch(() => null)
  if (!info.ok || !dados?.url) return { ok: false, erro: dados?.error?.message ?? `Graph respondeu ${info.status}` }
  const arquivo = await fetch(dados.url, { headers: auth })
  if (!arquivo.ok) return { ok: false, erro: `download respondeu ${arquivo.status}` }
  return { ok: true, bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: String(dados.mime_type ?? arquivo.headers.get('content-type') ?? '') }
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

/** Modelo aprovado pela Meta (fora da janela de 24h). Parametro nao pode ter quebra de linha. */
export function enviarModelo(para: string, nome: string, parametros: string[]): Promise<ResultadoEnvio> {
  return postar(para, {
    type: 'template',
    template: { name: nome, language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: parametros.map((text) => ({ type: 'text', text: text.replace(/\s+/g, ' ').trim() })) }] },
  })
}
