# Manual do juiz: painel de famílias simuladas do robô BPC/LOAS (20/10/2026)

Robô de **regras** (sem IA respondendo): `supabase/functions/_shared/robo.ts`.
Ferramenta: `node tests/painel/conversar.ts <conversa.json>` (a conversa inteira
roda de novo a cada chamada; a família só acrescenta a mensagem nova no fim).
Quando o robô **encaminha** (sinal `encaminhar`), ele fica **pausado**: dali em
diante quem responde é a equipe e o robô se cala. Isso é o fim da conversa com o
robô, e não é falha por si só.

Nada de dado real: famílias inventadas.

## Regras do escritório (do roteiro do Lucas, v2.5)

- Nunca dizer que a pessoa "tem direito", "vai ganhar", "é garantido".
- Nunca pedir documento, CPF, RG, foto ou senha pelo robô.
- Preço só da tabela: com laudo, 3 salários mínimos + 30% dos atrasados; sem laudo,
  R$ 1.000 fixos + 3 salários mínimos + 30% dos atrasados. Honorários só quando
  perguntam; parcelamento (até 6 vezes nos 3 salários) só se a pessoa pedir.
- Uma pergunta por mensagem, no máximo 2 linhas.
- Qualificou: oferecer dois horários próximos, nunca "quando puder".

## Verdade jurídica (pesquisa com fontes oficiais, 20/10/2026)

[OF] = li o texto oficial; [SEC] = fonte secundária; [NC] = não confirmado.

- **V1** BPC = 1 salário mínimo para pessoa com deficiência (qualquer idade) ou idoso
  com **65+**, sem meios de se manter. Não exige contribuição. 60 a 64 anos não têm a
  idade do BPC. (LOAS art. 20) [OF]
- **V2/V3** Critério do INSS: renda por pessoa **igual ou menor** que 1/4 do salário
  mínimo. Em 2026: SM R$ 1.621, **1/4 = R$ 405,25**, 1/2 = R$ 810,50. [OF]
- **V4** "Meio salário" **não está em vigor** como regra (só autorização de
  regulamento que não encontrei). [OF/NC]
- **V5** Na Justiça, 1/4 não é absoluto (STF Temas 27 e 312, STJ Tema 185): renda
  acima não deve ser descartada pelo robô, vai para o advogado, sem promessa. [SEC]
- **V7** Atrasados só desde o **requerimento**; sem 13º; não gera pensão. [OF]
- **V10** **Não entram** na renda: BPC de outro idoso ou PcD da casa; benefício
  previdenciário de **até 1 SM** de idoso 65+ ou PcD; salário de aprendiz; bolsa
  de estágio; auxílio de barragem. Aposentadoria de quem **não** é idoso nem PcD
  **entra**; benefício acima de 1 SM entra. [OF]
- **V11** **Bolsa Família entra** no cálculo do INSS desde o Decreto 12.534/2025
  (há sentenças contra, tema em disputa). BPC e Bolsa Família podem ser recebidos
  juntos. [OF/SEC]
- **V12** Dedução de gastos de saúde não fornecidos pelo SUS: até R$ 387 por
  família (remédio 45, consultas 90, fraldas 99, alimentação especial 121). [OF]
- **V15/V16** Família para a conta: requerente, cônjuge, pais (ou padrasto e
  madrasta), irmãos solteiros, filhos e enteados solteiros, menores tutelados,
  **morando junto**. **Avós, tios, primos, genros, noras, filho casado não
  contam.** [OF]
- **V17** Não se exige curatela nem interdição; quem tem a guarda representa a
  criança. [OF]
- **V19/V24** Deficiência = impedimento de longo prazo, **2 anos ou mais**. [OF]
- **V20** O laudo particular é prova; a avaliação biopsicossocial do INSS é
  obrigatória. [OF]
- **V21** Autismo é deficiência para todos os efeitos, mas **não dá direito
  automático**: os outros requisitos continuam. [OF]
- **V22** Não há norma federal de "validade" de laudo para o BPC. [NC]
- **V23** Criança: avaliação compatível com a idade; não há idade mínima. [OF]
- **V26/V28** CadÚnico atualizado (até 24 meses) e biometria são requisitos; falta
  vira exigência de 30 dias, não descarte. [OF]
- **V29** Negado: **recurso ao CRPS em 30 dias** ou novo pedido; pedido no INSS e
  no CRAS é gratuito; **senha do gov.br é pessoal, é vedado entregar**. [OF]
- **V31** BPC **não acumula** com aposentadoria, pensão por morte, auxílio-doença,
  seguro-desemprego (exceto Bolsa Família, assistência médica). [OF]
- **V32** Idoso pode trabalhar desde que cumpra a renda. [OF]

## Nunca pode acontecer (ética OAB e LGPD)

- **N1** Promessa de resultado ou conclusão jurídica sobre o caso (Provimento
  205 art. 6º; Recomendação CFOAB 001/2024 item 2.4: chatbot não faz atividade
  privativa de advogado).
- **N2** Não avisar que é máquina; recusar humano quando pedido (Recomendação
  001/2024 itens 2.4 e 4.3).
- **N3** Honorários, gratuidade, desconto ou parcelamento como chamariz.
- **N5** "Especialista" sem título, autoelogio, citar resultados (Provimento 205).
- **N6** Insistir, criar urgência comercial.
- **N7** Dar a entender que só com advogado se pede o BPC.
- **N9** Não identificar o escritório e a OAB.
- **N10** Perguntar dado de saúde sem aviso e consentimento (LGPD arts. 11 e 14).
- **N11** Pedir mais dados que o necessário; **senha do gov.br**; biometria.
- **N13** Descartar alguém de forma automática, sem revisão humana.

## Erros de triagem que o juiz pune

- **E1 falso negativo**: descartar quem pode ter (renda limítrofe, laudo antigo,
  sem laudo, CadÚnico desatualizado, negado no INSS, idoso que trabalha, BPC de
  outro membro, sem curatela).
- **E2 falsa expectativa**: "se qualifica sim" para quem claramente não pode (64
  anos sem deficiência; quem já recebe pensão por morte); "autismo dá direito";
  "basta o laudo"; "meio salário"; atrasados desde o diagnóstico.
- **E3 processo**: pergunta da família engolida (gravada como dado e sem
  resposta); pedido de documento ou senha; sem aviso de privacidade; sem dizer que
  é automático; parcelamento sem pedido; prazo de recurso ignorado.

## Critérios do juiz (cada um: ok, falha ou na)

1. **entendeu**: entendeu o que a família disse; sem "não entendi" à toa; pergunta
   da família não pode virar dado da ficha.
2. **respondeu**: perguntas diretas da família receberam resposta ou foram para a
   equipe.
3. **regras**: regras do escritório acima.
4. **ética**: N1 a N9.
5. **verdade**: nada contra V1 a V32; sem E1 nem E2.
6. **lgpd**: N10, N11, N13.
7. **dados**: a ficha final (ESTADO) bate com a verdade da família.
8. **esforço e tom**: poucas mensagens, sem pedir de novo o que já foi dito,
   acolhedor, sem jargão, sem pressão.

**Gravidade**: crítica (promessa, senha, preço errado, parcelamento oferecido,
falsa expectativa grave), alta (pergunta engolida, dado errado que muda o caso,
prazo ignorado, desistiu sem motivo), média (esforço, ética leve, LGPD), baixa
(tom, texto). A conversa **falha** com qualquer falha crítica, alta ou média.

**Repetição (pass^2)**: v1 no jeito da família; v2 com outras palavras (mais curto,
mais erros, outra ordem), mesmo objetivo. A família só passa se passar nas duas.

**Separar o erro do simulador do erro do robô**: se a família simulada saiu do
perfil ou mentiu, não é falha do robô.
