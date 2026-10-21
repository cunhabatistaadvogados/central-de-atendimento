# Central CB& - Cunha, Batista & Advogados Associados

Atendimento BPC/LOAS pelo WhatsApp: robô qualifica, equipe fecha, contrato sai
da minuta do escritório. Mesmo desenho do sistema do Dr. Marcello (Central de
Cuidado): React + Vite + Tailwind; Supabase com RLS forçada e Edge Functions.

## Regras que não se quebram

- **O robô é um arquivo só**: `supabase/functions/_shared/robo.ts`, sem import.
  Roda igual no simulador da tela, nos testes (Node) e no webhook (Deno). Mudou o
  roteiro, roda `npm test` e lê as conversas: teste que passa não garante texto bom.
- **Prove que o teste pega o defeito**: desligue a correção e veja o teste falhar.
- O roteiro é do Lucas (v3.2, 21/10/2026, resposta ao Raio-X, com a área do
  idoso). Nunca: dizer que a pessoa "tem direito", pedir documento, oferecer
  parcelamento sem pedido, falar preço fora da tabela. Uma pergunta por mensagem.
  "Se qualifica sim" só no fechamento limpo, sem impedimento.
- `npm test` roda os testes do robô, o do contrato e as 35 conversas montadas
  (`tests/painel/suspeitas.ts --teste`): nenhuma pode voltar.
- Contrato com valor fixo de R$ 1.000 só sem laudo, e nunca ligado a laudo,
  médico ou repasse no texto (`src/lib/contrato.ts`, testado em `tests/`).
- **Migration aplicada nunca se edita**; correção vem em arquivo novo. A
  `20261019120000` foi aplicada pelo painel e registrada em
  `supabase_migrations.schema_migrations`.
- Falha silenciosa é pior que barulhenta: erro de envio vira etiqueta na tela.
- Sem travessão nem meia-risca em texto nenhum (preferência do Edu).
- Comentário de código explica o porquê, em português, sem acento.

## Estado em 19/10/2026

Tela completa em modo demonstração (dados no navegador, `src/lib/store.tsx`).
Banco criado no Supabase "LOAS" (`wizoolakyttjrahpbgec`). Falta: trocar o store
para o Supabase, ligar o WhatsApp da Meta, retornos automáticos e D4Sign.
