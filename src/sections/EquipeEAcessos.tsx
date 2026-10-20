import { Copy, Eye, EyeOff, Link2, Lock, MessageCircle, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Avatar, Campo, Interruptor } from '@/components/ui'
import { dataHora } from '@/lib/formato'
import {
  atualizarMembro,
  convidarMembro,
  definirQuemEstaOnline,
  excluirMembro,
  linkDeAcesso,
  listarEquipe,
  PAPEIS,
  podeAdministrar,
  situacaoDosAcessos,
  type Membro,
  type Papel,
  type Situacao,
} from '@/lib/equipe'

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
  const [situacao, setSituacao] = useState<Situacao>({})
  const [linkAberto, setLinkAberto] = useState<{ userId: string; nome: string; link: string; copiado: boolean } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const admin = podeAdministrar(membro)
  const souDev = membro?.papel === 'desenvolvedor'

  const recarregar = useCallback(() => {
    if (!membro) return
    listarEquipe()
      .then(setEquipe)
      .catch((e: Error) => setErro(e.message))
    // E-mail e "ja criou a senha" so o administrador ve (vem da funcao).
    if (podeAdministrar(membro)) {
      situacaoDosAcessos()
        .then(setSituacao)
        .catch(() => setSituacao({}))
    }
  }, [membro])

  async function gerarLink(p: Membro) {
    setErro('')
    setAviso('')
    setOcupado(p.user_id)
    try {
      const { link } = await linkDeAcesso(p.user_id)
      let copiado = false
      try {
        await navigator.clipboard.writeText(link)
        copiado = true
      } catch {
        // sem permissao de area de transferencia: o link fica na caixa para copiar
      }
      setLinkAberto({ userId: p.user_id, nome: p.nome, link, copiado })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o link.')
    } finally {
      setOcupado(null)
    }
  }

  async function excluir(p: Membro) {
    if (!window.confirm(`Excluir o acesso de ${p.nome}? O login é apagado e a pessoa sai da equipe. Dá para convidar de novo depois.`)) return
    setOcupado(p.user_id)
    if (linkAberto?.userId === p.user_id) setLinkAberto(null)
    await executar(() => excluirMembro(p.user_id), `Acesso de ${p.nome} excluído.`)
    setOcupado(null)
  }

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
          const s = situacao[p.user_id]
          return (
            <li key={p.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar nome={p.nome} tamanho="h-9 w-9 text-[11px]" />
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-bold">
                  {p.nome} {p.user_id === membro.user_id && <span className="text-xs font-semibold text-slate-400">(você)</span>}
                </p>
                {s?.email && <p className="truncate text-[11px] text-slate-500">{s.email}</p>}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                  {ehDev ? (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" /> nunca aparece online
                    </span>
                  ) : (
                    <span>{p.aparece_online ? 'aparece no "quem está online"' : 'oculto do "quem está online"'}</span>
                  )}
                  {/* Quem ainda nao criou a senha precisa do link: o convite pode
                      ter ficado na quarentena do e-mail do escritorio. */}
                  {s && !s.criouSenha && <span className="rounded-full bg-ouro-100 px-2 py-0.5 font-bold text-ouro-700">ainda não criou a senha</span>}
                  {s?.criouSenha && <span>{s.ultimoAcesso ? `último acesso ${dataHora(s.ultimoAcesso)}` : 'criou a senha, ainda não entrou'}</span>}
                </p>
              </div>
              {podeMexer && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void gerarLink(p)}
                    disabled={ocupado === p.user_id}
                    title="Gera um link para a pessoa criar a senha. Mande pelo WhatsApp."
                    className={`botao px-3 py-2 text-xs ${s && !s.criouSenha ? 'bg-ouro-500 text-marinho-950 hover:bg-ouro-400' : 'botao-claro'}`}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Link de acesso
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluir(p)}
                    disabled={ocupado === p.user_id}
                    aria-label={`Excluir o acesso de ${p.nome}`}
                    title="Excluir o acesso"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              {linkAberto?.userId === p.user_id && (
                <div className="w-full rounded-2xl border border-ouro-200 bg-ouro-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-marinho-900">
                      {linkAberto.copiado ? 'Link copiado.' : 'Copie o link abaixo.'} Mande para {linkAberto.nome} pelo WhatsApp: abrindo, a pessoa cria a senha e já entra. Vale 1 hora e só funciona uma vez.
                    </p>
                    <button type="button" onClick={() => setLinkAberto(null)} aria-label="Fechar" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input readOnly value={linkAberto.link} onFocus={(e) => e.currentTarget.select()} className="campo min-w-0 flex-1 py-2 text-xs" />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(linkAberto.link).then(() => setLinkAberto({ ...linkAberto, copiado: true }))}
                      className="botao-claro shrink-0 px-3 py-2 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Olá, ${linkAberto.nome}! Seu acesso à Central de atendimento do escritório: abra o link, crie a sua senha e pronto. ${linkAberto.link}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="botao shrink-0 bg-[#1daa61] px-3 py-2 text-xs text-white hover:bg-[#178a4f]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </div>
                </div>
              )}
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
