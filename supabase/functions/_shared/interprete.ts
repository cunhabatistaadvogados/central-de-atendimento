// Interprete do robo (Claude Opus 5.5, 22/10/2026). So entra quando as regras
// de robo.ts nao entenderam a mensagem da familia. Le o fim da conversa e
// escolhe um caminho:
// - resposta: reescreve a mensagem num formato que as regras entendem e o
//   robo roda de novo com ela ("sou sozinho" -> "moro sozinho");
// - complemento: a familia completa uma pergunta ANTERIOR ("Somente na
//   proxima" depois do CRAS): o robo anota e repete a pergunta atual;
// - contornar: nao e resposta, mas da para seguir ("mais ou menos", "eu
//   trabalho CLT", um desabafo): a IA escreve UMA frase curta e o robo repete
//   a pergunta (pedido do Edu, 23/10/2026: antes do "nao entendi" ela entra,
//   contorna e o robo volta). A frase passa pelo filtro ponteSegura do robo.ts;
// - nada: nem ela entendeu; segue o "nao entendi" e, na segunda, a equipe.
//
// LGPD: vai a pergunta do robo, a mensagem da familia e as ultimas mensagens
// antes dela, com o nome da familia trocado por [nome] (quem troca e o webhook); sem telefone.
// Segredo: ANTHROPIC_API_KEY. Sem a chave, o interprete fica desligado.
import Anthropic from 'npm:@anthropic-ai/sdk'

export const MODELO_DO_INTERPRETE = 'claude-opus-5-5'

const INSTRUCOES = `Voce ajuda a Mary, atendente de um escritorio de advocacia (BPC/LOAS) que conversa com familias simples pelo WhatsApp. O robo da Mary segue um roteiro de perguntas e as regras dele nao entenderam a ultima mensagem da familia. Leia a conversa e escolha UM tipo.

1. "resposta": a mensagem responde a ultima pergunta. Em "resposta", reescreva no formato que o robo entende:
- Nome e idade: "Maria, 70 anos" ou "Joao, o filho tem 8 anos".
- Quem mora na casa ou quantas pessoas: "somos N pessoas" (quem mora sozinho: "moro sozinho", N = 1).
- Renda: "a renda da casa e R$ N por mes" ou "nao tem renda nenhuma".
- Laudo: "tem laudo de AAAA", "nao tem laudo" ou "nao sei".
- Diagnostico: "tem <doenca ou deficiencia>, desde <ano ou idade>".
- Pergunta de sim ou nao: "sim" ou "nao".
- Escolha de horario: repita a opcao escolhida com as palavras da pergunta (ex.: "hoje a tarde").

2. "complemento": a familia ainda completa ou corrige uma pergunta ANTERIOR, nao a ultima. Ex.: o robo perguntou "Da para ir ao CRAS essa semana?", a familia disse "Nao", o robo passou para "Quem mora com ele?" e a familia escreveu "Somente na proxima". Em "resposta", o que ela quis dizer, curto, em terceira pessoa e em portugues com acento (ex.: "só consegue ir ao CRAS na próxima semana"); a equipe le essa anotacao. Em "ponte", uma frase curta da Mary (ex.: "Entendi, anotado.").

3. "contornar": a mensagem nao responde a ultima pergunta, mas da para seguir a conversa: comentario, explicacao sobre outra coisa, "mais ou menos", "nao sei direito", desabafo, resposta incompleta. Em "ponte", uma frase curta e acolhedora da Mary mostrando que entendeu (ex.: "Entendi, você trabalha de carteira assinada." ou "Sem problema, não precisa ser exato."). Depois dela o robo repete a pergunta sozinho. Se a familia nao entendeu a pergunta da Mary ou quer saber para que ela serve ("como assim?", "recebe o que?", "pra fazer o que?", "nao entendi"), use "contornar" e na ponte explique em palavras simples o que a Mary quer saber, sem repetir a pergunta (ex.: "Você falou de uma aposentadoria na casa, e quero saber de quem ela é." ou "Pergunto porque o INSS olha a renda de todos que moram com ela."). Isso NAO e duvida juridica: deixe "duvida" vazio.
Se a mensagem for uma duvida sobre direito, beneficio, valores ou prazos, use "contornar" e copie a duvida em "duvida" (o escritorio responde com o texto padrao e anota para o advogado).

4. "nada": nao da para saber o que a pessoa quis dizer (texto sem sentido). Prefira "contornar" sempre que der para reconhecer algo da mensagem.

Regras da ponte (a familia le, como se fosse a Mary):
- Uma frase so, ate 100 caracteres, terminando em ponto. Sem pergunta, sem numeros.
- Nunca diga que a pessoa tem direito, vai conseguir, ou que o caso e bom ou ruim. Nunca peca documento. Nunca fale de preco, honorario, prazo, advogado ou processo.
- Portugues simples e caloroso, sem giria e sem emoji.

Regras gerais:
- Use so o que a familia disse. Nunca invente numero, nome, ano ou valor.
- Campos que nao se aplicam ficam com "".
- Responda so o JSON pedido.`

const FORMATO = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['resposta', 'complemento', 'contornar', 'nada'] },
      resposta: { type: 'string' },
      ponte: { type: 'string' },
      duvida: { type: 'string' },
    },
    required: ['tipo', 'resposta', 'ponte', 'duvida'],
    additionalProperties: false,
  },
}

export interface Interpretacao {
  tipo: 'resposta' | 'complemento' | 'contornar' | 'nada'
  /** resposta: a frase reescrita; complemento: o que ela quis dizer (vira anotacao). */
  resposta: string
  /** complemento e contornar: frase curta da Mary antes de o robo repetir a pergunta. */
  ponte: string
  /** contornar: a duvida juridica da familia, quando houver. */
  duvida: string
}

/** Uma mensagem do fim da conversa, para o interprete ver o contexto. */
export interface Fala {
  de: 'escritorio' | 'familia'
  texto: string
}

/** Le a mensagem da familia. Qualquer falha (sem chave, erro, recusa, demora) vira tipo "nada". */
export async function interpretar(perguntaDoRobo: string, mensagemDaFamilia: string, antes: Fala[] = []): Promise<Interpretacao & { erro?: string }> {
  const nada: Interpretacao = { tipo: 'nada', resposta: '', ponte: '', duvida: '' }
  const chave = Deno.env.get('ANTHROPIC_API_KEY')
  if (!chave) return { ...nada, erro: 'ANTHROPIC_API_KEY ausente' }
  const conversa = antes.length
    ? `Mensagens anteriores (mais antiga primeiro):\n${antes.map((f) => `${f.de === 'familia' ? 'Familia' : 'Mary'}: "${f.texto.slice(0, 300)}"`).join('\n')}\n`
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
      messages: [{ role: 'user', content: `Hoje: ${new Date().toISOString().slice(0, 10)}\n${conversa}Ultima pergunta da Mary: "${perguntaDoRobo}"\nMensagem nova da familia: "${mensagemDaFamilia}"` }],
    } as never)
    const resp = r as unknown as { stop_reason: string; content: { type: string; text?: string }[] }
    if (resp.stop_reason === 'refusal') return { ...nada, erro: 'recusa do modelo' }
    const texto = resp.content.find((b) => b.type === 'text')?.text ?? ''
    const j = JSON.parse(texto) as Partial<Interpretacao>
    const limpo = (v: unknown) => String(v ?? '').trim().slice(0, 200)
    const tipo = (['resposta', 'complemento', 'contornar'] as const).find((t) => t === j.tipo) ?? 'nada'
    const i: Interpretacao = { tipo, resposta: limpo(j.resposta), ponte: limpo(j.ponte), duvida: limpo(j.duvida) }
    // Resposta e complemento sem texto nao servem para nada.
    if ((tipo === 'resposta' || tipo === 'complemento') && !i.resposta) return { ...nada }
    return i
  } catch (e) {
    return { ...nada, erro: e instanceof Error ? e.message : String(e) }
  }
}
