// Webhook do WhatsApp (Meta). Recebe a mensagem da familia, roda o MESMO
// motor do simulador (_shared/robo.ts), responde e grava tudo.
//
// Sempre devolve 200 depois de validar a assinatura: se devolver erro, a Meta
// reenvia o evento e o robo responderia duas vezes. A idempotencia vem do
// wamid unico na tabela mensagens.
//
// Segredos: WHATSAPP_VERIFY_TOKEN, META_APP_SECRET, WHATSAPP_ACCESS_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ja vem do ambiente.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { contratoComParteFixa, novoEstado, responder, type EstadoRobo, type Etapa } from '../_shared/robo.ts'
import { assinaturaValida, enviarTexto } from '../_shared/whatsapp.ts'

const ORDEM: Etapa[] = ['novo', 'qualificacao', 'qualificado', 'reuniao', 'contrato', 'contratado']

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

interface MensagemMeta {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  button?: { text: string }
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }
  referral?: unknown
}

function textoDaMensagem(m: MensagemMeta): string {
  if (m.type === 'text') return m.text?.body ?? ''
  if (m.type === 'button') return m.button?.text ?? ''
  if (m.type === 'interactive') return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ''
  if (m.type === 'audio' || m.type === 'voice') return '[áudio recebido]'
  return '[arquivo recebido]'
}

async function evento(clienteId: string, tipo: string, texto: string) {
  await banco.from('eventos').insert({ cliente_id: clienteId, tipo, texto })
}

async function processar(m: MensagemMeta) {
  const texto = textoDaMensagem(m).trim()
  if (!texto) return
  const em = new Date(Number(m.timestamp) * 1000 || Date.now())

  // Cliente por telefone (cria na primeira mensagem).
  let { data: cliente } = await banco.from('clientes').select('*').eq('telefone', m.from).maybeSingle()
  if (!cliente) {
    const origem = m.referral ? 'anuncio' : /advogad[oa] previdenci/i.test(texto) ? 'site' : 'anuncio'
    const criado = await banco.from('clientes').insert({ telefone: m.from, origem, robo: novoEstado() }).select('*').single()
    if (criado.error) {
      // Duas mensagens juntas do mesmo numero novo: a outra criou primeiro.
      // Em 19/10/2026 o erro real era permissao da tabela, e o log so dizia
      // "nao encontrado": agora o motivo do banco vai junto.
      console.warn('[meta-webhook] insert do cliente recusado:', criado.error.message)
      const de_novo = await banco.from('clientes').select('*').eq('telefone', m.from).single()
      if (de_novo.error) throw new Error(`cliente ${m.from}: insert "${criado.error.message}", select "${de_novo.error.message}"`)
      cliente = de_novo.data
    } else {
      cliente = criado.data
      await evento(cliente.id, 'sistema', `Contato chegou pelo ${origem === 'site' ? 'site' : 'anúncio'}`)
    }
  }
  if (!cliente) throw new Error(`cliente ${m.from} nao encontrado nem criado`)

  // Idempotencia: a mesma mensagem da Meta so entra uma vez.
  const gravada = await banco.from('mensagens').insert({ cliente_id: cliente.id, de: 'cliente', texto, wamid: m.id, em: em.toISOString() }).select('id')
  if (gravada.error) {
    if (gravada.error.code === '23505') return
    throw gravada.error
  }

  const estado: EstadoRobo = cliente.robo?.ficha ? cliente.robo : novoEstado()
  const r = responder(estado, texto, em)

  let etapa: Etapa = cliente.etapa
  let reuniao = cliente.reuniao
  for (const s of r.sinais) {
    if (s.tipo === 'etapa' && etapa !== 'perdido' && ORDEM.indexOf(s.etapa) > ORDEM.indexOf(etapa)) {
      etapa = s.etapa
      await evento(cliente.id, 'etapa', `Robô moveu para ${s.etapa}`)
    }
    if (s.tipo === 'pendencia') {
      await banco.from('pendencias').insert({ cliente_id: cliente.id, texto: s.texto, retorno_em: new Date(em.getTime() + s.dias * 86400000).toISOString() })
      await evento(cliente.id, 'robo', `Pendência: ${s.texto} (retorno em ${s.dias} dia(s))`)
    }
    if (s.tipo === 'encaminhar') await evento(cliente.id, 'robo', `Encaminhado à equipe: ${s.motivo}`)
    if (s.tipo === 'reuniao') {
      reuniao = { quando: s.quando, advogado: 'Dr. André', confirmada: false }
      const f = r.estado.ficha
      const menor = (f.para === 'filho' || f.para === 'filha') && (f.idade === undefined || f.idade < 18)
      await banco
        .from('contratos')
        .upsert(
          { cliente_id: cliente.id, com_parte_fixa: contratoComParteFixa(f), dados: { menor, nome: f.para === 'proprio' ? (f.nome ?? '') : '', repNome: menor ? (f.nome ?? '') : '' } },
          { onConflict: 'cliente_id', ignoreDuplicates: true },
        )
      await evento(cliente.id, 'robo', `Reunião pedida para ${s.quando}. Contrato preparado em rascunho.`)
    }
  }

  await banco
    .from('clientes')
    .update({
      robo: r.estado,
      nome: cliente.nome || r.estado.ficha.nome || '',
      etapa,
      reuniao,
      nao_lidas: (cliente.nao_lidas ?? 0) + 1,
      ultima_do_cliente_em: em.toISOString(),
    })
    .eq('id', cliente.id)

  for (const resposta of r.respostas) {
    const envio = await enviarTexto(m.from, resposta)
    await banco.from('mensagens').insert({
      cliente_id: cliente.id,
      de: 'robo',
      texto: resposta,
      wamid: envio.wamid ?? null,
      status_envio: envio.ok ? 'sent' : 'failed',
      erro_envio: envio.erro ?? null,
    })
    if (!envio.ok) {
      // Robo nao conseguiu responder: para e chama a equipe em vez de sumir.
      await banco.from('clientes').update({ robo: { ...r.estado, pausado: true, encaminhado: true, motivoPausa: `Falha no envio: ${envio.erro}` } }).eq('id', cliente.id)
      await evento(cliente.id, 'sistema', `FALHA ao enviar resposta do robô: ${envio.erro}`)
      console.error('[meta-webhook] envio falhou', m.from, envio.erro)
      break
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('ok')

  const cru = await req.text()
  if (!(await assinaturaValida(cru, req.headers.get('x-hub-signature-256')))) {
    console.warn('[meta-webhook] assinatura invalida: confira META_APP_SECRET')
    return new Response('assinatura invalida', { status: 401 })
  }

  try {
    const corpo = JSON.parse(cru)
    for (const entrada of corpo.entry ?? []) {
      for (const mudanca of entrada.changes ?? []) {
        const valor = mudanca.value ?? {}
        for (const st of valor.statuses ?? []) {
          await banco.from('mensagens').update({ status_envio: st.status, erro_envio: st.errors?.[0]?.title ?? null }).eq('wamid', st.id)
        }
        for (const m of (valor.messages ?? []) as MensagemMeta[]) {
          try {
            await processar(m)
          } catch (erro) {
            console.error('[meta-webhook] erro ao processar', m.id, erro)
          }
        }
      }
    }
  } catch (erro) {
    console.error('[meta-webhook] corpo invalido', erro)
  }
  return new Response('ok')
})
