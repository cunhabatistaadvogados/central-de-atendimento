begin;

/**
 * Reuniao confirmada na Central vira evento no Outlook (22/10/2026): agenda do
 * Dr. Andre (prev@) com a Andreia (atendimento@) convidada. A funcao
 * outlook-agenda guarda aqui o id do evento para remarcar e cancelar. Coluna
 * separada da "reuniao" (jsonb) porque a tela regrava a reuniao inteira a cada
 * edicao e apagaria o id.
 */

alter table public.clientes
  add column if not exists outlook_evento_id text;

commit;
