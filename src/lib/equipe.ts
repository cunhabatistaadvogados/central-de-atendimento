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
  /** Caminho da foto no bucket; sem foto, a tela mostra as iniciais. */
  foto?: string | null
}

/*
 * Foto da equipe (migration 20261019200000), igual ao sistema do Marcello.
 * Tudo aqui falha para o lado quieto de proposito: sem a coluna nova no banco
 * ou sem foto, aparecem as iniciais. Foto e enfeite, nao pode derrubar o
 * login de ninguem; por isso ela e lida em consulta separada do cadastro.
 */
const BUCKET = 'fotos-da-equipe'

// O bucket e privado: link temporario de 1h, reaproveitado por 50 min.
const linkCache = new Map<string, { url: string; ate: number }>()
export async function linkDaFoto(caminho: string | null | undefined): Promise<string | null> {
  if (!caminho || !supabase) return null
  const guardado = linkCache.get(caminho)
  if (guardado && guardado.ate > Date.now()) return guardado.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600)
  if (error || !data?.signedUrl) return null
  linkCache.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}

export async function lerMinhaFoto(userId: string): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('equipe').select('foto').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return (data as { foto?: string | null } | null)?.foto ?? null
  } catch (erro) {
    console.warn('Foto da equipe indisponivel', erro)
    return null
  }
}

/** Envia a foto ja ajustada (256x256) e grava o caminho no cadastro. */
export async function enviarMinhaFoto(userId: string, arquivo: File, anterior: string | null): Promise<string> {
  if (!supabase) throw new Error('Foto só funciona com o banco do escritório ligado.')
  const caminho = `${userId}/${Date.now()}.jpg`
  const { error: erroEnvio } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: 'image/jpeg', upsert: false })
  if (erroEnvio) throw new Error(`Não consegui enviar a foto: ${erroEnvio.message}`)
  const { error } = await supabase.rpc('definir_minha_foto', { p_caminho: caminho })
  if (error) throw new Error(`Foto enviada, mas não consegui salvar no cadastro: ${error.message}`)
  // A antiga sai depois que a nova esta gravada: se falhar, sobra so um
  // arquivo orfao, nunca um cadastro sem foto.
  if (anterior && anterior !== caminho) await supabase.storage.from(BUCKET).remove([anterior]).catch(() => undefined)
  return caminho
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

/**
 * Cria o acesso de alguem da equipe: a funcao convidar-membro manda o convite
 * por e-mail (remetente: Gmail do escritorio) e libera o papel. Se o e-mail ja
 * tem login, so libera. Devolve se saiu convite novo.
 */
// Todas as acoes de acesso passam pela funcao convidar-membro (chave de servico
// so no servidor). O corpo do erro traz o motivo real (ex.: SMTP recusou).
async function acessos<T>(corpo: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Disponível só com o banco do escritório ligado.')
  const voltar = `${window.location.origin}${window.location.pathname}`
  const { data, error } = await supabase.functions.invoke('convidar-membro', { body: { ...corpo, voltar } })
  if (error) {
    let motivo = error.message
    try {
      const resposta = await (error as { context?: Response }).context?.json()
      if (resposta?.error) motivo = resposta.error
    } catch {
      // sem corpo legivel: fica a mensagem generica
    }
    throw new Error(motivo)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export async function convidarMembro(email: string, nome: string, papel: Papel): Promise<boolean> {
  const r = await acessos<{ convidado?: boolean }>({ acao: 'convidar', email, nome, papel })
  return Boolean(r.convidado)
}

/** Link de acesso para mandar pelo WhatsApp (o e-mail pode cair na quarentena). */
export async function linkDeAcesso(userId: string): Promise<{ link: string; tipo: 'invite' | 'recovery' }> {
  return acessos({ acao: 'link', user_id: userId })
}

/** Apaga o login e tira da equipe; da para convidar de novo depois. */
export async function excluirMembro(userId: string): Promise<void> {
  await acessos({ acao: 'excluir', user_id: userId })
}

export type Situacao = Record<string, { email: string; criouSenha: boolean; ultimoAcesso: string | null }>

/** Quem ja criou a senha e quando entrou: o banco nao expoe isso a tela. */
export async function situacaoDosAcessos(): Promise<Situacao> {
  const r = await acessos<{ situacao: Situacao }>({ acao: 'situacao' })
  return r.situacao ?? {}
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
export function useQuemEstaOnline(eu: Membro | null, ligado: boolean, minhaFoto: string | null = null): Online[] {
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
        .map(({ user_id, nome, papel, foto }) => ({ user_id, nome, papel, foto: foto ?? null }))
      setOnline(pessoas)
    })
    canal.subscribe((status) => {
      // A foto vai junto no anuncio: quem esta online ja ve a fotinho sem ler o banco.
      if (status === 'SUBSCRIBED' && anunciar) void canal.track({ user_id: eu.user_id, nome: eu.nome, papel: eu.papel, foto: minhaFoto })
    })
    return () => {
      void supabase?.removeChannel(canal)
    }
  }, [eu, ligado, anunciar, minhaFoto])

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
