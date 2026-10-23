begin;

/**
 * Retomada de quem parou de responder (Lucas e Edu, 22/10/2026). A funcao
 * retomar-contato guarda em clientes.retomada a regua em andamento:
 * { desde: ultima_do_cliente_em quando parou, feitas, ultimaEm }. A familia
 * respondeu, o "desde" muda e a regua recomeca. A regua (quantas vezes,
 * intervalo, horarios) fica em configuracoes, chave "retomada", e o
 * administrador muda em Preferencias.
 */
alter table public.clientes
  add column if not exists retomada jsonb;

insert into public.configuracoes (chave, valor)
values ('retomada', '{"ligado": true, "tentativas": 4, "intervaloDias": 1, "horarios": ["08:00", "12:30", "18:30", "10:00"], "esperaMinHoras": 8, "ateDias": 7}'::jsonb)
on conflict (chave) do nothing;

commit;

-- Agendador (rodar uma vez; pg_cron e pg_net ja ligados pelo lembrete):
-- select cron.schedule('retomar-contato', '*/15 * * * *',
--   $$ select net.http_post(url := 'https://wizoolakyttjrahpbgec.supabase.co/functions/v1/retomar-contato',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <chave publishable>', 'apikey', '<chave publishable>'),
--     body := '{}'::jsonb) $$);
