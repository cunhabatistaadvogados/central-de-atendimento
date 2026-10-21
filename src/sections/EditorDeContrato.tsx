import { AlertTriangle, BadgeCheck, CheckCircle2, Download, FileCheck2, FileSignature, Info, Send } from 'lucide-react'
import { useState } from 'react'
import { Campo, Interruptor } from '@/components/ui'
import { rascunhoDoContrato } from '@/lib/atendimento'
import { dataPorExtenso, faltando, gerarContratoDocx, nomeDoArquivo, segmentosClausula2, segmentosParte, signatario, type Segmento } from '@/lib/contrato'
import { dataHora } from '@/lib/formato'
import { linkDoContratoAssinado } from '@/lib/repositorio'
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

async function baixar(dados: DadosContrato, comParteFixa: boolean) {
  const resp = await fetch(`${import.meta.env.BASE_URL}modelos/contrato_bpc_loas.docx`)
  if (!resp.ok) throw new Error('Não encontrei a minuta do contrato no sistema.')
  const bytes = await gerarContratoDocx(await resp.arrayBuffer(), dados, comParteFixa)
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeDoArquivo(dados, comParteFixa)
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export default function EditorDeContrato({ cliente }: { cliente: Cliente }) {
  const { salvarContrato } = useDados()
  const contrato: Contrato = cliente.contrato ?? rascunhoDoContrato(cliente)
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState('')
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
              Escolhida pela conversa: {sugerida ? 'o cliente não tem laudo recente, vai pela fase médica parceira.' : 'o cliente já tem laudo (ou é idoso).'}
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
          {contrato.status !== 'enviado' && contrato.status !== 'assinado' && (
            <button type="button" disabled={!contrato.okAdvogado || faltam.length > 0} onClick={() => salvar({ status: 'enviado', enviadoEm: new Date().toISOString(), geradoEm: contrato.geradoEm ?? new Date().toISOString() })} className="botao-primario">
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
          O envio pelo D4Sign entra automático quando o plano com API for contratado; até lá, o botão registra o envio e a equipe manda o arquivo pelo próprio D4Sign.
        </p>
      </section>
    </div>
  )
}
