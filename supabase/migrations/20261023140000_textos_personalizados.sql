begin;

/**
 * Textos personalizados da equipe (pedido do Edu, 23/10/2026): a equipe guarda
 * textos de copiar e colar (a apresentacao do Dr. Andre, por exemplo) e usa na
 * conversa com um clique. Os 4 textos prontos do escritorio continuam fixos no
 * codigo (src/lib/escritorio.ts); estes aqui qualquer pessoa da equipe cria,
 * edita e apaga, e todos veem.
 */
create table if not exists public.textos_personalizados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 60),
  texto text not null check (char_length(texto) between 1 and 4000),
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
alter table public.textos_personalizados enable row level security;
alter table public.textos_personalizados force row level security;
drop policy if exists equipe_textos_personalizados on public.textos_personalizados;
create policy equipe_textos_personalizados on public.textos_personalizados
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());

-- Neste projeto cada tabela nova precisa do GRANT explicito (20261019150000).
grant select, insert, update, delete on public.textos_personalizados to authenticated;
grant select, insert, update, delete on public.textos_personalizados to service_role;

commit;
