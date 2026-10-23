begin;

/**
 * O robo responde uma vez por rajada de mensagens e roda uma vez por conversa
 * (23/10/2026). A Sabrina mandou 3 mensagens em 14 s, cada uma rodou o robo ao
 * mesmo tempo com o estado velho, e ele seguiu perguntando depois de passar a
 * conversa para a equipe.
 * - clientes.robo_ocupado_ate: trava da conversa enquanto o robo roda; vence
 *   sozinha se a rodada morrer no meio.
 * - mensagens.robo_leu_em: mensagem da familia que o robo ja leu. As que ainda
 *   nao tem entram juntas na proxima rodada.
 */
alter table public.clientes
  add column if not exists robo_ocupado_ate timestamptz;

alter table public.mensagens
  add column if not exists robo_leu_em timestamptz;

-- O que chegou antes desta versao conta como lido.
update public.mensagens set robo_leu_em = em where de = 'cliente' and robo_leu_em is null;

create index if not exists mensagens_robo_pendentes
  on public.mensagens (cliente_id, em)
  where de = 'cliente' and robo_leu_em is null;

commit;
