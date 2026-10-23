// Interprete do robo (Claude Opus 5.5, 22/10/2026). So entra quando as regras
// de robo.ts nao entenderam a resposta da familia ("sou sozinho", "eu e Deus",
// "ganho uns trocado de bico"). O Claude NUNCA escreve para a familia: ele
// reescreve a resposta num formato que as regras ja entendem, e o robo roda de
// novo com essa frase. Sem certeza, devolve entendeu=false e tudo segue como
// antes (nao entendi, depois a equipe).
//
// Desde 23/10/2026 vai junto o fim da conversa: "Somente na proxima" depois de
// "Quem mora com ele?" so faz sentido lendo a pergunta do CRAS que veio antes.
// Nesse caso volta sobreAnterior=true e o robo anota, sem contar "nao entendi".
//
// LGPD: vai a pergunta do robo, a frase da familia e as ultimas mensagens antes
// dela, com o nome da familia trocado por [nome] (quem troca e o webhook); sem telefone.
// Segredo: ANTHROPIC_API_KEY. Sem a chave, o interprete fica desligado.
import Anthropic from 'npm:@anthropic-ai/sdk'

export const MODELO_DO_INTERPRETE = 'claude-opus-5-5'

const INSTRUCOES = `Voce ajuda o robo de triagem de um escritorio de advocacia (BPC/LOAS) que conversa com familias simples pelo WhatsApp.
O robo fez uma pergunta e nao entendeu a resposta. Reescreva a resposta da familia como uma frase curta e direta, no jeito que o robo entende.

Formatos que o robo entende:
- Nome e idade: "Maria, 70 anos" ou "Joao, o filho tem 8 anos".
- Quem mora na casa ou quantas pessoas: "somos N pessoas" (quem mora sozinho: "moro sozinho", N = 1).
- Renda: "a renda da casa e R$ N por mes" ou "nao tem renda nenhuma".
- Laudo: "tem laudo de AAAA", "nao tem laudo" ou "nao sei".
- Diagnostico: "tem <doenca ou deficiencia>, desde <ano ou idade>".
- Pergunta de sim ou nao: "sim" ou "nao".
- Escolha de horario: repita a opcao escolhida com as palavras da pergunta (ex.: "hoje a tarde").

Use as mensagens anteriores so para entender o contexto. As vezes a familia ainda esta completando uma pergunta ANTERIOR, nao a ultima. Ex.: o robo perguntou "Da para ir ao CRAS essa semana?", a familia disse "Nao", o robo passou para "Quem mora com ele na mesma casa?" e a familia escreveu "Somente na proxima".
Nesse caso: entendeu=true, sobreAnterior=true e resposta = o que ela quis dizer sobre a pergunta anterior, curto, em terceira pessoa e em portugues com acento (ex.: "só consegue ir ao CRAS na próxima semana"). A equipe le essa anotacao.
Se a frase responde a ultima pergunta, sobreAnterior=false.

Regras:
- Use so o que a familia disse. Nunca invente numero, nome, ano ou valor.
- Se a resposta for uma pergunta, um cumprimento, outro assunto que nao complete uma pergunta anterior, ou se voce nao tiver certeza, responda entendeu=false.
- Responda so o JSON pedido.`

const FORMATO = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      entendeu: { type: 'boolean' },
      resposta: { type: 'string' },
      sobreAnterior: { type: 'boolean' },
    },
    required: ['entendeu', 'resposta', 'sobreAnterior'],
    additionalProperties: false,
  },
}

export interface Interpretacao {
  entendeu: boolean
  resposta: string
  /** A frase completa uma pergunta ANTERIOR do robo, nao a ultima. */
  sobreAnterior: boolean
}

/** Uma mensagem do fim da conversa, para o interprete ver o contexto. */
export interface Fala {
  de: 'escritorio' | 'familia'
  texto: string
}

/** Reescreve a resposta da familia. Qualquer falha (sem chave, erro, recusa, demora) vira entendeu=false. */
export async function interpretar(perguntaDoRobo: string, respostaDaFamilia: string, antes: Fala[] = []): Promise<Interpretacao & { erro?: string }> {
  const nada = { entendeu: false, resposta: '', sobreAnterior: false }
  const chave = Deno.env.get('ANTHROPIC_API_KEY')
  if (!chave) return { ...nada, erro: 'ANTHROPIC_API_KEY ausente' }
  const conversa = antes.length
    ? `Mensagens anteriores (mais antiga primeiro):\n${antes.map((f) => `${f.de === 'familia' ? 'Familia' : 'Escritorio'}: "${f.texto.slice(0, 300)}"`).join('\n')}\n`
    : ''
  // Prazo curto: o webhook nao pode segurar a resposta da Meta.
  const cliente = new Anthropic({ apiKey: chave, timeout: 12_000, maxRetries: 1 })
  try {
    const r = await cliente.beta.messages.create({
      model: MODELO_DO_INTERPRETE,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCOES,
      output_config: { effort: 'low', format: FORMATO },
      // A data de hoje vai junto: "ano retrasado", "fez 7 em agosto" viram numero.
      messages: [{ role: 'user', content: `Hoje: ${new Date().toISOString().slice(0, 10)}\n${conversa}Ultima pergunta do robo: "${perguntaDoRobo}"\nResposta da familia: "${respostaDaFamilia}"` }],
    } as never)
    const resp = r as unknown as { stop_reason: string; content: { type: string; text?: string }[] }
    if (resp.stop_reason === 'refusal') return { ...nada, erro: 'recusa do modelo' }
    const texto = resp.content.find((b) => b.type === 'text')?.text ?? ''
    const j = JSON.parse(texto) as Interpretacao
    const resposta = String(j.resposta ?? '').trim().slice(0, 200)
    const entendeu = Boolean(j.entendeu) && resposta.length > 0
    return { entendeu, resposta, sobreAnterior: entendeu && Boolean(j.sobreAnterior) }
  } catch (e) {
    return { ...nada, erro: e instanceof Error ? e.message : String(e) }
  }
}
