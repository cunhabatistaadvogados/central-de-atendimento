# E-mails do login (Supabase Auth)

Quem cria os acessos é o administrador, na tela Preferências > Equipe e acessos
(função `convidar-membro`). O Supabase manda o convite e o "esqueci a senha"
pelo **Gmail do escritório** (cunhamoreiraadv@gmail.com), configurado como SMTP
próprio. Sem SMTP próprio o Supabase só entrega e-mail para quem é membro da
organização no painel: convite para a equipe não chegaria.

## Onde colar os modelos

Supabase > Authentication > Emails (Templates). Troque o assunto e cole o HTML.

| Modelo no Supabase | Arquivo                | Assunto                                          |
|--------------------|------------------------|--------------------------------------------------|
| Invite user        | convite.html           | Seu acesso à Central · Cunha Batista Advogados   |
| Reset password     | redefinir-senha.html   | Criar senha nova · Cunha Batista Advogados       |

`{{ .ConfirmationURL }}` é preenchido pelo Supabase: não mexa.

## SMTP do Gmail (Authentication > Emails > SMTP Settings)

- Host: `smtp.gmail.com` · Porta: `465`
- Usuário e e-mail do remetente: `cunhamoreiraadv@gmail.com`
- Nome do remetente: `Cunha Batista Advogados`
- Senha: **senha de app** do Google (não é a senha do Gmail). Gera em
  https://myaccount.google.com/apppasswords com a verificação em duas etapas
  ligada. Quem cola é o dono da conta; ela não fica no código.

O Gmail aceita uns 500 envios por dia, sobra para convites e trocas de senha.

## URLs (Authentication > URL Configuration)

- Site URL: `https://cunhabatistaadvogados.github.io/central-de-atendimento/`
- Redirect URLs: a mesma e `http://localhost:5180/` (testes)
