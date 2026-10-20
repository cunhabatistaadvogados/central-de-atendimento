begin;

/**
 * Regra de acesso conferida UMA vez por consulta (20/10/2026).
 *
 * Com o historico do Pixel Hub (22 mil mensagens) a Central ficou presa em
 * "Carregando...": a politica chamava public.eh_da_equipe() direto, e o
 * Postgres reavaliava a funcao (um select na tabela equipe) para cada linha.
 * Dentro de (select ...) ela vira um InitPlan e roda uma vez so por consulta.
 * Recomendacao do proprio Supabase. Quem pode ver e mudar fica igual.
 */

drop policy if exists equipe_le_equipe on public.equipe;
create policy equipe_le_equipe on public.equipe
  for select to authenticated using ((select public.eh_da_equipe()));

drop policy if exists equipe_clientes on public.clientes;
create policy equipe_clientes on public.clientes
  for all to authenticated using ((select public.eh_da_equipe())) with check ((select public.eh_da_equipe()));

drop policy if exists equipe_mensagens on public.mensagens;
create policy equipe_mensagens on public.mensagens
  for all to authenticated using ((select public.eh_da_equipe())) with check ((select public.eh_da_equipe()));

drop policy if exists equipe_pendencias on public.pendencias;
create policy equipe_pendencias on public.pendencias
  for all to authenticated using ((select public.eh_da_equipe())) with check ((select public.eh_da_equipe()));

drop policy if exists equipe_eventos on public.eventos;
create policy equipe_eventos on public.eventos
  for all to authenticated using ((select public.eh_da_equipe())) with check ((select public.eh_da_equipe()));

drop policy if exists equipe_contratos on public.contratos;
create policy equipe_contratos on public.contratos
  for all to authenticated using ((select public.eh_da_equipe())) with check ((select public.eh_da_equipe()));

commit;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020120000', 'rls_uma_vez_por_consulta') on conflict (version) do nothing;
