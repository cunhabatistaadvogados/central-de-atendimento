import { primeiroNome } from '@motor/robo'
import { AlertTriangle, BadgeCheck, CheckCircle2, Circle, Download, FileCheck2, FileSignature, Info, RefreshCw, RotateCcw, Send } from 'lucide-react'
import { useState } from 'react'
import { Campo, Interruptor } from '@/components/ui'
import { rascunhoDoContrato } from '@/lib/atendimento'
import { dataPorExtenso, faltando, gerarContratoDocx, nomeDoArquivo, segmentosClausula2, segmentosParte, signatario, type Segmento } from '@/lib/contrato'
import { dataHora } from '@/lib/formato'
import { linkDoContratoAssinado, reenviarContratoD4Sign, situacaoDoContratoD4Sign, type SituacaoD4Sign } from '@/lib/repositorio'
import { useDados } from '@/lib/store'
import type { Cliente, Contrato, DadosContrato } from '@/lib/tipos'

function Trecho({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map(([t, b], i) =>
        b ? (
          <b key={i} className="font-bold">
            {t}
          </b>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  )
}

/** O .docx do contrato a partir da minuta do escritorio (o mesmo do "Baixar" e do envio). */
async function gerarArquivo(dados: DadosContrato, comParteFixa: boolean): Promise<Uint8Array> {
  const resp = await fetch(`${import.meta.env.BASE_URL}modelos/contrato_bpc_loas.docx`)
  if (!resp.ok) throw new Error('Não encontrei a minuta do contrato no sistema.')
  return gerarContratoDocx(await resp.arrayBuffer(), dados, comParteFixa)
}

async function baixar(dados: DadosContrato, comParteFixa: boolean) {
  const bytes = await gerarArquivo(dados, comParteFixa)
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeDoArquivo(dados, comParteFixa)
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function paraBase64(bytes: Uint8Array): string {
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(texto)
}

// A familia ve o nome do arquivo na mensagem da D4Sign: nada de "padrao" ou "com_valor_fixo".
function nomeParaAssinatura(d: DadosContrato): string {
  const quem = (d.menor ? d.repNome : d.nome).trim()
  return `Contrato de prestação de serviços${quem ? ` - ${quem}` : ''}.docx`
}

/** Aviso pelo nosso WhatsApp antes da mensagem da D4Sign, que vem de um número dos EUA. */
function avisoDoContrato(nome: string): string {
  const n = primeiroNome(nome)
  return `Olá, ${n || 'tudo bem'}! O contrato do seu atendimento de BPC/LOAS vai chegar agora aqui no WhatsApp, numa mensagem da D4Sign, a plataforma de assinatura digital que o escritório usa (conta verificada, número +1 206 736-4115). É só tocar em "Visualizar documento" e assinar. Qualquer dúvida, é só chamar aqui.`
}

export default function EditorDeContrato({ cliente, autor }: { cliente: Cliente; autor: string }) {
  const { salvarContrato, enviarParaAssinatura, responder, demonstracao } = useDados()
  const contrato: Contrato = cliente.contrato ?? rascunhoDoContrato(cliente)
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [avisarAntes, setAvisarAntes] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [situacao, setSituacao] = useState<SituacaoD4Sign | null>(null)
  const [consultando, setConsultando] = useState(false)
  const d = contrato.dados
  const faltam = faltando(d)
  const sugerida = rascunhoDoContrato(cliente).comParteFixa
  const travado = contrato.status === 'enviado' || contrato.status === 'assinado'

  const salvar = (mudanca: Partial<Contrato>) => salvarContrato(cliente.id, { ...contrato, ...mudanca })
  const campo = (k: keyof DadosContrato) => ({
    value: String(d[k] ?? ''),
    disabled: travado,
    onChange: (e: { target: { value: string } }) => salvar({ dados: { ...d, [k]: e.target.value }, status: contrato.status === 'pronto' ? 'rascunho' : contrato.status }),
    className: 'campo',
  })

  // A familia assina pelo WhatsApp (decisao do Lucas); sem WhatsApp, pelo e-mail do contrato.
  const contato = cliente.telefone ? `WhatsApp ${cliente.telefone}` : d.email.trim() ? `e-mail ${d.email.trim()}` : ''
  const pelaD4Sign = Boolean(contrato.d4signUuid)

  async function aoEnviar() {
    setErro('')
    setAviso('')
    setEnviando(true)
    try {
      const bytes = await gerarArquivo(d, contrato.comParteFixa)
      let nota = ''
      const avisar = avisarAntes && Boolean(cliente.telefone)
      // No real quem avisa e a funcao do contrato (texto ou, fora das 24h do
      // WhatsApp, o modelo aprovado); na demonstracao o aviso so aparece na conversa.
      if (avisar && demonstracao) await responder(cliente.id, avisoDoContrato(cliente.nome), autor)
      const aviso = await enviarParaAssinatura(cliente.id, { base64: paraBase64(bytes), nome: nomeParaAssinatura(d) }, avisar && !demonstracao)
      if (aviso?.startsWith('falhou')) nota = ` O aviso pelo nosso WhatsApp não foi (${aviso.replace(/^falhou:\s*/, '')}), mas o contrato seguiu.`
      setConfirmando(false)
      setAviso(`Enviado. A família recebe o link ${cliente.telefone ? 'pelo WhatsApp' : 'por e-mail'}; depois o Dr. André aprova e o Dr. Artur assina.${nota}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o contrato.')
    } finally {
      setEnviando(false)
    }
  }

  async function verSituacao() {
    setErro('')
    setConsultando(true)
    try {
      setSituacao(await situacaoDoContratoD4Sign(cliente.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ver a situação na D4Sign.')
    } finally {
      setConsultando(false)
    }
  }

  async function reenviarLink() {
    setErro('')
    setAviso('')
    setConsultando(true)
    try {
      await reenviarContratoD4Sign(cliente.id)
      setAviso('Link reenviado para a família.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui reenviar o link.')
    } finally {
      setConsultando(false)
    }
  }

  async function aoBaixar() {
    setErro('')
    setBaixando(true)
    try {
      await baixar(d, contrato.comParteFixa)
      if (!contrato.geradoEm) salvar({ geradoEm: new Date().toISOString(), status: contrato.okAdvogado ? 'pronto' : contrato.status })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o contrato.')
    } finally {
      setBaixando(false)
    }
  }

  const passos = [
    { nome: 'Dados completos', ok: faltam.length === 0 },
    { nome: 'OK do advogado', ok: contrato.okAdvogado },
    { nome: 'Enviado (D4Sign)', ok: contrato.status === 'enviado' || contrato.status === 'assinado' },
    { nome: 'Assinado', ok: contrato.status === 'assinado' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2">
        {passos.map((p, i) => (
          <div key={p.nome} className={`rounded-2xl border p-3 ${p.ok ? 'border-emerald-200 bg-emerald-50' : 'border-marinho-900/[0.07] bg-white'}`}>
            <p className={`text-[10px] font-extrabold uppercase tracking-wider ${p.ok ? 'text-emerald-600' : 'text-slate-400'}`}>Passo {i + 1}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-marinho-900">
              {p.ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {p.nome}
            </p>
          </div>
        ))}
      </div>

      <section className="cartao p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="rotulo text-ouro-600">Versão do contrato</p>
            <p className="titulo-serif text-xl">{contrato.comParteFixa ? 'Com valor fixo de R$ 1.000' : 'Padrão (3 salários + 30%)'}</p>
            <p className="mt-1 text-xs text-slate-500">
              Escolhida pela conversa: {sugerida ? 'o cliente não tem laudo e vai pela fase médica parceira.' : 'o cliente já tem laudo (ou é idoso).'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-marinho-800">
            Valor fixo
            <Interruptor ligado={contrato.comParteFixa} onChange={(v) => !travado && salvar({ comParteFixa: v })} rotulo="Contrato com valor fixo" />
          </label>
        </div>
        {contrato.comParteFixa !== sugerida && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
            <AlertTriangle className="h-4 w-4" /> Versão diferente da que a conversa indica. Confira com o advogado.
          </p>
        )}
      </section>

      <section className="cartao space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="titulo-serif text-xl">Quem contrata</p>
          <label className="flex items-center gap-2 text-xs font-bold text-marinho-800">
            Beneficiário menor de idade
            <Interruptor ligado={d.menor} onChange={(v) => !travado && salvar({ dados: { ...d, menor: v } })} rotulo="Menor de idade" />
          </label>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-marinho-50 px-3 py-2 text-[11px] text-marinho-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> O robô nunca pede documento. RG, CPF e endereço vêm dos documentos que a família manda para a equipe.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo={d.menor ? 'Nome completo da criança' : 'Nome completo'}>
            <input {...campo('nome')} placeholder="Como está no documento" />
          </Campo>
          <Campo rotulo="Documento" dica='Ex.: "RG n. 00.000.000-0 e CPF n. 000.000.000-00"'>
            <input {...campo('documento')} />
          </Campo>
          <Campo rotulo="Nacionalidade">
            <input {...campo('nacionalidade')} />
          </Campo>
          {d.menor ? (
            <Campo rotulo="Nascimento">
              <input {...campo('nascimento')} placeholder="dd/mm/aaaa" />
            </Campo>
          ) : (
            <>
              <Campo rotulo="Estado civil">
                <input {...campo('estadoCivil')} />
              </Campo>
              <Campo rotulo="Profissão">
                <input {...campo('profissao')} />
              </Campo>
            </>
          )}
        </div>
        {d.menor && (
          <div className="grid gap-3 rounded-2xl border border-ouro-200 bg-ouro-50/50 p-4 sm:grid-cols-2">
            <p className="rotulo text-ouro-700 sm:col-span-2">Representante legal (assina o contrato)</p>
            <Campo rotulo="Nome completo">
              <input {...campo('repNome')} />
            </Campo>
            <Campo rotulo="Parentesco">
              <select {...campo('repParentesco')}>
                <option value="genitora">genitora (mãe)</option>
                <option value="genitor">genitor (pai)</option>
                <option value="responsável legal">responsável legal</option>
              </select>
            </Campo>
            <Campo rotulo="Documento">
              <input {...campo('repDocumento')} />
            </Campo>
            <Campo rotulo="Nacionalidade">
              <input {...campo('repNacionalidade')} />
            </Campo>
            <Campo rotulo="Estado civil">
              <input {...campo('repEstadoCivil')} />
            </Campo>
            <Campo rotulo="Profissão">
              <input {...campo('repProfissao')} />
            </Campo>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Endereço completo">
            <input {...campo('endereco')} placeholder="Rua, número, bairro, cidade/UF" />
          </Campo>
          <Campo rotulo="E-mail (para o D4Sign)">
            <input {...campo('email')} type="email" />
          </Campo>
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-marinho-900/[0.08] bg-white shadow-cartao">
        <div className="flex items-center justify-between bg-marinho-900 px-5 py-3 text-white">
          <p className="flex items-center gap-2 text-xs font-bold">
            <FileSignature className="h-4 w-4 text-ouro-400" /> Prévia dos trechos que mudam
          </p>
          <span className="text-[10px] font-semibold text-white/50">o restante é a minuta do escritório</span>
        </div>
        <div className="space-y-4 p-6 font-serif text-[15px] [font-variant-numeric:lining-nums] leading-relaxed text-marinho-950 sm:px-10">
          <p className="text-center text-sm font-bold tracking-wide">INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</p>
          <p className="text-justify">
            {faltam.length ? <span className="rounded bg-ouro-100 px-1 text-ouro-700">[falta: {faltam.join(', ')}]</span> : <Trecho segmentos={segmentosParte(d)} />}
          </p>
          <p className="text-center text-slate-300">· · ·</p>
          <p className="text-justify">
            <Trecho segmentos={segmentosClausula2(contrato.comParteFixa)} />
          </p>
          <p className="text-center text-slate-300">· · ·</p>
          <p>Santos/SP, {dataPorExtenso(new Date())}.</p>
          <p className="pt-4 text-center">
            ____________________________________
            <br />
            {signatario(d) || 'CONTRATANTE'}
            <br />- CONTRATANTE -
          </p>
        </div>
      </section>

      <section className="cartao space-y-4 p-5">
        <label className={`flex items-start gap-3 rounded-2xl border p-4 ${contrato.okAdvogado ? 'border-emerald-200 bg-emerald-50' : 'border-marinho-900/10'}`}>
          <input
            type="checkbox"
            checked={contrato.okAdvogado}
            disabled={travado}
            onChange={(e) => salvar({ okAdvogado: e.target.checked, status: e.target.checked && faltam.length === 0 ? 'pronto' : 'rascunho' })}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-bold text-marinho-900">
              <BadgeCheck className="h-4 w-4 text-emerald-600" /> OK do advogado
            </span>
            <span className="text-xs text-slate-500">O Dr. André conversou com a família e liberou o contrato. Sem isto o envio para assinatura fica travado.</span>
          </span>
        </label>
        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{erro}</p>}
        {aviso && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{aviso}</p>}
        {confirmando && (
          <div className="space-y-3 rounded-2xl border border-marinho-900/10 bg-papel p-4">
            <p className="text-sm font-bold text-marinho-900">Enviar para assinatura pela D4Sign</p>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
              <li>
                <b>{signatario(d) || 'A família'}</b> assina pelo {contato}
              </li>
              <li>
                <b>Dr. André</b> aprova (e-mail)
              </li>
              <li>
                <b>Dr. Artur</b> assina pelo escritório (e-mail)
              </li>
            </ol>
            {cliente.telefone && (
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={avisarAntes} onChange={(e) => setAvisarAntes(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-marinho-800" />
                Avisar a família antes pelo nosso WhatsApp (a mensagem da D4Sign vem de um número dos EUA e pode parecer golpe)
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={aoEnviar} disabled={enviando} className="botao-primario">
                <Send className="h-4 w-4" /> {enviando ? 'Enviando...' : 'Confirmar envio'}
              </button>
              <button type="button" onClick={() => setConfirmando(false)} disabled={enviando} className="botao-claro">
                Voltar
              </button>
            </div>
          </div>
        )}
        {pelaD4Sign && contrato.status === 'enviado' && !demonstracao && (
          <div className="space-y-3 rounded-2xl border border-marinho-900/10 p-4">
            <div>
              <p className="text-sm font-bold text-marinho-900">Na D4Sign</p>
              <p className="text-[11px] leading-relaxed text-slate-500">A família assina, o Dr. André aprova e o Dr. Artur assina, nessa ordem. Quando todos terminarem, o contrato vira "Assinado" sozinho e o PDF aparece aqui.</p>
            </div>
            {situacao && (
              <ul className="space-y-1.5">
                {situacao.signatarios.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    {s.assinou ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                    <b className="text-marinho-900">{s.quem}</b>
                    <span className="text-slate-500">
                      {s.acao ? `${s.acao.toLowerCase()} · ` : ''}
                      {s.assinou ? 'feito' : 'aguardando'}
                    </span>
                  </li>
                ))}
                <li className="pt-1 text-[11px] text-slate-400">Situação na D4Sign: {situacao.situacao}</li>
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={verSituacao} disabled={consultando} className="botao-claro text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Ver situação
              </button>
              <button type="button" onClick={reenviarLink} disabled={consultando} className="botao-claro text-xs">
                <RotateCcw className="h-3.5 w-3.5" /> Reenviar link para a família
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {contrato.arquivo && (
            <button
              type="button"
              onClick={() => {
                // A aba abre no clique (senao o navegador bloqueia) e recebe o
                // link temporario quando ele chega.
                const aba = window.open('', '_blank')
                linkDoContratoAssinado(contrato.arquivo!)
                  .then((link) => {
                    if (aba) aba.location.href = link
                    else window.location.href = link
                  })
                  .catch((e: Error) => {
                    aba?.close()
                    setErro(e.message)
                  })
              }}
              className="botao-ouro"
            >
              <FileCheck2 className="h-4 w-4" /> Ver contrato assinado (PDF)
            </button>
          )}
          <button type="button" onClick={aoBaixar} disabled={faltam.length > 0 || baixando} className="botao-claro">
            <Download className="h-4 w-4" /> {baixando ? 'Gerando...' : 'Baixar contrato (.docx)'}
          </button>
          {contrato.status !== 'enviado' && contrato.status !== 'assinado' && !confirmando && (
            <button type="button" disabled={!contrato.okAdvogado || faltam.length > 0 || !contato} onClick={() => setConfirmando(true)} className="botao-primario">
              <Send className="h-4 w-4" /> Enviar para assinatura
            </button>
          )}
          {contrato.status === 'enviado' && (
            <button type="button" onClick={() => salvar({ status: 'assinado', assinadoEm: new Date().toISOString() })} className="botao-ouro">
              <CheckCircle2 className="h-4 w-4" /> Marcar como assinado
            </button>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          {contrato.enviadoEm && `Enviado em ${dataHora(contrato.enviadoEm)}. `}
          {contrato.assinadoEm && `Assinado em ${dataHora(contrato.assinadoEm)}. `}
          {!contato && contrato.status !== 'enviado' && contrato.status !== 'assinado' && 'Para enviar, cadastre o WhatsApp da família na ficha (ou o e-mail acima). '}
          O envio sai pela D4Sign: a família recebe o link pelo WhatsApp, depois o Dr. André aprova e o Dr. Artur assina. "Marcar como assinado" fica para os contratos enviados fora da Central.
        </p>
      </section>
    </div>
  )
}
