// Interprete do robo (Claude Opus 5.5, 22/10/2026). So entra quando as regras
// de robo.ts nao entenderam a resposta da familia ("sou sozinho", "eu e Deus",
// "ganho uns trocado de bico"). O Claude NUNCA escreve para a familia: ele
// reescreve a resposta num formato que as regras ja entendem, e o robo roda de
// novo com essa frase. Sem certeza, devolve entendeu=false e tudo segue como
// antes (nao entendi, depois a equipe).
//
// LGPD: vai so a pergunta do robo e a frase da familia, sem nome nem telefone.
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

Regras:
- Use so o que a familia disse. Nunca invente numero, nome, ano ou valor.
- Se a resposta for uma pergunta, um cumprimento, outro assunto, ou se voce nao tiver certeza, responda entendeu=false.
- Responda so o JSON pedido.`

const FORMATO = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      entendeu: { type: 'boolean' },
      resposta: { type: 'string' },
    },
    required: ['entendeu', 'resposta'],
    additionalProperties: false,
  },
}

export interface Interpretacao {
  entendeu: boolean
  resposta: string
}

/** Reescreve a resposta da familia. Qualquer falha (sem chave, erro, recusa, demora) vira entendeu=false. */
export async function interpretar(perguntaDoRobo: string, respostaDaFamilia: string): Promise<Interpretacao & { erro?: string }> {
  const chave = Deno.env.get('ANTHROPIC_API_KEY')
  if (!chave) return { entendeu: false, resposta: '', erro: 'ANTHROPIC_API_KEY ausente' }
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
      messages: [{ role: 'user', content: `Hoje: ${new Date().toISOString().slice(0, 10)}\nPergunta do robo: "${perguntaDoRobo}"\nResposta da familia: "${respostaDaFamilia}"` }],
    } as never)
    const resp = r as unknown as { stop_reason: string; content: { type: string; text?: string }[] }
    if (resp.stop_reason === 'refusal') return { entendeu: false, resposta: '', erro: 'recusa do modelo' }
    const texto = resp.content.find((b) => b.type === 'text')?.text ?? ''
    const j = JSON.parse(texto) as Interpretacao
    const resposta = String(j.resposta ?? '').trim().slice(0, 200)
    return { entendeu: Boolean(j.entendeu) && resposta.length > 0, resposta }
  } catch (e) {
    return { entendeu: false, resposta: '', erro: e instanceof Error ? e.message : String(e) }
  }
}
