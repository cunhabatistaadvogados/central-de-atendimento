// Conversa com o robo de verdade, para o painel de familias simuladas por IA
// (mesmo jeito do painel do Dr. Marcello, 20/10/2026).
//
//   node tests/painel/conversar.ts <conversa.json>
//
//   { "inicio": "2026-10-19T13:00:00Z", "mensagens": ["oi", "é pro meu filho", ...] }
//   ROBO=<arquivo> node tests/painel/conversar.ts <conversa.json>   noutra versao do robo
//
// O robo e deterministico: a conversa inteira roda de novo a cada chamada, e a
// familia so acrescenta a mensagem nova no fim da lista. Saida: cada turno,
// os sinais para o sistema, as regras do escritorio quebradas e a ficha.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { EstadoRobo } from '../../supabase/functions/_shared/robo.ts'
import { conferir } from './regras.ts'

type Robo = typeof import('../../supabase/functions/_shared/robo.ts')
const { novoEstado, responder } = (await import(process.env.ROBO ? pathToFileURL(resolve(process.env.ROBO)).href : '../../supabase/functions/_shared/robo.ts')) as Robo

const arquivo = process.argv[2]
if (!arquivo) {
  console.error('uso: node tests/painel/conversar.ts <conversa.json>')
  process.exit(1)
}
const { inicio = '2026-10-19T13:00:00Z', mensagens = [] } = JSON.parse(readFileSync(arquivo, 'utf8')) as { inicio?: string; mensagens: string[] }

let estado: EstadoRobo = novoEstado()
const agora = new Date(inicio)
mensagens.forEach((fala, i) => {
  const r = responder(estado, fala, new Date(agora.getTime() + i * 60000))
  console.log(`FAMÍLIA: ${fala}`)
  if (estado.pausado) console.log('  (robô pausado: a mensagem vai para a equipe, ninguém responde automático)')
  for (const resposta of r.respostas) {
    console.log(`ROBÔ: ${resposta.replace(/\n/g, '\n      ')}`)
    for (const v of conferir(resposta, { falasDoCliente: mensagens.slice(0, i + 1) })) console.log(`  !! REGRA [${v.gravidade}]: ${v.regra} (${v.trecho})`)
  }
  for (const s of r.sinais) console.log(`  [sinal] ${JSON.stringify(s)}`)
  estado = r.estado
})
console.log('\nESTADO')
console.log(`  pausado: ${estado.pausado}${estado.motivoPausa ? ` (${estado.motivoPausa})` : ''}`)
console.log(`  próxima pergunta do robô: ${estado.ultimaPergunta ?? '(nenhuma)'}`)
console.log(`  ficha: ${JSON.stringify(estado.ficha)}`)
