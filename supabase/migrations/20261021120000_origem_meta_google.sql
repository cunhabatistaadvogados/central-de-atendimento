-- Etiquetas de origem pedidas pelo Lucas em 21/10/2026: Meta, Google e Site
-- (o "anuncio" antigo fica para quem nao deu para saber). O anuncio de clique
-- para WhatsApp do Meta chega no "referral" da 1a mensagem: titulo, link e id
-- do anuncio ficam em clientes.anuncio. O Google nao manda nada: a origem vem
-- da frase pronta de cada link de campanha, lida pelo robo.
alter table public.clientes drop constraint if exists clientes_origem_check;
alter table public.clientes add constraint clientes_origem_check
  check (origem in ('anuncio', 'meta', 'google', 'site', 'instagram', 'indicacao'));

alter table public.clientes add column if not exists anuncio jsonb;
comment on column public.clientes.anuncio is
  'Anuncio do Meta (referral da 1a mensagem): titulo, texto, link, id do anuncio e ctwa_clid.';
