import { LogOut, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SeloCB } from '@/components/Marca'
import { meuCadastro, type Membro } from '@/lib/equipe'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import { ProvedorDeDados } from '@/lib/store'
import { supabase } from '@/lib/supabase'

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

  if (!sessao) return <Login onEntrar={entrar} />
  if (!sessao.demonstracao && !sessao.membro?.ativo) return <AcessoPendente sessao={sessao} onSair={sair} />
  return (
    <ProvedorDeDados>
      <Home sessao={sessao} onSair={sair} />
    </ProvedorDeDados>
  )
}
