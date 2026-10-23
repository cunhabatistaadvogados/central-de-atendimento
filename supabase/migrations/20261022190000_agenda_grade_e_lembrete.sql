begin;

/**
 * Grade de horarios do robo (pedido do Edu e da Andreia, 22/10/2026): a
 * equipe define na tela Agenda quais horarios o robo oferece; o que ja foi
 * pedido ou confirmado sai das opcoes. Uma linha so (id = 1), jsonb no formato
 * GradeDaAgenda de _shared/robo.ts. Sem linha, o robo usa GRADE_PADRAO.
 */
create table if not exists public.agenda_config (
  id int primary key default 1 check (id = 1),
  grade jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table public.agenda_config enable row level security;
alter table public.agenda_config force row level security;
drop policy if exists equipe_agenda_config on public.agenda_config;
create policy equipe_agenda_config on public.agenda_config for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());

/**
 * Lembrete no dia da reuniao: a funcao lembrete-reuniao guarda aqui o horario
 * (ISO) para o qual ja mandou. Reuniao remarcada tem outro horario e recebe
 * lembrete de novo; coluna fora da "reuniao" porque a tela regrava a reuniao.
 */
alter table public.clientes
  add column if not exists lembrete_enviado_para text;

commit;

-- Agendador (rodar uma vez; precisa das extensoes pg_cron e pg_net):
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('lembrete-reuniao', '*/10 * * * *',
--   $$ select net.http_post(url := 'https://wizoolakyttjrahpbgec.supabase.co/functions/v1/lembrete-reuniao', body := '{}'::jsonb) $$);
