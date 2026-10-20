begin;

/**
 * Robo atende quem volta do Pixel Hub (20/10/2026).
 *
 * Pedido do Edu: "deixa o bot operando para quem chamar". Os importados
 * entraram com o robo pausado (a equipe continuaria o atendimento) e o
 * meta-webhook le o estado do robo ANTES de gravar a mensagem: quem voltava a
 * escrever ficava sem resposta (teste do Edu as 15:03).
 *
 * Agora o robo recomeca do zero para quem no Pixel Hub nao passou da
 * qualificacao (etapas novo e qualificacao). Qualificado, reuniao e perdido
 * continuam com a equipe: o robo recomecar o roteiro com quem ja tinha
 * reuniao marcada seria pior que esperar a equipe responder.
 */

alter table public.clientes disable trigger clientes_atualizado;
update public.clientes
   set robo = '{"ficha": {}, "ultimaPergunta": null, "voltarPara": null, "mensagensDoCliente": 0, "naoEntendeu": 0, "pausado": false, "encaminhado": false}'::jsonb
 where robo ->> 'motivoPausa' = 'Histórico importado do Pixel Hub'
   and etapa in ('novo', 'qualificacao');
alter table public.clientes enable trigger clientes_atualizado;

commit;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020190000', 'robo_atende_quem_volta') on conflict (version) do nothing;
