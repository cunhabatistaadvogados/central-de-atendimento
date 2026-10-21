# Auditoria do painel de avaliação (21/10/2026)

Feita com a skill **eval-audit** do conjunto [ai-evals-course/evals-skills](https://github.com/ai-evals-course/evals-skills)
(Hamel Husain e Shreya Shankar, commit 80d5f7b de 24/09/2026), sobre o painel de
`tests/painel/` e o relatório "Raio-X do Robô BPC/LOAS". As seis áreas da skill, na
ordem de impacto.

## 1. Validação do juiz

### O juiz de IA nunca foi comparado com o Lucas
**Situação:** problema (crítico pela skill).
Os três juízes leram 24 conversas e reprovaram todas, mas ninguém do escritório
conferiu se eles acertam. Sem medir TPR e TNR (quanto o juiz concorda com o
especialista quando a conversa passa e quando falha), não dá para confiar na taxa
de falha.
**Correção:** skill `validate-evaluator`. O Lucas marca Passa ou Falha em cerca de
100 conversas; separa-se treino, desenvolvimento e teste; o juiz só vale com TPR e
TNR acima de 80% (meta 90%).

## 2. Revisão humana

### Nenhum especialista de domínio revisou as conversas
**Situação:** problema.
A revisão foi feita por IA e por quem não é advogado. A skill alerta que revisor sem
domínio pega erro de forma e perde erro jurídico.
**Correção:** skill `build-review-interface`: uma página em que o Lucas vê uma
conversa por vez, inteira, marca Passa ou Falha e escreve uma nota livre.

## 3. Dados rotulados

### 24 conversas, todas reprovadas, todas armadilha
**Situação:** problema.
Para medir o juiz são precisas cerca de 50 que passam e 50 que falham. Hoje são 0 e
24, e as 24 foram escolhidas para dar errado, então a taxa de 100% de falha não
representa o atendimento do dia a dia.
**Correção:** completar até cerca de 100 com conversas comuns (skill
`generate-synthetic-data`: tuplas de quem fala, beneficiário, renda, CadÚnico,
INSS, estilo e atitude) e, quando houver, com conversas reais do robô sorteadas.

## 4. Desenho do avaliador

### Um juiz só para oito critérios
**Situação:** problema.
A skill pede um juiz por modo de falha, cada um com definição de Passa e Falha e
exemplos. Os três modos que mais apareceram merecem juiz próprio: pergunta da
família gravada como dado, "sim" falso no horário e no contrato, e expectativa
jurídica falsa.
**Correção:** skill `write-judge-prompt`, usando as conversas de treino como exemplo.

### Parte do que a IA julgou dá para conferir por código
**Situação:** problema parcial.
As regras do escritório já são conferidas por código (`regras.ts`) e o fuzz compara
a ficha com a verdade. Mas no painel por IA a ficha final ainda foi julgada pela IA, e
"pergunta virou dado" dá para pegar por código: mensagem da família com "?" cujo
texto aparece num campo da ficha.
**Correção:** skill `write-code-eval`.

### Binário Passa ou Falha
**Situação:** OK. Cada critério já é ok, falha ou não se aplica.

## 5. Análise de erros

### Categorias em parte imaginadas, sem conversa real do robô
**Situação:** problema parcial.
As categorias vieram da leitura do código, da lei e de 24 conversas simuladas. O robô
só está no ar desde 20/10/2026, então ainda não há conversa real dele para observar.
**Correção:** depois de duas semanas no ar, sortear cerca de 100 conversas reais (parte
ao acaso, parte por grupos parecidos) e rodar a skill `error-discovery` com o Lucas.

## 6. Higiene do processo

### Reexecução
**Situação:** OK. `npm run painel:suspeitas`, `painel:fuzz` e `painel:mutacao` rodam de
novo a qualquer hora; as conversas das famílias ficam em `tests/painel/conversas/`.
Falta só rodar o painel por IA de novo depois de cada mudança no roteiro.
