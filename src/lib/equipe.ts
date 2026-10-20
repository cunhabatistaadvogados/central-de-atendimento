/**
 * Equipe, papeis e "quem esta online".
 *
 * Papeis do guia do Lucas: atendimento (secretaria/staff), advogado e
 * administrador. Mais o desenvolvedor (Edu): ve e pode tudo como
 * administrador, mas NUNCA aparece online. O banco garante isso com um
 * gatilho (aparece_online sempre false para desenvolvedor); aqui a tela so
 * respeita, sem confiar em si mesma.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Papel = 'atendimento' | 'advogado' | 'administrador' | 'desenvolvedor'

export const PAPEIS: Record<Papel, string> = {
  atendimento: 'Atendimento (staff)',
  advogado: 'Advogado(a)',
  administrador: 'Administrador',
  desenvolvedor: 'Desenvolvedor',
}

export interface Membro {
  user_id: string
  nome: string
  papel: Papel
  ativo: boolean
  aparece_online: boolean
}

export interface Online {
  user_id: string
  nome: string
  papel: Papel
}

export function podeAdministrar(m: Membro | null | undefined): boolean {
  return Boolean(m && m.ativo && (m.papel === 'administrador' || m.papel === 'desenvolvedor'))
}

/** Aparece no "quem esta online"? Desenvolvedor nunca, mesmo se o banco errar. */
export function apareceOnline(m: Membro | null | undefined): boolean {
  return Boolean(m && m.ativo && m.aparece_online && m.papel !== 'desenvolvedor')
}

export async function meuCadastro(userId: string): Promise<Membro | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('equipe').select('user_id, nome, papel, ativo, aparece_online').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Não consegui ler o seu cadastro na equipe: ${error.message}`)
  return (data as Membro | null) ?? null
}

export async function listarEquipe(): Promise<Membro[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('equipe').select('user_id, nome, papel, ativo, aparece_online').order('nome')
  if (error) throw new Error(error.message)
  return (data as Membro[]) ?? []
}

export async function atualizarMembro(userId: string, campos: Partial<Pick<Membro, 'nome' | 'papel' | 'ativo' | 'aparece_online'>>) {
  if (!supabase) return
  const { error } = await supabase.from('equipe').update(campos).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function adicionarMembro(email: string, nome: string, papel: Papel) {
  if (!supabase) return
  const { error } = await supabase.rpc('adicionar_membro', { p_email: email, p_nome: nome, p_papel: papel })
  if (error) throw new Error(error.message)
}

export async function lerQuemEstaOnline(): Promise<boolean> {
  if (!supabase) return true
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'quem_esta_online').maybeSingle()
  // Sem a linha (ou sem acesso), vale o padrao pedido: ligado.
  return data ? data.valor !== false : true
}

export async function definirQuemEstaOnline(ligado: boolean, userId: string) {
  if (!supabase) return
  const { error } = await supabase
    .from('configuracoes')
    .update({ valor: ligado, atualizado_em: new Date().toISOString(), atualizado_por: userId })
    .eq('chave', 'quem_esta_online')
  if (error) throw new Error(error.message)
}

/**
 * Presenca pelo Realtime do Supabase. Todo mundo da equipe ESCUTA o canal
 * (para ver quem esta online); so quem apareceOnline() se ANUNCIA. Assim o
 * desenvolvedor ve a equipe e ninguem ve o desenvolvedor.
 */
export function useQuemEstaOnline(eu: Membro | null, ligado: boolean): Online[] {
  const [online, setOnline] = useState<Online[]>([])
  const anunciar = apareceOnline(eu)

  useEffect(() => {
    if (!supabase || !eu || !ligado) {
      setOnline([])
      return
    }
    const canal = supabase.channel('equipe-online', { config: { presence: { key: eu.user_id } } })
    canal.on('presence', { event: 'sync' }, () => {
      const estado = canal.presenceState<Online>()
      const pessoas = Object.values(estado)
        .map((lista) => lista[0])
        .filter((p): p is Online & { presence_ref: string } => Boolean(p && p.user_id))
        .filter((p) => p.papel !== 'desenvolvedor')
        .map(({ user_id, nome, papel }) => ({ user_id, nome, papel }))
      setOnline(pessoas)
    })
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED' && anunciar) void canal.track({ user_id: eu.user_id, nome: eu.nome, papel: eu.papel })
    })
    return () => {
      void supabase?.removeChannel(canal)
    }
  }, [eu, ligado, anunciar])

  return online
}

/** Le a configuracao e relê ao voltar para a aba: um admin pode ter mudado. */
export function useConfigQuemEstaOnline(ativo: boolean): [boolean, (v: boolean) => void] {
  const [ligado, setLigado] = useState(true)
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    const ler = () => void lerQuemEstaOnline().then((v) => vivo && setLigado(v))
    ler()
    window.addEventListener('focus', ler)
    const timer = window.setInterval(ler, 120000)
    return () => {
      vivo = false
      window.removeEventListener('focus', ler)
      window.clearInterval(timer)
    }
  }, [ativo])
  return [ligado, setLigado]
}
