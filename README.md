# Central CB& · Cunha Batista & Advogados Associados

Central de atendimento BPC/LOAS do escritório (CNPJ 08.492.893/0001-41, OAB/SP 9.894).
Mesmo desenho do sistema do Dr. Marcello: React + Vite + Tailwind na tela,
Supabase (Postgres com RLS forçada + Edge Functions) no servidor, WhatsApp pela API oficial da Meta.

## O que faz

1. A família chama no WhatsApp. O robô acolhe e qualifica com o roteiro do Lucas
   (v2.5): uma pergunta por mensagem, sem juridiquês, sem pedir documento.
2. Qualificou: oferece dois horários com o Dr. André e passa para a equipe.
3. A família escolhe o horário: o contrato nasce em rascunho, já na versão certa
   (padrão com laudo; com valor fixo de R$ 1.000 sem laudo).
4. A equipe completa RG/CPF/endereço, o advogado dá o OK, e o .docx sai pronto da
   minuta do escritório. Envio pelo D4Sign quando o plano com API estiver ativo.

## Telas

Visão geral · Conversas (WhatsApp) · Funil BPC/LOAS (arrastar cartões) · Clientes ·
Contratos · Agenda · Testar o robô (simulador) · Preferências.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # 19 conversas do robô + as 2 versões do contrato
npm run build
```

Sem `.env.local` o sistema abre em **modo demonstração**: 14 famílias fictícias,
guardadas só no navegador. As conversas da demonstração saem do mesmo motor do robô.

## Onde está cada coisa

| Arquivo | O que é |
|---|---|
| `supabase/functions/_shared/robo.ts` | Motor do robô. Um arquivo só, roda no navegador, no Node (testes) e no Deno (webhook). |
| `src/lib/contrato.ts` | Gera o .docx a partir de `public/modelos/contrato_bpc_loas.docx` (minuta do Lucas, sem dado de cliente). |
| `supabase/migrations/` | Tabelas: equipe, clientes, mensagens, pendencias, eventos, contratos. |
| `supabase/functions/meta-webhook` | Recebe do WhatsApp, roda o robô, responde e grava. |
| `supabase/functions/whatsapp-send` | A equipe responde pela tela (pausa o robô na conversa). |

## Para ligar de verdade (falta)

1. Aplicar a migration no projeto Supabase "LOAS" (`wizoolakyttjrahpbgec`).
2. App na Meta + número do robô (+55 13 99741-4361) no WhatsApp Business; segredos
   no Supabase: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`.
3. Trocar o armazenamento da tela (`src/lib/store.tsx`) do navegador para o Supabase.
4. Retornos automáticos (23h sem resposta e pendências) como tarefa agendada,
   com modelo aprovado pela Meta para fora da janela de 24h.
5. D4Sign com API: `D4SIGN_*` (ver `docs` do CRM do Lucas).

## Observação sobre a minuta

A minuta original tinha, na Cláusula 3ª, o texto "Erro! Fonte de referência não
encontrada." (referência cruzada quebrada do Word). O gerador troca por
"Cláusula 2ª". Vale corrigir também na minuta-mãe do escritório.
