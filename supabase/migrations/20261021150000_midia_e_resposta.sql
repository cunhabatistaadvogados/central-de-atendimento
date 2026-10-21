begin;

/**
 * Foto, audio, video e documento do WhatsApp na Central, e resposta citada
 * (pedido do Edu em 21/10/2026: "tem que ter todas funcionalidades do zap").
 *
 * O arquivo fica no bucket privado "midias" e a mensagem guarda o CAMINHO,
 * nao a URL: a tela pede um link temporario para mostrar (igual a foto da
 * equipe). Caminho: <cliente_id>/<arquivo>. Quem recebe da Meta grava com a
 * service_role (webhook); a equipe sobe o que vai mandar e ve tudo.
 *
 * responde_a: wamid da mensagem citada (context.id da Meta). Texto e nao
 * chave estrangeira: a citada pode ser antiga, do Pixel Hub, ou nem existir.
 */

alter table public.mensagens
  add column if not exists midia text,
  add column if not exists midia_tipo text,
  add column if not exists midia_nome text,
  add column if not exists responde_a text;

alter table public.mensagens drop constraint if exists mensagens_midia_tipo;
alter table public.mensagens add constraint mensagens_midia_tipo
  check (midia_tipo is null or midia_tipo in ('imagem', 'audio', 'video', 'documento', 'figurinha'));

alter table public.mensagens drop constraint if exists mensagens_midia_formato;
alter table public.mensagens add constraint mensagens_midia_formato
  check (midia is null or midia ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$');

insert into storage.buckets (id, name, public)
values ('midias', 'midias', false)
on conflict (id) do nothing;

drop policy if exists "midias: equipe ve" on storage.objects;
create policy "midias: equipe ve"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'midias' and (select public.eh_da_equipe()));

drop policy if exists "midias: equipe sobe" on storage.objects;
create policy "midias: equipe sobe"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'midias' and (select public.eh_da_equipe()));

commit;
