// Envio do contrato para assinatura pela D4Sign (23/10/2026). Regras do Lucas
// (21/10/2026): cofre CB&AA; a familia ASSINA primeiro, com o link pelo
// WhatsApp; depois o Dr. Andre APROVA e o Artur ASSINA COMO PARTE pelo
// escritorio, nessa ordem; sem testemunhas. (O Lucas assinava; desde
// 23/10/2026 o fluxo e "Cliente X Andre como Aprovador X Artur".)
//
// Chamadas da tela (so a equipe; quem chama e conferido aqui dentro):
//   enviar    {cliente_id, arquivo_base64, nome_arquivo}: sobe o .docx gerado
//             na tela, cadastra os 3 signatarios, liga o aviso e envia
//   situacao  {cliente_id}: em que pe esta cada assinatura (e, se ja
//             terminou e o aviso se perdeu, marca como assinado)
//   reenviar  {cliente_id}: manda o link de novo para o WhatsApp da familia
//
// Avisos da D4Sign (POST em form-data, sem login): assinou, finalizou,
// cancelou. No "finalizou" baixa o PDF assinado para o bucket "contratos" e
// marca o contrato como assinado. Com o segredo D4SIGN_HMAC confere a
// assinatura do aviso; sem ele, confere a situacao direto na D4Sign antes de
// mudar qualquer coisa.
//
// O envio sai com skip_email '0': com '1' a D4Sign entende assinatura dentro
// do site e nao avisa ninguem, nem por WhatsApp (teste de 22/10/2026).
// A API aceita 10 chamadas por hora: o envio usa 4, a situacao 2.
// Arquivo unico, sem import local: publicado colando no editor do painel,
// com Verify JWT desligado (os avisos da D4Sign nao trazem login).
import { createClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://secure.d4sign.com.br/api/v1'
const COFRE_CBAA = '19eca1a8-cdec-4df9-abc0-4311b724ecce'
// Quem aprova e quem assina pelo escritorio, como nos contratos de antes.
const DR_ANDRE = 'boldrincardoso.advocacia@gmail.com'
const ARTUR = 'artur@cunhabatista.com.br'
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ETAPAS_ANTES_DO_CONTRATO = ['novo', 'qualificacao', 'qualificado', 'reuniao']

const URL_DO_PROJETO = Deno.env.get('SUPABASE_URL')!
const banco = createClient(URL_DO_PROJETO, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// A D4Sign autentica pela URL (tokenAPI e cryptKey); nunca devolver isso.
function chaves(): string {
  const cripto = Deno.env.get('D4SIGN_CRYPT_KEY')
  return new URLSearchParams({ tokenAPI: Deno.env.get('D4SIGN_TOKEN_API') ?? '', ...(cripto ? { cryptKey: cripto } : {}) }).toString()
}

async function lerResposta(resp: Response) {
  const texto = await resp.text()
  let dados: unknown = texto.slice(0, 500)
  try {
    dados = JSON.parse(texto)
  } catch {
    // resposta que nao e JSON: fica o comeco do texto
  }
  return { ok: resp.ok, status: resp.status, dados }
}

async function d4(caminho: string, corpo?: unknown) {
  const resp = await fetch(`${API}${caminho}?${chaves()}`, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  return lerResposta(resp)
}

// O .docx vai em multipart: e o formato em que a D4Sign aceita Word e converte para PDF.
async function d4Arquivo(caminho: string, bytes: Uint8Array<ArrayBuffer>, nome: string) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: MIME_DOCX }), nome)
  const resp = await fetch(`${API}${caminho}?${chaves()}`, { method: 'POST', headers: { Accept: 'application/json' }, body: form })
  return lerResposta(resp)
}

/** Mensagem curta do erro da D4Sign para a tela. */
function motivo(r: { status: number; dados: unknown }): string {
  const d = r.dados as { message?: unknown; mensagem_pt?: unknown } | string
  const m = typeof d === 'string' ? d : (d?.mensagem_pt ?? d?.message)
  return `${typeof m === 'string' ? m : JSON.stringify(m ?? '')}`.slice(0, 200) || `HTTP ${r.status}`
}

async function evento(clienteId: string, tipo: string, texto: string) {
  await banco.from('eventos').insert({ cliente_id: clienteId, tipo, texto })
  // A tela escuta a tabela clientes (Realtime): mexer nela faz a ficha se atualizar.
  await banco.from('clientes').update({ atualizado_em: new Date().toISOString() }).eq('id', clienteId)
}

const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

type Signatario = Record<string, string>

function listaDeSignatarios(dados: unknown): Signatario[] {
  return (Array.isArray(dados) ? dados : [dados]).flatMap((x: { list?: Signatario[] }) => x?.list ?? [])
}

/** Quem e cada signatario, para a tela e o historico. */
function papel(s: Signatario, telefone: string): string {
  const email = String(s.email ?? '').toLowerCase()
  if (email === DR_ANDRE) return 'Dr. André'
  if (email === ARTUR) return 'Artur'
  if (telefone && [s.email, s.embed_smsnumber].some((v) => digitos(v) === telefone)) return 'Família'
  return s.user_name || s.email || 'Signatário'
}

// Quem esta logado precisa ser da equipe (o gateway nao confere: Verify JWT
// desligado por causa dos avisos da D4Sign).
async function membroDaEquipe(req: Request): Promise<string | null> {
  const comoUsuario = createClient(URL_DO_PROJETO, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: ehEquipe } = await comoUsuario.rpc('eh_da_equipe')
  if (!ehEquipe) return null
  const { data: usuario } = await comoUsuario.auth.getUser()
  const { data: membro } = await banco.from('equipe').select('nome').eq('user_id', usuario.user?.id).maybeSingle()
  return membro?.nome ?? 'Equipe'
}

/** Todos assinaram: guarda o PDF assinado e fecha o contrato. */
async function finalizar(clienteId: string, uuid: string) {
  const { data: atual } = await banco.from('contratos').select('status').eq('cliente_id', clienteId).maybeSingle()
  if (atual?.status === 'assinado') return
  let caminho: string | null = null
  const download = await d4(`/documents/${uuid}/download`, { type: 'PDF', language: 'pt' })
  const link = (download.dados as { url?: string })?.url
  if (link) {
    const arquivo = await fetch(link)
    if (arquivo.ok) {
      caminho = `${clienteId}/contrato.pdf`
      const subida = await banco.storage.from('contratos').upload(caminho, new Uint8Array(await arquivo.arrayBuffer()), { contentType: 'application/pdf', upsert: true })
      if (subida.error) caminho = null
    }
  }
  await banco
    .from('contratos')
    .update({ status: 'assinado', assinado_em: new Date().toISOString(), ...(caminho ? { arquivo: caminho } : {}) })
    .eq('cliente_id', clienteId)
  await banco.from('clientes').update({ etapa: 'contratado' }).eq('id', clienteId)
  await evento(
    clienteId,
    'contrato',
    caminho ? 'Contrato assinado por todos na D4Sign. O PDF assinado está na ficha.' : 'Contrato assinado por todos na D4Sign. Não consegui baixar o PDF: pegue na D4Sign.',
  )
}

// HMAC-SHA256 do uuid do documento com a chave gerada na D4Sign ("Gerar Secret Key MAC").
async function hmacDoUuid(segredo: string, uuid: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(uuid)))
  return [...assinatura].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Aviso da D4Sign: type_post 1 finalizou, 2 nao entregou, 3 cancelou, 4 alguem assinou. */
async function avisoDaD4Sign(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null)
  const uuid = String(form?.get('uuid') ?? '')
  const tipo = String(form?.get('type_post') ?? '')
  const email = String(form?.get('email') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return new Response('uuid invalido', { status: 400 })
  // Documento que nao saiu da Central (testes, envios feitos na mao): ignora.
  const { data: contrato } = await banco.from('contratos').select('cliente_id, status').eq('d4sign_uuid', uuid).maybeSingle()
  if (!contrato) return new Response('ok')
  const { data: cliente } = await banco.from('clientes').select('telefone').eq('id', contrato.cliente_id).maybeSingle()
  const telefone = digitos(cliente?.telefone)

  const segredo = Deno.env.get('D4SIGN_HMAC')
  if (segredo) {
    const recebido = (req.headers.get('content-hmac') ?? '').replace(/^sha256=/i, '').toLowerCase()
    if (recebido !== (await hmacDoUuid(segredo, uuid))) return new Response('assinatura invalida', { status: 401 })
  }
  // Sem a chave HMAC, a situacao vem da propria D4Sign (1 chamada), nunca do aviso.
  const confirmar = async (esperado: string) => {
    if (segredo) return true
    const r = await d4(`/documents/${uuid}`)
    const doc = (Array.isArray(r.dados) ? r.dados[0] : r.dados) as { statusId?: string } | undefined
    return String(doc?.statusId ?? '') === esperado
  }

  if (tipo === '4') {
    const quem = papel({ email }, telefone)
    await evento(contrato.cliente_id, 'contrato', quem === 'Dr. André' ? 'Dr. André aprovou o contrato na D4Sign.' : quem === 'Artur' ? 'Artur assinou o contrato na D4Sign.' : 'A família assinou o contrato na D4Sign.')
  } else if (tipo === '1') {
    if (await confirmar('4')) await finalizar(contrato.cliente_id, uuid)
  } else if (tipo === '3') {
    if (contrato.status === 'enviado' && (await confirmar('6'))) {
      // Volta a "pronto": a equipe corrige e envia de novo.
      await banco.from('contratos').update({ status: 'pronto', d4sign_uuid: null, enviado_em: null }).eq('cliente_id', contrato.cliente_id)
      await evento(contrato.cliente_id, 'contrato', 'Contrato cancelado na D4Sign. Ele voltou para "pronto para envio".')
    }
  } else if (tipo === '2') {
    await evento(contrato.cliente_id, 'contrato', `A D4Sign não conseguiu entregar o contrato${email ? ` para ${email}` : ''}.`)
  }
  return new Response('ok')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('ok')
  if (!Deno.env.get('D4SIGN_TOKEN_API')) return json({ error: 'D4SIGN_TOKEN_API ausente nos segredos.' }, 500)

  // Aviso da D4Sign: form-data, sem login.
  const tipoDoCorpo = req.headers.get('content-type') ?? ''
  if (/multipart\/form-data|application\/x-www-form-urlencoded/i.test(tipoDoCorpo)) return avisoDaD4Sign(req)

  const autor = await membroDaEquipe(req)
  if (!autor) return json({ error: 'Acesso só para a equipe do escritório.' }, 403)
  const { acao, cliente_id, arquivo_base64, nome_arquivo } = await req.json().catch(() => ({}))
  if (!cliente_id) return json({ error: 'cliente_id é obrigatório.' }, 400)

  const { data: cliente } = await banco.from('clientes').select('id, nome, telefone, etapa').eq('id', cliente_id).maybeSingle()
  const { data: contrato } = await banco.from('contratos').select('*').eq('cliente_id', cliente_id).maybeSingle()
  if (!cliente || !contrato) return json({ error: 'Cliente ou contrato não encontrado.' }, 404)
  const telefone = digitos(cliente.telefone)

  if (acao === 'enviar') {
    if (contrato.d4sign_uuid && contrato.status === 'enviado') return json({ error: 'Este contrato já foi enviado. Use "Reenviar link".' }, 409)
    if (contrato.status === 'assinado') return json({ error: 'Este contrato já está assinado.' }, 409)
    if (!contrato.ok_advogado) return json({ error: 'Falta o OK do advogado.' }, 409)
    const email = String(contrato.dados?.email ?? '').trim()
    if (!telefone && !email) return json({ error: 'A família não tem WhatsApp nem e-mail cadastrado.' }, 400)
    if (!arquivo_base64) return json({ error: 'Faltou o arquivo do contrato.' }, 400)

    // 1. o .docx gerado na tela vai para o cofre CB&AA
    const bytes = Uint8Array.from(atob(String(arquivo_base64)), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
    const subida = await d4Arquivo(`/documents/${COFRE_CBAA}/upload`, bytes, String(nome_arquivo || 'Contrato.docx'))
    const uuid = (subida.dados as { uuid?: string })?.uuid
    if (!uuid) return json({ error: `A D4Sign recusou o arquivo: ${motivo(subida)}` }, 502)

    // 2. signatarios na ordem: familia assina, Dr. Andre aprova, Artur assina como parte
    const base = { foreign: '0', certificadoicpbr: '0', assinatura_presencial: '0' }
    // So WhatsApp: a D4Sign grava o numero no lugar do e-mail e confirma por token no WhatsApp.
    const familia: Signatario = telefone
      ? { ...base, act: '1', whatsapp_number: `+${telefone}`, embed_methodauth: 'whats', embed_smsnumber: `+${telefone}` }
      : { ...base, act: '1', email }
    const lista = await d4(`/documents/${uuid}/createlist`, { signers: [familia, { ...base, act: '2', email: DR_ANDRE }, { ...base, act: '4', email: ARTUR }] })
    if (!lista.ok) {
      await d4(`/documents/${uuid}/cancel`, { comment: 'Erro ao cadastrar os signatários pela Central' })
      return json({ error: `A D4Sign não aceitou os signatários: ${motivo(lista)}` }, 502)
    }

    // 3. aviso de volta (assinou, finalizou, cancelou) para esta mesma funcao
    const gancho = await d4(`/documents/${uuid}/webhooks`, { url: `${URL_DO_PROJETO}/functions/v1/contrato-d4sign` })

    // 4. envia seguindo a ordem
    const mensagem = 'Contrato de prestação de serviços do escritório Cunha, Batista & Advogados Associados.'
    const envio = await d4(`/documents/${uuid}/sendtosigner`, { message: mensagem, skip_email: '0', workflow: '1' })
    if (!envio.ok) return json({ error: `O contrato subiu para a D4Sign, mas o envio falhou: ${motivo(envio)}`, documento: uuid }, 502)

    const agora = new Date().toISOString()
    await banco
      .from('contratos')
      .update({ status: 'enviado', d4sign_uuid: uuid, enviado_em: agora, gerado_em: contrato.gerado_em ?? agora })
      .eq('cliente_id', cliente_id)
    if (ETAPAS_ANTES_DO_CONTRATO.includes(cliente.etapa)) {
      await banco.from('clientes').update({ etapa: 'contrato' }).eq('id', cliente_id)
      await evento(cliente_id, 'etapa', 'Contrato enviado: etapa Contrato')
    }
    await evento(
      cliente_id,
      'contrato',
      `${autor} enviou o contrato pela D4Sign: a família assina ${telefone ? 'pelo WhatsApp' : 'pelo e-mail'}, depois o Dr. André aprova e o Artur assina.`,
    )
    return json({ ok: true, documento: uuid, aviso_ligado: gancho.ok })
  }

  if (!contrato.d4sign_uuid) return json({ error: 'Este contrato não foi enviado pela Central.' }, 409)
  const uuid = contrato.d4sign_uuid as string

  if (acao === 'situacao') {
    const [doc, sig] = await Promise.all([d4(`/documents/${uuid}`), d4(`/documents/${uuid}/list`)])
    const info = (Array.isArray(doc.dados) ? doc.dados[0] : doc.dados) as { statusId?: string; statusName?: string } | undefined
    if (!doc.ok || !info?.statusId) return json({ error: `Não consegui ver a situação na D4Sign: ${motivo(doc)}` }, 502)
    // Aviso de "finalizou" perdido: a consulta tambem fecha o contrato.
    if (String(info.statusId) === '4' && contrato.status !== 'assinado') await finalizar(cliente_id, uuid)
    return json({
      ok: true,
      situacao: info.statusName,
      signatarios: listaDeSignatarios(sig.dados).map((s) => ({ quem: papel(s, telefone), acao: s.nomenclatura ?? '', assinou: String(s.signed) === '1' })),
    })
  }

  if (acao === 'reenviar') {
    const sig = await d4(`/documents/${uuid}/list`)
    const alvo = listaDeSignatarios(sig.dados).find((s) => papel(s, telefone) === 'Família') ?? listaDeSignatarios(sig.dados)[0]
    if (!alvo?.key_signer) return json({ error: `Não achei a família entre os signatários: ${motivo(sig)}` }, 502)
    const r = await d4(`/documents/${uuid}/resend`, { email: alvo.email, key_signer: alvo.key_signer })
    if (!r.ok) return json({ error: `A D4Sign não reenviou: ${motivo(r)}` }, 502)
    await evento(cliente_id, 'contrato', `${autor} reenviou o link do contrato para a família.`)
    return json({ ok: true })
  }

  return json({ error: `Ação desconhecida: ${acao}` }, 400)
})
