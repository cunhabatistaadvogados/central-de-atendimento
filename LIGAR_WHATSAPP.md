# Ligar o WhatsApp do robô (Cunha Batista)

Estado em 19/10/2026. Tudo está na conta da Meta do Edu, no portfólio
**Cunha Batista Advogados Associados** (id 1002397125452791).

## Já feito

| Item | Valor |
|---|---|
| App da Meta | Central Cunha Batista, id 1439216688176078 |
| Conta WhatsApp Business | 1846254099819287 |
| Número de teste da Meta | +1 555 656 4019, id do número 1316032894934489 |
| Número do robô | +55 (13) 99741-4361, preenchido em "Adicionar telefone", falta o código do chip |
| Usuário do sistema | robo-atendimento (admin), com controle total do app e da conta WhatsApp |
| Modelo de mensagem | `retorno_pendencia` (Utilidade, pt_BR), em análise na Meta |
| Supabase | tabelas criadas; função `whatsapp-send` publicada; `meta-webhook` pronta para publicar |

## Falta (precisa de você: são segredos, senhas e o chip)

Nenhum token vai em arquivo, chat ou código. Só nos lugares abaixo.

1. **Supabase > Edge Functions > Secrets** (projeto LOAS), criar:
   - `WHATSAPP_VERIFY_TOKEN`: uma frase-senha inventada por você. A mesma vai no passo 3.
   - `META_APP_SECRET`: Meta for Developers > app Central Cunha Batista >
     Configurações do app > Básico > Chave secreta do app (Mostrar).
   - `WHATSAPP_ACCESS_TOKEN`: Configurações da empresa > Usuários do sistema >
     robo-atendimento > **Gerar token** > app Central Cunha Batista >
     expiração **Nunca** > permissões `whatsapp_business_messaging` e
     `whatsapp_business_management`.
   - `WHATSAPP_PHONE_NUMBER_ID`: `1316032894934489` para testar com o número
     de teste; trocar pelo id do número real depois do passo 5.
2. Me avisar para publicar a `meta-webhook` (ou ela sobe sozinha pelo GitHub
   depois do passo 6).
3. **Meta > app > WhatsApp > Configuração > Webhook**:
   URL `https://wizoolakyttjrahpbgec.supabase.co/functions/v1/meta-webhook`,
   token de verificação = o mesmo do passo 1, "Verificar e salvar", e assinar
   o campo **messages**.
4. Teste: em "Configuração da API", no campo "Até", cadastrar o seu WhatsApp
   pessoal como destinatário do número de teste e mandar "oi, meu filho tem
   laudo de autismo" para +1 555 656 4019.
5. Chip na mão: concluir "Adicionar telefone" com o código por SMS.
6. Opcional, publicação automática igual à do Marcello: no GitHub
   (cunhabatistaadvogados/central-de-atendimento > Settings > Secrets > Actions)
   criar `SUPABASE_ACCESS_TOKEN` (supabase.com > Account > Access Tokens) e
   `SUPABASE_DB_PASSWORD` (senha do banco do projeto LOAS).
7. Forma de pagamento no Gerenciador do WhatsApp (só a Meta cobra mensagens
   iniciadas pela empresa, como o modelo de retorno).
