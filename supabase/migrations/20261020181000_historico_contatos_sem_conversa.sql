begin;

/**
 * Complemento da 20261020180000 (20/10/2026): ela marcou como historico quem
 * tinha mensagem do Pixel Hub, e ficaram de fora 3 contatos de exemplo do
 * Pixel Hub ("(example) Riley Bennett" e outros), importados sem mensagem
 * nenhuma. Importado se reconhece tambem pelo robo pausado da importacao.
 */

alter table public.clientes disable trigger clientes_atualizado;
update public.clientes c
   set historico = true
 where not c.historico
   and c.robo ->> 'motivoPausa' = 'Histórico importado do Pixel Hub'
   and not exists (
     select 1 from public.mensagens m
      where m.cliente_id = c.id and m.de = 'cliente' and (m.wamid is null or m.wamid not like 'pixelhub:%')
   );
alter table public.clientes enable trigger clientes_atualizado;

commit;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020181000', 'historico_contatos_sem_conversa') on conflict (version) do nothing;
