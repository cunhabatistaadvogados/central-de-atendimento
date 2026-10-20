begin;

/**
 * Historico do Pixel Hub separado do atendimento (20/10/2026).
 *
 * Pedido do Lucas: tudo o que veio do Pixel Hub fica numa tela "Historico" e
 * a Central recomeca zerada a partir de hoje, dia em que o numero 13
 * 99741-4361 veio para o robo. Os 1.767 clientes importados ganham
 * historico = true; a tela do atendimento so carrega os outros.
 *
 * Quem do historico volta a escrever sai dele sozinho (gatilho em mensagens):
 * o robo dessas pessoas esta pausado, entao sem isso a mensagem ficaria
 * escondida no historico e ninguem responderia.
 */

alter table public.clientes add column if not exists historico boolean not null default false;

-- Sem tocar atualizado_em: a data da ultima conversa no Pixel Hub vale mais
-- que a hora desta migration.
alter table public.clientes disable trigger clientes_atualizado;
update public.clientes c
   set historico = true
 where exists (select 1 from public.mensagens m where m.cliente_id = c.id and m.wamid like 'pixelhub:%')
   and not exists (
     select 1 from public.mensagens m
      where m.cliente_id = c.id and m.de = 'cliente' and (m.wamid is null or m.wamid not like 'pixelhub:%')
   );
alter table public.clientes enable trigger clientes_atualizado;

create or replace function public.sair_do_historico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.de = 'cliente' and (new.wamid is null or new.wamid not like 'pixelhub:%') then
    update public.clientes set historico = false where id = new.cliente_id and historico;
  end if;
  return new;
end;
$$;
revoke execute on function public.sair_do_historico() from public, anon, authenticated;

drop trigger if exists mensagens_sair_do_historico on public.mensagens;
create trigger mensagens_sair_do_historico
  after insert on public.mensagens
  for each row execute function public.sair_do_historico();

-- Uma linha por conversa antiga, para a lista da tela sem baixar as 22 mil
-- mensagens. security_invoker: vale o RLS de clientes e mensagens (so a equipe).
create or replace view public.historico_resumo with (security_invoker = on) as
select c.id, c.nome, c.telefone, c.etapa, c.origem, c.motivo_perda, c.criado_em,
       coalesce(m.total, 0) as total, coalesce(m.do_cliente, 0) as do_cliente,
       m.primeira_em, m.ultima_em, m.ultima_texto, m.ultima_de
  from public.clientes c
  left join lateral (
    select count(*)::int as total,
           (count(*) filter (where x.de = 'cliente'))::int as do_cliente,
           min(x.em) as primeira_em,
           max(x.em) as ultima_em,
           (array_agg(left(x.texto, 160) order by x.em desc))[1] as ultima_texto,
           (array_agg(x.de order by x.em desc))[1] as ultima_de
      from public.mensagens x
     where x.cliente_id = c.id
  ) m on true
 where c.historico;

revoke all on public.historico_resumo from anon;
grant select on public.historico_resumo to authenticated;

commit;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020180000', 'historico_do_pixel_hub') on conflict (version) do nothing;
