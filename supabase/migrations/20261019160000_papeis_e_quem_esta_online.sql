-- Papeis da equipe e "quem esta online".
--
-- Papeis do guia do Lucas (GUIA_DA_EQUIPE do CRM): atendimento (secretaria),
-- advogado e administrador. Mais um, desenvolvedor: o Edu, que desenvolve e
-- testa o sistema. Pedido dele em 19/10/2026: ter poder de administrador e
-- NUNCA aparecer como online para a equipe. A regra mora no banco (gatilho),
-- nao so na tela, para nenhuma versao futura da tela esquecer dela.

alter table public.equipe drop constraint if exists equipe_papel_check;
alter table public.equipe
  add constraint equipe_papel_check check (papel in ('atendimento', 'advogado', 'administrador', 'desenvolvedor'));

alter table public.equipe add column if not exists aparece_online boolean not null default true;

create or replace function public.eh_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.equipe
    where user_id = auth.uid() and ativo and papel in ('administrador', 'desenvolvedor')
  )
$$;

create or replace function public.eh_desenvolvedor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and ativo and papel = 'desenvolvedor')
$$;

-- Desenvolvedor nunca aparece online, e so outro desenvolvedor mexe nesse
-- papel. Pelo painel do Supabase (auth.uid() nulo) tudo continua liberado.
create or replace function public.proteger_papel_desenvolvedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.eh_desenvolvedor() then
    if new.papel = 'desenvolvedor' or (tg_op = 'UPDATE' and old.papel = 'desenvolvedor') then
      raise exception 'Somente o desenvolvedor altera o papel de desenvolvedor.';
    end if;
  end if;
  if new.papel = 'desenvolvedor' then
    new.aparece_online := false;
  end if;
  return new;
end;
$$;

drop trigger if exists equipe_protege_desenvolvedor on public.equipe;
create trigger equipe_protege_desenvolvedor
  before insert or update on public.equipe
  for each row execute function public.proteger_papel_desenvolvedor();

-- Administrador ajusta nome, papel, ativo e visibilidade de cada membro.
drop policy if exists admin_atualiza_equipe on public.equipe;
create policy admin_atualiza_equipe on public.equipe
  for update to authenticated
  using (public.eh_administrador())
  with check (public.eh_administrador());
grant update (nome, papel, ativo, aparece_online) on public.equipe to authenticated;

-- Configuracoes da central. "quem_esta_online" nasce LIGADO.
create table if not exists public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id)
);
insert into public.configuracoes (chave, valor) values ('quem_esta_online', 'true'::jsonb)
  on conflict (chave) do nothing;

alter table public.configuracoes enable row level security;
alter table public.configuracoes force row level security;
drop policy if exists equipe_le_configuracoes on public.configuracoes;
create policy equipe_le_configuracoes on public.configuracoes
  for select to authenticated using (public.eh_da_equipe());
drop policy if exists admin_altera_configuracoes on public.configuracoes;
create policy admin_altera_configuracoes on public.configuracoes
  for update to authenticated using (public.eh_administrador()) with check (public.eh_administrador());
revoke all on public.configuracoes from anon;
grant select, update on public.configuracoes to authenticated;
grant select, insert, update, delete on public.configuracoes to service_role;

-- Administrador libera o acesso de quem ja tem login (criado no painel do
-- Supabase, Authentication > Users) pelo e-mail, direto pela tela.
create or replace function public.adicionar_membro(p_email text, p_nome text, p_papel text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.eh_administrador() then
    raise exception 'Somente administradores liberam acessos.';
  end if;
  if p_papel not in ('atendimento', 'advogado', 'administrador') and not public.eh_desenvolvedor() then
    raise exception 'Papel invalido.';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Nenhum login com este e-mail. Crie primeiro em Authentication > Users no Supabase.';
  end if;
  insert into public.equipe (user_id, nome, papel)
    values (v_id, trim(p_nome), p_papel)
    on conflict (user_id) do update set nome = excluded.nome, papel = excluded.papel, ativo = true;
  return v_id;
end;
$$;

revoke execute on function public.eh_administrador() from public, anon;
revoke execute on function public.eh_desenvolvedor() from public, anon;
revoke execute on function public.adicionar_membro(text, text, text) from public, anon;
grant execute on function public.eh_administrador() to authenticated, service_role;
grant execute on function public.eh_desenvolvedor() to authenticated, service_role;
grant execute on function public.adicionar_membro(text, text, text) to authenticated;
