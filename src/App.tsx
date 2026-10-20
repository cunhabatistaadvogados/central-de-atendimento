import { KeyRound, LogOut, ShieldAlert } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { SeloCB } from '@/components/Marca'
import { meuCadastro, type Membro } from '@/lib/equipe'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import { ProvedorDeDados } from '@/lib/store'
import { supabase, tipoDoLinkDeEmail } from '@/lib/supabase'

export interface Sessao {
  nome: string
  email: string
  demonstracao: boolean
  userId?: string
  /** Cadastro na tabela equipe. Sem ele, login existe mas o acesso nao foi liberado. */
  membro?: Membro | null
}

const CHAVE_SESSAO = 'cbaa:sessao-demo'

function sessaoGuardada(): Sessao | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO)
    return bruto ? (JSON.parse(bruto) as Sessao) : null
  } catch {
    return null
  }
}

async function sessaoDoSupabase(): Promise<Sessao | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  if (!u) return null
  const membro = await meuCadastro(u.id).catch(() => null)
  return { nome: membro?.nome ?? u.email ?? 'Equipe', email: u.email ?? '', demonstracao: false, userId: u.id, membro }
}

/**
 * Quem chega pelo link do e-mail (convite da equipe ou "esqueci a senha") cria
 * a senha aqui antes de entrar. O supabase-js ja abriu a sessao com o token do
 * link; falta so gravar a senha nessa conta.
 */
function CriarSenha({ tipo, onPronto }: { tipo: 'invite' | 'recovery'; onPronto: () => void }) {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [semSessao, setSemSessao] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let vivo = true
    const ler = () =>
      void supabase!.auth.getSession().then(({ data }) => {
        if (!vivo) return
        if (data.session?.user) setEmail(data.session.user.email ?? '')
      })
    ler()
    const { data: escuta } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (vivo && s?.user) setEmail(s.user.email ?? '')
    })
    // O token do link e lido em segundo plano; sem sessao depois de uns
    // segundos, o link venceu ou ja foi usado.
    const limite = window.setTimeout(() => vivo && setSemSessao(true), 6000)
    return () => {
      vivo = false
      escuta.subscription.unsubscribe()
      window.clearTimeout(limite)
    }
  }, [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.')
    if (senha !== confirmar) return setErro('As duas senhas não estão iguais.')
    setSalvando(true)
    const { error } = await supabase!.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) return setErro(`Não consegui salvar a senha: ${error.message}`)
    // Tira o token do endereco: recarregar a pagina nao repete o fluxo.
    window.history.replaceState(null, '', window.location.pathname)
    onPronto()
  }

  const convite = tipo === 'invite'
  return (
    <div className="flex min-h-dvh items-center justify-center bg-papel px-5">
      <form onSubmit={salvar} className="cartao w-full max-w-md p-8">
        <SeloCB className="h-14 w-14" />
        <span className="mt-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-ouro-50 text-ouro-600">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="titulo-serif mt-4 text-3xl">{convite ? 'Bem-vindo à Central' : 'Crie uma senha nova'}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {email === null
            ? semSessao
              ? 'Este link venceu ou já foi usado. Peça um convite novo ao administrador ou use "Esqueci minha senha" na tela de entrada.'
              : 'Conferindo o seu link...'
            : convite
              ? <>Crie a sua senha para entrar com <b>{email}</b>.</>
              : <>Defina a nova senha de <b>{email}</b>.</>}
        </p>
        {email !== null && (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-marinho-800">Senha</span>
              <input className="campo" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-marinho-800">Repita a senha</span>
              <input className="campo" type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={8} />
            </label>
            {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}
            <button type="submit" disabled={salvando} className="botao-primario w-full py-3">
              {salvando ? 'Salvando...' : convite ? 'Criar senha e entrar' : 'Salvar e entrar'}
            </button>
          </div>
        )}
        {email === null && semSessao && (
          <button
            type="button"
            onClick={() => {
              window.history.replaceState(null, '', window.location.pathname)
              window.location.reload()
            }}
            className="botao-claro mt-6"
          >
            Ir para a tela de entrada
          </button>
        )}
      </form>
    </div>
  )
}

function AcessoPendente({ sessao, onSair }: { sessao: Sessao; onSair: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-papel px-5">
      <div className="cartao w-full max-w-md p-8 text-center">
        <SeloCB className="mx-auto h-16 w-16" />
        <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-ouro-50 text-ouro-600">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="titulo-serif mt-4 text-3xl">Acesso aguardando liberação</h1>
        <p className="mt-2 text-sm text-slate-500">
          O login <b>{sessao.email}</b> existe, mas ainda não faz parte da equipe do escritório. Peça a um administrador para liberar o seu acesso em Preferências &gt; Equipe.
        </p>
        <button type="button" onClick={onSair} className="botao-claro mt-6">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [sessao, setSessao] = useState<Sessao | null>(sessaoGuardada)
  const [criandoSenha, setCriandoSenha] = useState(Boolean(supabase && tipoDoLinkDeEmail))

  useEffect(() => {
    if (!supabase) return
    void sessaoDoSupabase().then((s) => s && setSessao(s))
  }, [])

  const entrar = async (s: Sessao) => {
    if (s.demonstracao) {
      try {
        sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s))
      } catch {
        // aba anonima: a sessao vale ate recarregar
      }
      setSessao(s)
      return
    }
    setSessao((await sessaoDoSupabase()) ?? s)
  }

  const sair = async () => {
    try {
      sessionStorage.removeItem(CHAVE_SESSAO)
    } catch {
      // nada guardado
    }
    if (supabase && !sessao?.demonstracao) await supabase.auth.signOut()
    setSessao(null)
  }

  if (criandoSenha && tipoDoLinkDeEmail) {
    return (
      <CriarSenha
        tipo={tipoDoLinkDeEmail}
        onPronto={() => {
          setCriandoSenha(false)
          void sessaoDoSupabase().then((s) => s && setSessao(s))
        }}
      />
    )
  }
  if (!sessao) return <Login onEntrar={entrar} />
  if (!sessao.demonstracao && !sessao.membro?.ativo) return <AcessoPendente sessao={sessao} onSair={sair} />
  return (
    <ProvedorDeDados demonstracao={sessao.demonstracao}>
      <Home sessao={sessao} onSair={sair} />
    </ProvedorDeDados>
  )
}
