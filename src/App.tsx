import { useEffect, useState } from 'react'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import { ProvedorDeDados } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export interface Sessao {
  nome: string
  email: string
  demonstracao: boolean
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

export default function App() {
  const [sessao, setSessao] = useState<Sessao | null>(sessaoGuardada)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      if (u) setSessao({ nome: (u.user_metadata?.nome as string) ?? u.email ?? 'Equipe', email: u.email ?? '', demonstracao: false })
    })
  }, [])

  const entrar = (s: Sessao) => {
    try {
      if (s.demonstracao) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s))
    } catch {
      // aba anonima: a sessao vale ate recarregar
    }
    setSessao(s)
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
  return (
    <ProvedorDeDados>
      <Home sessao={sessao} onSair={sair} />
    </ProvedorDeDados>
  )
}
