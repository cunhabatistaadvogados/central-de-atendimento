begin;

/**
 * Contratos assinados importados da D4Sign (21/10/2026).
 *
 * A Andreia mandou os contratos ativos do escritorio e o Edu pediu para entrar
 * no sistema novo, fora do historico. Dois ajustes no banco:
 *
 * - telefone opcional: o contrato chega antes do WhatsApp. Seis familias vieram
 *   sem numero, e o Leo tem o mesmo numero do irmao Erick (um cliente por
 *   numero). A equipe preenche o WhatsApp na ficha quando souber. O unique
 *   continua: varios clientes sem numero sao permitidos, numero repetido nao.
 * - PDF assinado: guardado no bucket privado "contratos". So a equipe le, por
 *   link temporario; o repositorio no GitHub e publico e nao recebe arquivo de
 *   cliente. Os originais continuam na D4Sign e na pasta CONTRATOS do OneDrive.
 */

alter table public.clientes alter column telefone drop not null;
alter table public.contratos add column if not exists arquivo text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos', 'contratos', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "contratos: equipe le" on storage.objects;
create policy "contratos: equipe le" on storage.objects
  for select to authenticated
  using (bucket_id = 'contratos' and (select public.eh_da_equipe()));

drop policy if exists "contratos: equipe sobe" on storage.objects;
create policy "contratos: equipe sobe" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contratos' and (select public.eh_da_equipe()));

commit;

insert into supabase_migrations.schema_migrations (version, name) values ('20261021090000', 'contratos_importados') on conflict (version) do nothing;
