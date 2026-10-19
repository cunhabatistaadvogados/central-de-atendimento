-- Central de atendimento CB&AA (BPC/LOAS) - estrutura inicial.
-- Regra da casa (herdada do sistema do Dr. Marcello): migration aplicada
-- NUNCA se edita. Correcao vem em arquivo novo, na frente.

create extension if not exists pgcrypto;

-- Quem e da equipe. Login pelo Supabase Auth; so entra quem estiver aqui e ativo.
create table public.equipe (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel text not null default 'atendimento' check (papel in ('atendimento', 'advogado', 'administrador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function public.eh_da_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and ativo)
$$;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique, -- E.164 sem "+", ex.: 5513999999999
  nome text not null default '',
  origem text not null default 'anuncio' check (origem in ('anuncio', 'site', 'instagram', 'indicacao')),
  etapa text not null default 'novo' check (etapa in ('novo', 'qualificacao', 'qualificado', 'reuniao', 'contrato', 'contratado', 'perdido')),
  -- Estado completo do robo (ficha, pergunta atual, pausado...). jsonb de
  -- proposito: o roteiro muda e a tabela nao precisa de migration a cada ajuste.
  robo jsonb not null default '{}'::jsonb,
  documentos jsonb not null default '{"rg":false,"cpf":false,"comprovante":false,"cadunico":false,"laudo":false}'::jsonb,
  reuniao jsonb,
  cidade text,
  responsavel uuid references public.equipe (user_id),
  nao_lidas int not null default 0,
  motivo_perda text,
  ultima_do_cliente_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index clientes_etapa_idx on public.clientes (etapa);
create index clientes_atualizado_idx on public.clientes (atualizado_em desc);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  de text not null check (de in ('cliente', 'robo', 'equipe')),
  texto text not null,
  autor text,
  -- id da Meta (wamid): idempotencia, a Meta reenvia o mesmo evento.
  wamid text unique,
  status_envio text, -- sent | delivered | read | failed
  erro_envio text,
  em timestamptz not null default now()
);
create index mensagens_cliente_idx on public.mensagens (cliente_id, em);

create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  texto text not null,
  retorno_em timestamptz not null,
  resolvida boolean not null default false,
  retorno_enviado_em timestamptz,
  criada_em timestamptz not null default now()
);
create index pendencias_retorno_idx on public.pendencias (retorno_em) where not resolvida;

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo text not null check (tipo in ('etapa', 'robo', 'equipe', 'contrato', 'sistema')),
  texto text not null,
  em timestamptz not null default now()
);
create index eventos_cliente_idx on public.eventos (cliente_id, em);

create table public.contratos (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  status text not null default 'rascunho' check (status in ('rascunho', 'pronto', 'enviado', 'assinado')),
  com_parte_fixa boolean not null,
  ok_advogado boolean not null default false,
  ok_advogado_por uuid references public.equipe (user_id),
  dados jsonb not null default '{}'::jsonb,
  d4sign_uuid text,
  gerado_em timestamptz,
  enviado_em timestamptz,
  assinado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

-- RLS forcada: so a equipe ativa le e escreve. O webhook usa service_role.
alter table public.equipe enable row level security;
alter table public.clientes enable row level security;
alter table public.mensagens enable row level security;
alter table public.pendencias enable row level security;
alter table public.eventos enable row level security;
alter table public.contratos enable row level security;
alter table public.equipe force row level security;
alter table public.clientes force row level security;
alter table public.mensagens force row level security;
alter table public.pendencias force row level security;
alter table public.eventos force row level security;
alter table public.contratos force row level security;

create policy equipe_le_equipe on public.equipe for select to authenticated using (public.eh_da_equipe());
create policy equipe_clientes on public.clientes for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
create policy equipe_mensagens on public.mensagens for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
create policy equipe_pendencias on public.pendencias for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
create policy equipe_eventos on public.eventos for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
create policy equipe_contratos on public.contratos for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger clientes_atualizado before update on public.clientes for each row execute function public.tocar_atualizado_em();
create trigger contratos_atualizado before update on public.contratos for each row execute function public.tocar_atualizado_em();

-- Tela atualiza sozinha quando chega mensagem.
alter publication supabase_realtime add table public.mensagens;
alter publication supabase_realtime add table public.clientes;
