// Integracao com a D4Sign, a plataforma de assinatura dos contratos
// (21/10/2026). O Lucas mandou as chaves da API ("CBAA_PREV"), guardadas nos
// segredos D4SIGN_TOKEN_API e D4SIGN_CRYPT_KEY: elas so existem aqui dentro.
//
//   cofres     confere as chaves e lista os cofres da conta (nome e uuid)
//   documento  em que cofre esta um contrato e qual a situacao dele
//
// Por enquanto so a partir do computador do Edu (chave service_role, via
// scripts/d4sign.py). O envio do contrato pela Central vem depois, com OK.
//
// Arquivo unico, sem import de _shared: publica colando no editor do painel.

const BASE = Deno.env.get('D4SIGN_BASE') ?? 'https://secure.d4sign.com.br/api/v1'

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

// A D4Sign autentica pela URL (tokenAPI e cryptKey); nunca devolver isso.
async function d4(metodo: string, caminho: string, corpo?: unknown) {
  const chaves = `tokenAPI=${encodeURIComponent(Deno.env.get('D4SIGN_TOKEN_API') ?? '')}&cryptKey=${encodeURIComponent(Deno.env.get('D4SIGN_CRYPT_KEY') ?? '')}`
  const r = await fetch(`${BASE}/${caminho}${caminho.includes('?') ? '&' : '?'}${chaves}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  let resposta: unknown = texto.slice(0, 400)
  try {
    resposta = JSON.parse(texto)
  } catch {
    // resposta que nao e JSON fica como texto curto
  }
  return { http: r.status, resposta }
}

// O gateway ja conferiu a assinatura do JWT (Verify JWT ligado): basta o papel.
function papel(jwt: string): string | null {
  try {
    const parte = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(parte + '='.repeat((4 - (parte.length % 4)) % 4))).role ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const chave = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (papel(chave) !== 'service_role') return json({ error: 'Só a partir do computador do administrador.' }, 403)
  if (!Deno.env.get('D4SIGN_TOKEN_API') || !Deno.env.get('D4SIGN_CRYPT_KEY')) return json({ error: 'Faltam os segredos D4SIGN_TOKEN_API e D4SIGN_CRYPT_KEY.' }, 500)

  const corpo = await req.json().catch(() => ({}))
  if (corpo.acao === 'cofres') return json(await d4('GET', 'safes'))
  if (corpo.acao === 'documento') {
    if (!/^[0-9a-f-]{36}$/.test(String(corpo.uuid ?? ''))) return json({ error: 'uuid do documento inválido.' }, 400)
    const r = await d4('GET', `documents/${corpo.uuid}`)
    // So cofre e situacao: o nome do arquivo traz o nome do cliente.
    const doc = Array.isArray(r.resposta) ? (r.resposta[0] as Record<string, unknown>) : null
    return json(doc ? { http: r.http, cofre: doc.safeName, uuid_cofre: doc.uuidSafe, situacao: doc.statusName } : r)
  }
  return json({ error: 'Ação desconhecida.' }, 400)
})
