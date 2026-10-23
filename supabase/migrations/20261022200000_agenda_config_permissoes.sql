begin;

/**
 * A agenda_config nasceu sem GRANT (20261022190000): a tela mostrava
 * "permission denied for table agenda_config" e o webhook caia na grade
 * padrao. Neste projeto cada tabela nova precisa do GRANT explicito
 * (20261019150000_permissoes_da_api); a RLS continua decidindo quem e equipe.
 */
grant select, insert, update on public.agenda_config to authenticated;
grant select, insert, update, delete on public.agenda_config to service_role;

commit;
