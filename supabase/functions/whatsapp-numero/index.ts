// Configuracao do numero do robo na API da Meta (20/10/2026), quando o
// 13 99741-4361 veio do Pixel Hub para a conta do escritorio:
//
//   status     o que a Meta diz do numero e quais apps recebem os eventos
//   assinar    liga os webhooks do nosso app na conta do WhatsApp nova
//   registrar  registra o numero na Cloud API com o PIN de duas etapas
//
// Usa o token do usuario do sistema (segredo WHATSAPP_ACCESS_TOKEN), que so
// existe aqui dentro. Quem chama precisa mandar a chave service_role: so roda
// a partir do computador do Edu (scripts/numero_whatsapp.py), nunca da tela.
// O PIN e digitado pelo Edu no terminal e nao fica guardado em lugar nenhum.
//
// Arquivo unico, sem import de _shared: publica colando no editor do painel.

const GRAPH = `https://graph.facebook.com/${Deno.env.get('META_GRAPH_VERSION') ?? 'v25.0'}`

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

async function meta(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${GRAPH}/${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  return { http: r.status, resposta: await r.json().catch(() => null) }
}

// O gateway do Supabase ja conferiu a assinatura do JWT (Verify JWT ligado):
// aqui basta o papel ser service_role. Comparar com SUPABASE_SERVICE_ROLE_KEY
// nao serve: por dentro ela vem no formato novo, diferente da chave legacy.
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

  const corpo = await req.json().catch(() => ({}))
  const telefone = String(corpo.telefone_id ?? '')
  const conta = String(corpo.conta_id ?? '')
  if (!/^\d{6,}$/.test(telefone) || !/^\d{6,}$/.test(conta)) return json({ error: 'telefone_id e conta_id são obrigatórios.' }, 400)

  if (corpo.acao === 'status') {
    // health_status diz por que o numero nao envia (pagamento, nome, registro).
    const numero = await meta('GET', `${telefone}?fields=display_phone_number,verified_name,name_status,status,code_verification_status,quality_rating,platform_type,throughput,account_mode,last_onboarded_time,health_status`)
    const apps = await meta('GET', `${conta}/subscribed_apps`)
    return json({ numero, apps })
  }
  if (corpo.acao === 'assinar') return json(await meta('POST', `${conta}/subscribed_apps`))
  if (corpo.acao === 'registrar') {
    const pin = String(corpo.pin ?? '')
    if (!/^\d{6}$/.test(pin)) return json({ error: 'O PIN precisa ter 6 dígitos.' }, 400)
    return json(await meta('POST', `${telefone}/register`, { messaging_product: 'whatsapp', pin }))
  }
  return json({ error: 'Ação desconhecida.' }, 400)
})
