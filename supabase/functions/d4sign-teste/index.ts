// Teste da ligacao com a D4Sign (22/10/2026). So a equipe chama; nunca devolve
// chave. Acoes:
//   cofres            lista os cofres (so leitura)
//   enviar_teste      sobe um PDF de TESTE no cofre CB&AA, cadastra UM signatario
//                     por WhatsApp e envia (para conferir se o plano manda por WhatsApp)
//   status            situacao de um documento
//   cancelar          cancela um documento de teste
// Arquivo unico, sem import local: publicado pelo editor do painel.
import { createClient } from 'npm:@supabase/supabase-js@2'

const COFRE_CBAA = '19eca1a8-cdec-4df9-abc0-4311b724ecce'
const API = 'https://secure.d4sign.com.br/api/v1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function chaves(): string {
  const cripto = Deno.env.get('D4SIGN_CRYPT_KEY')
  return new URLSearchParams({ tokenAPI: Deno.env.get('D4SIGN_TOKEN_API') ?? '', ...(cripto ? { cryptKey: cripto } : {}) }).toString()
}

async function d4(caminho: string, corpo?: unknown) {
  const resp = await fetch(`${API}${caminho}?${chaves()}`, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await resp.text()
  let dados: unknown = texto.slice(0, 500)
  try {
    dados = JSON.parse(texto)
  } catch {
    // resposta que nao e JSON: fica o comeco do texto
  }
  return { ok: resp.ok, status: resp.status, dados }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const comoUsuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: ehEquipe } = await comoUsuario.rpc('eh_da_equipe')
  if (!ehEquipe) return json({ error: 'Acesso só para a equipe do escritório.' }, 403)
  if (!Deno.env.get('D4SIGN_TOKEN_API')) return json({ ok: false, erro: 'D4SIGN_TOKEN_API ausente nos segredos' })

  const { acao = 'cofres', pdf_base64, nome, whatsapp, email, documento } = await req.json().catch(() => ({}))

  if (acao === 'cofres') {
    const r = await d4('/safes')
    const cofres = Array.isArray(r.dados) ? r.dados.map((c: Record<string, string>) => ({ nome: c['name-safe'], uuid: c['uuid_safe'] })) : null
    return json({ ok: r.ok && Boolean(cofres), status: r.status, cofres, resposta: cofres ? undefined : r.dados })
  }

  if (acao === 'enviar_teste') {
    if (!pdf_base64 || !whatsapp) return json({ ok: false, erro: 'pdf_base64 e whatsapp são obrigatórios' }, 400)
    // 1. sobe o PDF de teste no cofre CB&AA
    const subida = await d4(`/documents/${COFRE_CBAA}/uploadbinary`, { base64_binary_file: pdf_base64, mime_type: 'application/pdf', name: nome ?? 'TESTE Central CB&' })
    const uuid = (subida.dados as Record<string, string>)?.uuid
    if (!uuid) return json({ ok: false, etapa: 'upload', ...subida })
    // 2. um signatario so, com confirmacao por WhatsApp
    const signatario: Record<string, string> = {
      act: '1',
      foreign: '0',
      certificadoicpbr: '0',
      assinatura_presencial: '0',
      whatsapp_number: whatsapp,
      embed_methodauth: 'whats',
      embed_smsnumber: whatsapp,
    }
    if (email) signatario.email = email
    const lista = await d4(`/documents/${uuid}/createlist`, { signers: [signatario] })
    if (!lista.ok) return json({ ok: false, etapa: 'signatarios', documento: uuid, ...lista })
    // 3. envia para assinatura
    const envio = await d4(`/documents/${uuid}/sendtosigner`, { message: 'Teste da Central CB&: contrato de teste, sem valor.', skip_email: email ? '0' : '1', workflow: '0' })
    return json({ ok: envio.ok, etapa: 'envio', documento: uuid, signatarios: lista.dados, envio: envio.dados, status: envio.status })
  }

  if (acao === 'status') {
    if (!documento) return json({ ok: false, erro: 'documento é obrigatório' }, 400)
    const r = await d4(`/documents/${documento}`)
    const sig = await d4(`/documents/${documento}/list`)
    return json({ ok: r.ok, documento: r.dados, signatarios: sig.dados })
  }

  if (acao === 'cancelar') {
    if (!documento) return json({ ok: false, erro: 'documento é obrigatório' }, 400)
    const r = await d4(`/documents/${documento}/cancel`, { comment: 'Teste da Central CB&' })
    return json({ ok: r.ok, status: r.status, resposta: r.dados })
  }

  return json({ ok: false, erro: `ação desconhecida: ${acao}` }, 400)
})
