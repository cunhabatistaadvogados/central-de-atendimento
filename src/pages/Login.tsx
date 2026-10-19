import { ArrowRight, Eye, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Sessao } from '@/App'
import logo from '@/assets/logo-cbaa.jpg'
import { ArteDoMenu } from '@/components/Marca'
import { ESCRITORIO } from '@/lib/escritorio'
import { supabase, supabaseConfigurado } from '@/lib/supabase'

export default function Login({ onEntrar }: { onEntrar: (s: Sessao) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!supabase) {
      setErro('O acesso com senha é liberado quando o banco do escritório estiver ligado. Por enquanto, use a demonstração.')
      return
    }
    setEntrando(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEntrando(false)
    if (error || !data.user) {
      setErro(error?.message === 'Invalid login credentials' ? 'E-mail ou senha não conferem.' : (error?.message ?? 'Não foi possível entrar.'))
      return
    }
    onEntrar({ nome: (data.user.user_metadata?.nome as string) ?? data.user.email ?? 'Equipe', email: data.user.email ?? '', demonstracao: false })
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-marinho-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <ArteDoMenu />
        <div className="grade-suave absolute inset-0 opacity-50" />
        <div className="absolute -right-32 top-24 h-96 w-96 rounded-full bg-ouro-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <img src={logo} alt="CB& Advogados Associados" className="h-16 w-16 rounded-2xl shadow-[0_14px_30px_rgba(0,0,0,.35)]" />
          <div>
            <p className="titulo-serif text-2xl">{ESCRITORIO.nome}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">{ESCRITORIO.oab} · Santos/SP</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="rotulo mb-5 text-ouro-400">Central de atendimento BPC/LOAS</p>
          <h1 className="titulo-serif text-[56px] leading-[1.02]">
            Cada família ouvida
            <br />
            no tempo <span className="text-ouro-400 italic">certo</span>.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/60">
            O robô acolhe e qualifica no WhatsApp a qualquer hora, a equipe assume no momento do fechamento e o contrato sai pronto ao final.
          </p>
        </div>
        <div className="relative grid max-w-xl grid-cols-3 gap-4">
          {[
            ['24h', 'acolhimento no WhatsApp'],
            ['1', 'pergunta por mensagem'],
            ['1 clique', 'para o contrato'],
          ].map(([n, t]) => (
            <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="titulo-serif text-3xl text-ouro-400">{n}</p>
              <p className="mt-1 text-[11px] leading-snug text-white/50">{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-ouro-50 to-transparent" />
        <div className="entrar relative w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="" className="h-14 w-14 rounded-2xl" />
            <div>
              <p className="titulo-serif text-xl">Cunha Batista &amp; Advogados</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Central de atendimento</p>
            </div>
          </div>
          <p className="rotulo text-ouro-600">Acesso da equipe</p>
          <h2 className="titulo-serif mt-2 text-4xl text-marinho-900">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm text-slate-500">Entre com o e-mail e a senha que o escritório liberou para você.</p>

          <form onSubmit={entrar} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-marinho-800">E-mail</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="campo pl-10" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@cunhabatista.com.br" required />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-marinho-800">Senha</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="campo pl-10" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </span>
            </label>
            {erro && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{erro}</p>}
            <button type="submit" disabled={entrando} className="botao-primario w-full py-3">
              {entrando ? 'Entrando...' : 'Entrar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="my-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
            <span className="h-px flex-1 bg-slate-200" />
            ou
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => onEntrar({ nome: 'Equipe CB&AA', email: 'demonstracao', demonstracao: true })}
            className="botao-claro w-full py-3"
          >
            <Eye className="h-4 w-4 text-ouro-600" />
            Ver a demonstração (dados fictícios)
          </button>

          <p className="mt-8 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ouro-500" />
            {supabaseConfigurado
              ? 'Conexão protegida. Os dados dos clientes ficam no banco do escritório, com acesso só para a equipe.'
              : 'Banco do escritório ainda não ligado nesta cópia: a demonstração guarda tudo só neste navegador.'}
          </p>
        </div>
      </section>
    </div>
  )
}
