-- Permissoes da API para as tabelas da central.
--
-- 19/10/2026: o projeto LOAS nasceu com a regra nova do Supabase que NAO
-- expoe tabela nova na API. As tabelas ficaram so com REFERENCES, TRIGGER e
-- TRUNCATE, e no primeiro teste da Meta o webhook gravou nada: o insert e o
-- select do cliente foram recusados ("cliente nao encontrado nem criado").
-- Mesma licao do sistema do Marcello (20260823193000_grant_service_role_whatsapp).
--
-- anon (visitante sem login) nao tem nada a fazer aqui: dado de cliente de
-- escritorio de advocacia. O RLS ja barrava; agora nem a permissao existe.

revoke all on public.equipe, public.clientes, public.mensagens, public.pendencias, public.eventos, public.contratos from anon;

grant usage on schema public to authenticated, service_role;

-- Webhook e envio pelo WhatsApp (Edge Functions com service_role).
grant select, insert, update, delete
  on public.equipe, public.clientes, public.mensagens, public.pendencias, public.eventos, public.contratos
  to service_role;

-- Equipe logada na tela. O RLS (eh_da_equipe) continua decidindo quem ve o que.
grant select, insert, update, delete
  on public.clientes, public.mensagens, public.pendencias, public.eventos, public.contratos
  to authenticated;
grant select on public.equipe to authenticated;

revoke execute on function public.eh_da_equipe() from public, anon;
grant execute on function public.eh_da_equipe() to authenticated, service_role;
