import { Eye, EyeOff, Lock, UserPlus, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Avatar, Campo, Interruptor } from '@/components/ui'
import { atualizarMembro, convidarMembro, definirQuemEstaOnline, listarEquipe, PAPEIS, podeAdministrar, type Membro, type Papel } from '@/lib/equipe'

const PAPEIS_DA_EQUIPE: Papel[] = ['atendimento', 'advogado', 'administrador']

export default function EquipeEAcessos({
  membro,
  quemEstaOnline,
  aoMudarQuemEstaOnline,
}: {
  membro: Membro | null
  quemEstaOnline: boolean
  aoMudarQuemEstaOnline: (v: boolean) => void
}) {
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [novo, setNovo] = useState({ email: '', nome: '', papel: 'atendimento' as Papel })
  const [salvando, setSalvando] = useState(false)
  const admin = podeAdministrar(membro)
  const souDev = membro?.papel === 'desenvolvedor'

  const recarregar = useCallback(() => {
    if (!membro) return
    listarEquipe()
      .then(setEquipe)
      .catch((e: Error) => setErro(e.message))
  }, [membro])

  useEffect(recarregar, [recarregar])

  async function executar(acao: () => Promise<unknown>, ok: string) {
    setErro('')
    setAviso('')
    try {
      await acao()
      setAviso(ok)
      recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      const convidado = await convidarMembro(novo.email.trim(), novo.nome.trim(), novo.papel)
      setAviso(
        convidado
          ? `Convite enviado para ${novo.email.trim()}. ${novo.nome.trim()} abre o e-mail, cria a senha e já entra.`
          : `${novo.email.trim()} já tinha login: o acesso de ${novo.nome.trim()} foi liberado.`,
      )
      setNovo({ email: '', nome: '', papel: 'atendimento' })
      recarregar()
    } catch (erro) {
      // O formulario fica preenchido para tentar de novo.
      setErro(erro instanceof Error ? erro.message : 'Não foi possível criar o acesso.')
    } finally {
      setSalvando(false)
    }
  }

  if (!membro) {
    return (
      <section className="cartao flex items-start gap-4 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marinho-50 text-marinho-700">
          <UsersRound className="h-5 w-5" />
        </span>
        <div>
          <p className="titulo-serif text-xl">Equipe e acessos</p>
          <p className="text-sm text-slate-500">Na demonstração não há equipe. Entre com o seu login para ver quem está online, definir papéis e liberar acessos.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="cartao p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="rotulo flex items-center gap-2 text-ouro-600">
            <UsersRound className="h-3.5 w-3.5" /> Equipe e acessos
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {admin ? 'Você define o papel de cada pessoa e se a equipe vê quem está online.' : 'Só administradores alteram papéis e acessos.'}
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-marinho-900/10 px-4 py-3">
          {quemEstaOnline ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
          <span className="text-sm font-bold">Mostrar quem está online</span>
          <Interruptor
            ligado={quemEstaOnline}
            rotulo="Mostrar quem está online"
            onChange={(v) => {
              if (!admin) return
              aoMudarQuemEstaOnline(v)
              void executar(() => definirQuemEstaOnline(v, membro.user_id), v ? 'Quem está online: ligado para toda a equipe.' : 'Quem está online: desligado para toda a equipe.')
            }}
          />
        </label>
      </div>

      {erro && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erro}</p>}
      {aviso && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{aviso}</p>}

      <ul className="mt-5 divide-y divide-marinho-900/[0.06]">
        {equipe.map((p) => {
          const ehDev = p.papel === 'desenvolvedor'
          const podeMexer = admin && (!ehDev || souDev) && p.user_id !== membro.user_id
          return (
            <li key={p.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar nome={p.nome} tamanho="h-9 w-9 text-[11px]" />
              <div className="min-w-[160px] flex-1">
                <p className="text-sm font-bold">
                  {p.nome} {p.user_id === membro.user_id && <span className="text-xs font-semibold text-slate-400">(você)</span>}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-slate-400">
                  {ehDev ? (
                    <>
                      <Lock className="h-3 w-3" /> nunca aparece online
                    </>
                  ) : p.aparece_online ? (
                    'aparece no "quem está online"'
                  ) : (
                    'oculto do "quem está online"'
                  )}
                </p>
              </div>
              {podeMexer ? (
                <>
                  <select
                    value={p.papel}
                    onChange={(e) => void executar(() => atualizarMembro(p.user_id, { papel: e.target.value as Papel }), `Papel de ${p.nome} atualizado.`)}
                    className="campo w-48 py-2"
                  >
                    {(souDev ? [...PAPEIS_DA_EQUIPE, 'desenvolvedor' as Papel] : PAPEIS_DA_EQUIPE).map((k) => (
                      <option key={k} value={k}>
                        {PAPEIS[k]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    Ativo
                    <Interruptor
                      ligado={p.ativo}
                      rotulo={`Acesso de ${p.nome}`}
                      onChange={(v) => void executar(() => atualizarMembro(p.user_id, { ativo: v }), v ? `${p.nome} pode entrar.` : `Acesso de ${p.nome} bloqueado.`)}
                    />
                  </label>
                </>
              ) : (
                <span className="rounded-full bg-marinho-50 px-3 py-1 text-xs font-bold text-marinho-700">{PAPEIS[p.papel]}</span>
              )}
            </li>
          )
        })}
      </ul>

      {admin && (
        <form onSubmit={adicionar} className="mt-5 rounded-2xl border border-ouro-200 bg-ouro-50/50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-marinho-900">
            <UserPlus className="h-4 w-4 text-ouro-600" /> Criar acesso para alguém da equipe
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            A pessoa recebe um convite no e-mail (enviado pelo Gmail do escritório), cria a própria senha pelo link e já entra com o papel escolhido aqui. O link vale 1 hora; se vencer, ela usa "Esqueci minha senha" na entrada.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_200px_auto] sm:items-end">
            <Campo rotulo="E-mail da pessoa">
              <input className="campo" type="email" required value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            </Campo>
            <Campo rotulo="Nome">
              <input className="campo" required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Papel">
              <select className="campo" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Papel })}>
                {PAPEIS_DA_EQUIPE.map((k) => (
                  <option key={k} value={k}>
                    {PAPEIS[k]}
                  </option>
                ))}
              </select>
            </Campo>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? 'Enviando convite...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
