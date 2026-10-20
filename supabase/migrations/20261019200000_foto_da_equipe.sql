begin;

/**
 * Foto da equipe no topo, igual ao sistema do Marcello (pedido do Edu em
 * 19/10/2026): a fotinho de quem esta online e a sua, clicavel para trocar.
 * Sem foto, aparecem as iniciais.
 *
 * Guardamos o CAMINHO no bucket, nao a URL: o bucket e privado e a tela pede
 * um link temporario para mostrar. Caminho: <user_id>/<arquivo>. Cada um mexe
 * so na propria pasta; ver, so quem e da equipe.
 */

alter table public.equipe add column if not exists foto text;

alter table public.equipe drop constraint if exists equipe_foto_formato;
alter table public.equipe add constraint equipe_foto_formato
  check (foto is null or foto ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-da-equipe', 'fotos-da-equipe', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos da equipe: ver" on storage.objects;
create policy "fotos da equipe: ver"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos-da-equipe' and public.eh_da_equipe());

drop policy if exists "fotos da equipe: subir a propria" on storage.objects;
create policy "fotos da equipe: subir a propria"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-da-equipe'
    and public.eh_da_equipe()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "fotos da equipe: trocar a propria" on storage.objects;
create policy "fotos da equipe: trocar a propria"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos-da-equipe' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fotos-da-equipe' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fotos da equipe: apagar a propria" on storage.objects;
create policy "fotos da equipe: apagar a propria"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-da-equipe' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Gravar a propria foto por funcao, e nao abrindo update na tabela equipe:
-- assim ninguem ganha permissao de mexer no proprio papel ou no "ativo".
create or replace function public.definir_minha_foto(p_caminho text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_da_equipe() then
    raise exception 'Somente a equipe tem foto.';
  end if;
  if p_caminho is not null and split_part(p_caminho, '/', 1) <> auth.uid()::text then
    raise exception 'A foto tem que estar na sua pasta.';
  end if;
  update public.equipe set foto = p_caminho where user_id = auth.uid();
end;
$$;

revoke execute on function public.definir_minha_foto(text) from public, anon;
grant execute on function public.definir_minha_foto(text) to authenticated;

commit;
