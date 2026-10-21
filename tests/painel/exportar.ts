// Exporta as conversas do Raio-X, uma por arquivo e em formato de mensagens,
// para o escritorio rodar tambem contra o CRM dele (pedido do Lucas em
// 21/10/2026). Cada arquivo traz as falas da familia e o que o robo respondeu
// antes (v2.5) e depois (v3.2).
//
//   node tests/painel/exportar.ts <pasta de saida>
//
// Precisa do robo antigo em tests/painel/resultados/antes/robo-v2.5.ts:
//   git show 0c7ba30:supabase/functions/_shared/robo.ts > tests/painel/resultados/antes/robo-v2.5.ts
// Nada de dado real: familias e conversas inventadas.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

type Robo = typeof import('../../supabase/functions/_shared/robo.ts')
const novo = (await import('../../supabase/functions/_shared/robo.ts')) as Robo
const antigo = (await import(pathToFileURL(resolve('tests/painel/resultados/antes/robo-v2.5.ts')).href)) as Robo

const saida = process.argv[2]
if (!saida) {
  console.error('uso: node tests/painel/exportar.ts <pasta de saida>')
  process.exit(1)
}
mkdirSync(saida, { recursive: true })

function rodar(robo: Robo, falas: string[], inicio: Date): string[] {
  let estado = robo.novoEstado()
  const linhas: string[] = []
  falas.forEach((fala, i) => {
    const r = robo.responder(estado, fala, new Date(inicio.getTime() + i * 60000))
    linhas.push(`FAMÍLIA: ${fala}`)
    if (estado.pausado) linhas.push('  (robô pausado: a equipe responde)')
    for (const resposta of r.respostas) linhas.push(`ROBÔ: ${resposta.replace(/\n/g, '\n      ')}`)
    const sinais = r.sinais.filter((s) => s.tipo !== 'etapa' && s.tipo !== 'origem')
    for (const s of sinais) linhas.push(`  [${s.tipo}] ${'motivo' in s ? s.motivo : 'texto' in s ? s.texto : 'quando' in s ? s.quando : ''}`)
    estado = r.estado
  })
  linhas.push('', `Ficha final: ${JSON.stringify(estado.ficha)}`)
  return linhas
}

function arquivo(nome: string, titulo: string, falas: string[], inicio: Date, depoisFalas?: string[]) {
  const partes = [
    titulo,
    '',
    'FALAS DA FAMÍLIA (uma mensagem por linha, para mandar ao robô na ordem):',
    ...falas.map((f, i) => `${String(i + 1).padStart(2, '0')}. ${f}`),
    '',
    '================ ANTES: robô v2.5 (08/10/2026) ================',
    ...rodar(antigo, falas, inicio),
    '',
    '================ DEPOIS: robô v3.2 (21/10/2026) ================',
  ]
  if (depoisFalas) {
    partes.push('(A família simulada conversou de novo com o robô v3.2, com o mesmo perfil e as mesmas dúvidas; as falas mudam porque ela responde ao que o robô pergunta. Abaixo, essas falas passadas no robô de hoje, já com as correções da 1a rodada.)')
    partes.push('Falas da família nesta conversa:', ...depoisFalas.map((f, i) => `${String(i + 1).padStart(2, '0')}. ${f}`), '')
    partes.push(...rodar(novo, depoisFalas, inicio))
  } else partes.push(...rodar(novo, falas, inicio))
  writeFileSync(join(saida, `${nome}.txt`), partes.join('\n') + '\n')
}

// 1) As 35 conversas montadas (33 do Raio-X e 2 do idoso, 21/10/2026).
const suspeitas = JSON.parse(readFileSync('tests/painel/resultados/suspeitas.json', 'utf8')) as { id: string; titulo: string; falas: string[]; agora?: string }[]
for (const s of suspeitas) arquivo(s.id, `Conversa ${s.id}: ${s.titulo}`, s.falas, new Date(s.agora ?? '2026-10-19T13:00:00Z'))

// 2) As 24 conversas das famílias simuladas por IA (F01 a F12, v1 e v2).
for (const nome of readdirSync('tests/painel/conversas').filter((n) => /^F\d{2}-v\d\.json$/.test(n))) {
  const antes = JSON.parse(readFileSync(join('tests/painel/conversas', nome), 'utf8')) as { inicio?: string; mensagens: string[] }
  const caminhoDepois = join('tests/painel/conversas/v32-rodada1', nome)
  const depois = existsSync(caminhoDepois) ? (JSON.parse(readFileSync(caminhoDepois, 'utf8')) as { mensagens: string[] }).mensagens : undefined
  const id = nome.replace('.json', '')
  arquivo(id, `Família ${id} (simulada por IA, perfil do painel de 20/10/2026)`, antes.mensagens, new Date(antes.inicio ?? '2026-10-19T13:00:00Z'), depois)
}
console.log(`conversas exportadas em ${saida}`)
