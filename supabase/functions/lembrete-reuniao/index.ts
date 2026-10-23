// Lembrete no dia da reuniao (22/10/2026). O pg_cron chama a cada 10 minutos.
// Duas horas antes (nunca antes das 7h), a familia recebe pelo WhatsApp que o
// Dr. Andre vai chamar por video. Dentro das 24h da ultima mensagem dela vai
// texto livre; fora, so o modelo aprovado pela Meta "lembrete_reuniao".
// Sem login: so manda o que esta na hora, uma vez por horario
// (clientes.lembrete_enviado_para), entao chamar de novo nao repete nada.
// Arquivo unico, sem import local: publicado pelo editor do painel.
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODELO = 'lembrete_reuniao'
const ANTES_MS = 2 * 3600000
const HORA = 3600000

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function postar(para: string, conteudo: Record<string, unknown>): Promise<{ ok: boolean; wamid?: string; erro?: string }> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const numeroId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const versao = Deno.env.get('META_GRAPH_VERSION') ?? 'v25.0'
  if (!token || !numeroId) return { ok: false, erro: 'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausente nos segredos do Supabase' }
  const resp = await fetch(`https://graph.facebook.com/${versao}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, ...conteudo }),
  })
  const corpo = await resp.json().catch(() => null)
  if (!resp.ok) return { ok: false, erro: corpo?.error?.message ?? `Graph respondeu ${resp.status}` }
  return { ok: true, wamid: corpo?.messages?.[0]?.id }
}

/** "9h" ou "13h40", hora de Santos (UTC-3, sem horario de verao). */
function hora(ms: number): string {
  const l = new Date(ms - 3 * HORA)
  const m = l.getUTCMinutes()
  return `${l.getUTCHours()}h${m ? String(m).padStart(2, '0') : ''}`
}

/** 7h do dia da reuniao em Santos: lembrete nunca chega de madrugada. */
function seteDaManha(ms: number): number {
  const l = new Date(ms - 3 * HORA)
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate(), 10)
}

const primeiroNome = (nome: string) => (nome.trim().split(/\s+/)[0] ?? '').replace(/^./, (c) => c.toUpperCase())

Deno.serve(async () => {
  const agora = Date.now()
  const { data, error } = await banco
    .from('clientes')
    .select('id, nome, telefone, reuniao, lembrete_enviado_para, ultima_do_cliente_em')
    .neq('etapa', 'perdido')
    .eq('reuniao->>confirmada', 'true')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const feitos: string[] = []
  for (const c of data ?? []) {
    const quando: string | undefined = c.reuniao?.data
    if (!quando || !c.telefone) continue
    const ms = new Date(quando).getTime()
    if (Number.isNaN(ms) || ms <= agora) continue
    if (agora < Math.max(ms - ANTES_MS, seteDaManha(ms))) continue
    if (c.lembrete_enviado_para === quando || c.lembrete_enviado_para === `falhou:${quando}`) continue

    const nome = primeiroNome(c.nome ?? '')
    const texto = `${nome ? `Olá, ${nome}. ` : 'Olá. '}Lembrete: hoje às ${hora(ms)} o Dr. André te chama por chamada de vídeo aqui no WhatsApp.`
    const ultima = c.ultima_do_cliente_em ? new Date(c.ultima_do_cliente_em).getTime() : 0
    const naJanela = agora - ultima < 24 * HORA - 10 * 60000
    const envio = naJanela
      ? await postar(c.telefone, { type: 'text', text: { body: texto, preview_url: false } })
      : await postar(c.telefone, {
          type: 'template',
          template: {
            name: MODELO,
            language: { code: 'pt_BR' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: nome || 'tudo bem' }, { type: 'text', text: hora(ms) }] }],
          },
        })

    await banco.from('mensagens').insert({
      cliente_id: c.id,
      de: 'robo',
      texto,
      wamid: envio.wamid ?? null,
      status_envio: envio.ok ? 'sent' : 'failed',
      erro_envio: envio.erro ?? null,
    })
    // Falhou: marca para nao tentar a cada 10 minutos; a equipe ve o aviso e liga.
    await banco.from('clientes').update({ lembrete_enviado_para: envio.ok ? quando : `falhou:${quando}` }).eq('id', c.id)
    await banco.from('eventos').insert({
      id: crypto.randomUUID(),
      cliente_id: c.id,
      tipo: 'sistema',
      texto: envio.ok ? `Lembrete da reunião enviado pelo WhatsApp (${naJanela ? 'texto' : 'modelo aprovado'})` : `Lembrete da reunião NÃO enviado: ${envio.erro}`,
      em: new Date().toISOString(),
    })
    feitos.push(`${c.id}: ${envio.ok ? 'ok' : envio.erro}`)
  }
  return new Response(JSON.stringify({ ok: true, feitos }), { headers: { 'Content-Type': 'application/json' } })
})
