// Retomada de quem parou de responder (Lucas e Edu, 22/10/2026). O pg_cron
// chama a cada 15 minutos. Familia com o robo esperando resposta (etapa novo,
// qualificacao ou qualificado, robo ligado, ultima mensagem do robo) recebe a
// pergunta em que parou, na regua de Preferencias: por padrao 4 tentativas,
// uma por dia, cada uma num horario (8h, 12h30, 18h30, 10h), domingo nao.
// Dentro das 24h da ultima mensagem dela vai texto livre; fora, so o modelo
// aprovado "retomar_atendimento". Respondeu: a regua zera sozinha (o
// "desde" deixa de bater com ultima_do_cliente_em). Equipe falou: para.
// Sem login: so manda o que esta na hora, uma vez por tentativa.
// Publicado pelo painel como arquivo unico (robo.ts + whatsapp.ts + este).
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  MODELO_RETOMADA,
  RETOMADA_PADRAO,
  TEXTO_MODELO_RETOMADA,
  mensagemDeRetomada,
  perguntaParaRetomar,
  primeiroNome,
  proximaRetomada,
  type AgendaDaVez,
  type ConfigDaRetomada,
  type EstadoRobo,
  type GradeDaAgenda,
} from '../_shared/robo.ts'
import { enviarModelo, enviarTexto } from '../_shared/whatsapp.ts'

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const HORA = 3600000
const DIA = 24 * HORA

interface Regua {
  desde: string
  feitas: number
  ultimaEm?: string
  /** envio recusado (modelo ainda nao aprovado, numero invalido): tenta de novo no dia seguinte */
  falhouEm?: string
}

async function anotar(clienteId: string, texto: string) {
  await banco.from('eventos').insert({ id: crypto.randomUUID(), cliente_id: clienteId, tipo: 'sistema', texto, em: new Date().toISOString() })
}

/** Grade e horarios tomados, para a pergunta do horario oferecer so o que esta livre. */
async function agenda(): Promise<AgendaDaVez> {
  const [reunioes, config] = await Promise.all([
    banco.from('clientes').select('reuniao').not('reuniao', 'is', null).neq('etapa', 'perdido'),
    banco.from('agenda_config').select('grade').eq('id', 1).maybeSingle(),
  ])
  const ocupados = (reunioes.data ?? [])
    .map((l: { reuniao: { data?: string; pedidoEm?: string; confirmada?: boolean } | null }) => (l.reuniao?.confirmada ? l.reuniao.data : l.reuniao?.pedidoEm))
    .filter((d): d is string => Boolean(d))
  return { ocupados, grade: (config.data?.grade as GradeDaAgenda | undefined) ?? undefined }
}

Deno.serve(async () => {
  const agora = Date.now()
  const { data: linha } = await banco.from('configuracoes').select('valor').eq('chave', 'retomada').maybeSingle()
  const cfg: ConfigDaRetomada = { ...RETOMADA_PADRAO, ...((linha?.valor as Partial<ConfigDaRetomada> | null) ?? {}) }
  if (!cfg.ligado) return Response.json({ ok: true, desligado: true })
  // Nunca de madrugada nem tarde da noite, mesmo se o agendador atrasar.
  const horaDeSantos = new Date(agora - 3 * HORA).getUTCHours()
  if (horaDeSantos < 8 || horaDeSantos >= 20) return Response.json({ ok: true, foraDoHorario: true })

  const limite = new Date(agora - (cfg.ateDias + cfg.tentativas * Math.max(1, cfg.intervaloDias) + 3) * DIA).toISOString()
  const { data, error } = await banco
    .from('clientes')
    .select('id, nome, telefone, robo, retomada, ultima_do_cliente_em')
    .in('etapa', ['novo', 'qualificacao', 'qualificado'])
    .not('historico', 'is', true)
    .not('ultima_do_cliente_em', 'is', null)
    .gte('ultima_do_cliente_em', limite)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let daAgenda: AgendaDaVez | null = null
  const feitos: string[] = []
  for (const c of data ?? []) {
    const estado = c.robo as EstadoRobo | null
    if (!estado?.ficha || estado.pausado || !c.telefone) continue
    const silencio: string = c.ultima_do_cliente_em
    const anterior = c.retomada as Regua | null
    const regua: Regua = anterior?.desde === silencio ? anterior : { desde: silencio, feitas: 0 }
    if (regua.feitas === 0 && agora - new Date(silencio).getTime() > cfg.ateDias * DIA) continue
    if (regua.falhouEm && agora - new Date(regua.falhouEm).getTime() < 20 * HORA) continue
    const quando = proximaRetomada(cfg, silencio, regua.feitas, regua.ultimaEm)
    if (quando === null || agora < quando) continue

    // A ultima palavra tem que ser do robo: se foi da equipe, ela cuida.
    const { data: ultima } = await banco.from('mensagens').select('de').eq('cliente_id', c.id).order('em', { ascending: false }).limit(1).maybeSingle()
    if (ultima?.de !== 'robo') continue
    daAgenda ??= await agenda()
    const pergunta = perguntaParaRetomar(estado, new Date(agora), daAgenda)
    if (!pergunta) continue

    const tentativa = regua.feitas + 1
    const nome = primeiroNome(c.nome ?? '') || 'tudo bem'
    const naJanela = agora - new Date(silencio).getTime() < DIA - 10 * 60000
    const texto = naJanela ? mensagemDeRetomada(tentativa, cfg.tentativas, c.nome ?? '', pergunta.texto) : TEXTO_MODELO_RETOMADA.replace('{{1}}', nome).replace('{{2}}', pergunta.texto)
    const envio = naJanela ? await enviarTexto(c.telefone, texto) : await enviarModelo(c.telefone, MODELO_RETOMADA, [nome, pergunta.texto])

    await banco.from('mensagens').insert({
      cliente_id: c.id,
      de: 'robo',
      texto,
      wamid: envio.wamid ?? null,
      status_envio: envio.ok ? 'sent' : 'failed',
      erro_envio: envio.erro ?? null,
    })
    // Falhou nao gasta tentativa (o modelo pode so nao estar aprovado ainda):
    // tenta de novo no dia seguinte, sem insistir a cada 15 minutos.
    const nova: Regua = envio.ok ? { desde: silencio, feitas: tentativa, ultimaEm: new Date(agora).toISOString() } : { ...regua, falhouEm: new Date(agora).toISOString() }
    const mudancas: Record<string, unknown> = { retomada: nova }
    if (pergunta.ofertas?.length) mudancas.robo = { ...estado, ofertas: pergunta.ofertas }
    await banco.from('clientes').update(mudancas).eq('id', c.id)
    await anotar(
      c.id,
      envio.ok ? `Retomada ${tentativa}/${cfg.tentativas} enviada (${naJanela ? 'texto' : 'modelo aprovado'})` : `Retomada ${tentativa}/${cfg.tentativas} NÃO enviada (tenta de novo amanhã): ${envio.erro}`,
    )
    if (envio.ok && tentativa >= cfg.tentativas) await anotar(c.id, `Retomada encerrada: ${cfg.tentativas} tentativas sem resposta`)
    feitos.push(`${c.id}: ${tentativa} ${envio.ok ? 'ok' : envio.erro}`)
  }
  return Response.json({ ok: true, feitos })
})
