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
import { assinaturaValida, baixarMidia, enviarTexto } from '../_shared/whatsapp.ts'
import { interpretar } from '../_shared/interprete.ts'

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
  /** Anuncio de clique para WhatsApp do Meta (so na 1a mensagem que veio dele). */
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; ctwa_clid?: string }
  image?: MidiaMeta
  audio?: MidiaMeta
  video?: MidiaMeta
  document?: MidiaMeta
  sticker?: MidiaMeta
  /** Resposta citada: id da mensagem que a familia arrastou para responder. */
  context?: { id?: string }
  reaction?: { message_id?: string; emoji?: string }
  location?: { latitude?: number; longitude?: number; name?: string; address?: string }
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[]
}

interface MidiaMeta {
  id: string
  mime_type?: string
  caption?: string
  filename?: string
}

type TipoMidia = 'imagem' | 'audio' | 'video' | 'documento' | 'figurinha'
const TIPO_DA_MIDIA: Record<string, TipoMidia> = { image: 'imagem', audio: 'audio', video: 'video', document: 'documento', sticker: 'figurinha' }
// Mesmo rotulo da tela (src/components/Midia.tsx): e o texto da previa na lista.
const ROTULO: Record<TipoMidia, string> = { imagem: '📷 Foto', audio: '🎤 Áudio', video: '🎥 Vídeo', documento: '📄 Documento', figurinha: '🌟 Figurinha' }
const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
}

// Origem do contato novo (etiquetas pedidas pelo Lucas em 21/10/2026). O
// anuncio do Meta traz o referral; o Google nao manda nada, entao vale a
// frase pronta do link da campanha ("vi no Google..."). O robo tambem le a
// origem e corrige depois, se o contato ficou como "anuncio".
function origemDoContato(m: MensagemMeta, texto: string): string {
  if (m.referral) return 'meta'
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/\bgoogle\b/.test(t)) return 'google'
  if (/advogad[oa] previdenci|\bpelo site\b|\bno site\b/.test(t)) return 'site'
  if (/\b(instagram|facebook)\b/.test(t)) return 'meta'
  return 'anuncio'
}

const NOME_DA_ORIGEM: Record<string, string> = { meta: 'anúncio do Meta', google: 'Google', site: 'site', anuncio: 'anúncio' }

interface Conteudo {
  /** O que fica gravado e aparece na tela. */
  texto: string
  /** O que o robo le. Vazio: reacao e figurinha nao sao resposta, o robo nao fala. */
  entrada: string
  midia?: MidiaMeta & { tipo: TipoMidia }
}

function conteudoDaMensagem(m: MensagemMeta): Conteudo {
  const so = (t: string): Conteudo => ({ texto: t, entrada: t })
  if (m.type === 'text') return so(m.text?.body ?? '')
  if (m.type === 'button') return so(m.button?.text ?? '')
  if (m.type === 'interactive') return so(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '')
  const tipo = TIPO_DA_MIDIA[m.type]
  const midia = tipo ? m[m.type as 'image' | 'audio' | 'video' | 'document' | 'sticker'] : undefined
  if (tipo && midia?.id) {
    // O robo segue lendo so "[audio recebido]"/"[arquivo recebido]" (roteiro
    // testado); a legenda fica gravada para a equipe ler.
    const legenda = midia.caption?.trim()
    const texto = legenda || (tipo === 'documento' && midia.filename ? `📄 ${midia.filename}` : ROTULO[tipo])
    const entrada = tipo === 'figurinha' ? '' : tipo === 'audio' ? '[áudio recebido]' : '[arquivo recebido]'
    return { texto, entrada, midia: { ...midia, tipo } }
  }
  if (m.type === 'reaction') return { texto: m.reaction?.emoji ? `Reagiu com ${m.reaction.emoji}` : '', entrada: '' }
  if (m.type === 'location' && m.location) {
    const l = m.location
    const lugar = [l.name, l.address].filter(Boolean).join(' - ')
    return { texto: `📍 Localização${lugar ? `: ${lugar}` : ''}\nhttps://maps.google.com/?q=${l.latitude},${l.longitude}`, entrada: '[arquivo recebido]' }
  }
  if (m.type === 'contacts' && m.contacts?.length) {
    const lista = m.contacts.map((k) => [k.name?.formatted_name, k.phones?.[0]?.phone].filter(Boolean).join(' ')).join('\n')
    return { texto: `👤 Contato: ${lista}`, entrada: '[arquivo recebido]' }
  }
  return { texto: 'Mensagem que a API do WhatsApp não mostra (enquete, visualização única ou outro tipo). Veja no celular.', entrada: '[arquivo recebido]' }
}

// Baixa da Meta e guarda no bucket privado: o link da Meta expira em minutos
// e so abre com o token, a tela nunca conseguiria mostrar direto.
async function guardarMidia(linhaId: string, clienteId: string, midia: MidiaMeta & { tipo: TipoMidia }) {
  const baixada = await baixarMidia(midia.id)
  if (!baixada.ok) {
    await evento(clienteId, 'sistema', `Não consegui baixar a mídia (${midia.tipo}) do WhatsApp: ${baixada.erro}`)
    return
  }
  const mime = (baixada.mime || midia.mime_type || 'application/octet-stream').split(';')[0].trim()
  const ext = EXTENSAO[mime] ?? midia.filename?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase() ?? 'bin'
  const caminho = `${clienteId}/${linhaId}.${ext}`
  const subida = await banco.storage.from('midias').upload(caminho, baixada.bytes, { contentType: mime, upsert: true })
  if (subida.error) {
    await evento(clienteId, 'sistema', `Não consegui guardar a mídia do WhatsApp: ${subida.error.message}`)
    return
  }
  await banco.from('mensagens').update({ midia: caminho }).eq('id', linhaId)
}

/**
 * Horarios ja tomados por outras familias: reuniao confirmada (data) ou pedida
 * ao robo num horario exato (pedidoEm). O robo nao oferece esses de novo
 * (Catiane e outra familia receberam "amanha 9h ou 10h" no mesmo dia).
 */
async function horariosOcupados(clienteId: string): Promise<string[]> {
  const { data, error } = await banco.from('clientes').select('reuniao').not('reuniao', 'is', null).neq('etapa', 'perdido').neq('id', clienteId)
  if (error) {
    console.warn('[meta-webhook] horarios ocupados:', error.message)
    return []
  }
  const agora = Date.now()
  return (data ?? [])
    .map((l: { reuniao: { data?: string; pedidoEm?: string; confirmada?: boolean } | null }) => (l.reuniao?.confirmada ? l.reuniao.data : l.reuniao?.pedidoEm))
    .filter((d): d is string => Boolean(d) && new Date(d as string).getTime() > agora - 3600000)
}

// "Nao entendi" das regras: o contador subiu ou o robo passou para a equipe por isso.
function naoEntendeu(antes: EstadoRobo, r: { estado: EstadoRobo; sinais: { tipo: string; motivo?: string }[] }): boolean {
  return r.estado.naoEntendeu > (antes.naoEntendeu ?? 0) || r.sinais.some((s) => s.tipo === 'encaminhar' && /não entendeu/i.test(s.motivo ?? ''))
}

// A pergunta que a familia viu por ultimo: vai para o interprete como contexto.
async function ultimaFalaDoRobo(clienteId: string): Promise<string | null> {
  const { data } = await banco.from('mensagens').select('texto').eq('cliente_id', clienteId).eq('de', 'robo').order('em', { ascending: false }).limit(1).maybeSingle()
  return data?.texto ?? null
}

async function evento(clienteId: string, tipo: string, texto: string) {
  await banco.from('eventos').insert({ cliente_id: clienteId, tipo, texto })
}

async function processar(m: MensagemMeta) {
  const conteudo = conteudoDaMensagem(m)
  const texto = conteudo.texto.trim()
  if (!texto) return
  const em = new Date(Number(m.timestamp) * 1000 || Date.now())

  // Cliente por telefone (cria na primeira mensagem).
  let { data: cliente } = await banco.from('clientes').select('*').eq('telefone', m.from).maybeSingle()
  let novo = false
  if (!cliente) {
    const origem = origemDoContato(m, texto)
    const anuncio = m.referral
      ? { titulo: m.referral.headline ?? null, texto: m.referral.body ?? null, link: m.referral.source_url ?? null, id: m.referral.source_id ?? null, tipo: m.referral.source_type ?? null, ctwa_clid: m.referral.ctwa_clid ?? null }
      : null
    const criado = await banco.from('clientes').insert({ telefone: m.from, origem, anuncio, robo: novoEstado() }).select('*').single()
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
      novo = true
      await evento(cliente.id, 'sistema', `Contato chegou pelo ${NOME_DA_ORIGEM[origem]}${anuncio?.titulo ? `: "${anuncio.titulo}"` : ''}`)
    }
  }
  if (!cliente) throw new Error(`cliente ${m.from} nao encontrado nem criado`)

  // Idempotencia: a mesma mensagem da Meta so entra uma vez.
  const gravada = await banco
    .from('mensagens')
    .insert({
      cliente_id: cliente.id,
      de: 'cliente',
      texto,
      wamid: m.id,
      em: em.toISOString(),
      responde_a: m.context?.id ?? (m.type === 'reaction' ? (m.reaction?.message_id ?? null) : null),
      midia_tipo: conteudo.midia?.tipo ?? null,
      midia_nome: conteudo.midia?.filename ?? null,
    })
    .select('id')
    .single()
  if (gravada.error) {
    if (gravada.error.code === '23505') return
    throw gravada.error
  }

  // Baixar a midia nao segura o robo nem a resposta para a Meta: corre junto
  // e termina depois do 200 (EdgeRuntime.waitUntil).
  if (conteudo.midia) {
    const tarefa = guardarMidia(gravada.data.id, cliente.id, conteudo.midia).catch((e) => console.error('[meta-webhook] midia', m.id, e))
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime
    if (runtime) runtime.waitUntil(tarefa)
    else await tarefa
  }

  // Reacao e figurinha: a equipe ve, o robo nao responde. Figurinha como
  // primeiro contato vale um "oi", senao a familia ficaria sem abertura.
  const entrada = conteudo.entrada || (novo && m.type !== 'reaction' ? 'oi' : '')
  if (!entrada) {
    await banco
      .from('clientes')
      .update({ nao_lidas: (cliente.nao_lidas ?? 0) + (m.type === 'reaction' ? 0 : 1), ultima_do_cliente_em: em.toISOString() })
      .eq('id', cliente.id)
    return
  }

  const estado: EstadoRobo = cliente.robo?.ficha ? cliente.robo : novoEstado()
  const ocupados = await horariosOcupados(cliente.id)
  let r = responder(estado, entrada, em, ocupados)

  // As regras nao entenderam: o interprete (Claude) reescreve a resposta e o
  // robo tenta de novo. So vale se a segunda volta entender; senao fica como
  // antes. Audio e arquivo nao passam (nao ha texto para interpretar).
  if (naoEntendeu(estado, r) && !/^\[(áudio|arquivo) recebido\]$/.test(entrada)) {
    const pergunta = await ultimaFalaDoRobo(cliente.id)
    if (pergunta) {
      const i = await interpretar(pergunta, entrada)
      if (i.erro) console.warn('[meta-webhook] interprete:', i.erro)
      if (i.entendeu) {
        const segunda = responder(estado, i.resposta, em, ocupados)
        if (!naoEntendeu(estado, segunda)) {
          r = segunda
          await evento(cliente.id, 'robo', `Intérprete: "${entrada.slice(0, 120)}" entendido como "${i.resposta}"`)
        }
      }
    }
  }

  let etapa: Etapa = cliente.etapa
  let reuniao = cliente.reuniao
  let origem: string = cliente.origem
  let motivoPerda: string | null = cliente.motivo_perda ?? null
  for (const s of r.sinais) {
    // Origem lida na conversa so troca o "anuncio" sem plataforma.
    if (s.tipo === 'origem' && s.origem && s.origem !== 'anuncio' && origem === 'anuncio') {
      origem = s.origem
      await evento(cliente.id, 'sistema', `Origem: ${NOME_DA_ORIGEM[s.origem] ?? s.origem} (pela mensagem da família)`)
    }
    if (s.tipo === 'duvida') await evento(cliente.id, 'robo', `Dúvida para o advogado: "${s.texto}"`)
    if (s.tipo === 'pendencia_resolvida') {
      await banco.from('pendencias').update({ resolvida: true }).eq('cliente_id', cliente.id).eq('texto', s.texto).eq('resolvida', false)
      await evento(cliente.id, 'robo', `Pendência resolvida pela família: ${s.texto}`)
    }
    // Quem desiste vai para "Perdido" e nao recebe mais retorno automatico (C28).
    if (s.tipo === 'encerrar') {
      etapa = 'perdido'
      motivoPerda = 'Desistiu do pedido'
      await banco.from('pendencias').update({ resolvida: true }).eq('cliente_id', cliente.id).eq('resolvida', false)
      await evento(cliente.id, 'etapa', 'Robô encerrou: a família desistiu')
    }
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
      reuniao = { quando: s.quando, advogado: 'Dr. André', confirmada: false, ...(s.em ? { pedidoEm: s.em } : {}) }
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
      origem,
      motivo_perda: motivoPerda,
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
