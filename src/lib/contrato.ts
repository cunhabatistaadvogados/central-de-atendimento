/**
 * Contrato de honorarios BPC/LOAS gerado no navegador, a partir da minuta do
 * escritorio (public/modelos/contrato_bpc_loas.docx, a mesma do CRM do Lucas,
 * sem dado de cliente). Marcadores, um por paragrafo:
 *   {{PARTE_CONTRATANTE}} {{CLAUSULA_2}} {{CIDADE_DATA}} {{SIGNATARIO_NOME}}
 *
 * Regras do escritorio (08/10/2026), que nao se mexem sem o Lucas:
 * - Valor fixo de R$ 1.000 so quando o cliente NAO tem laudo proprio. O
 *   contrato nunca liga o valor fixo a laudo, medico ou repasse.
 * - Parcelamento em ate 6 vezes faz parte da redacao padrao.
 *
 * Sem import de '@/': os testes rodam este arquivo direto no Node.
 */
import JSZip from 'jszip'
import type { DadosContrato } from './tipos'

/** Meia-risca e travessao, por codigo: o escritorio nao usa nenhum dos dois. */
const TRACOS = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']', 'g')

export type Segmento = [texto: string, negrito: boolean]

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const MARCADORES = ['{{PARTE_CONTRATANTE}}', '{{CLAUSULA_2}}', '{{CIDADE_DATA}}', '{{SIGNATARIO_NOME}}'] as const

export function dadosVazios(): DadosContrato {
  return {
    menor: false,
    nome: '',
    nacionalidade: 'brasileiro(a)',
    estadoCivil: '',
    profissao: '',
    documento: '',
    nascimento: '',
    endereco: '',
    email: '',
    repNome: '',
    repNacionalidade: 'brasileira',
    repEstadoCivil: '',
    repProfissao: '',
    repDocumento: '',
    repParentesco: 'genitora',
  }
}

export function faltando(d: DadosContrato): string[] {
  const nomes: Record<string, string> = {
    nome: 'nome do(a) beneficiário(a)',
    documento: 'RG/CPF do(a) beneficiário(a)',
    endereco: 'endereço',
    repNome: 'nome do(a) responsável',
    repDocumento: 'RG/CPF do(a) responsável',
  }
  const campos = ['nome', 'documento', 'endereco', ...(d.menor ? ['repNome', 'repDocumento'] : [])] as const
  return campos.filter((c) => !String(d[c as keyof DadosContrato] ?? '').trim()).map((c) => nomes[c])
}

function virgulas(...partes: string[]): string {
  return partes.map((p) => p.trim()).filter(Boolean).join(', ')
}

export function segmentosParte(d: DadosContrato): Segmento[] {
  const seg: Segmento[] = [[d.nome.toUpperCase(), true]]
  if (d.menor) {
    const qual = virgulas(d.nacionalidade, 'menor incapaz', d.nascimento ? `nascido(a) em ${d.nascimento}` : '', `portador(a) do ${d.documento}`)
    seg.push([`, ${qual}, neste ato representado(a) por sua ${d.repParentesco}, `, false])
    seg.push([d.repNome.toUpperCase(), true])
    seg.push([`, ${virgulas(d.repNacionalidade, d.repEstadoCivil, d.repProfissao, `portador(a) do ${d.repDocumento}`)}, `, false])
  } else {
    seg.push([`, ${virgulas(d.nacionalidade, d.estadoCivil, d.profissao, `portador(a) do ${d.documento}`)}, `, false])
  }
  let fim = `residente e domiciliado(a) na ${d.endereco}`
  if (d.email.trim()) fim += `, endereço eletrônico: ${d.email.trim()}`
  seg.push([`${fim}, doravante denominado(a) `, false])
  seg.push(['CONTRATANTE', true])
  seg.push(['; e,', false])
  return seg
}

/** Clausula de honorarios. A redacao SEM valor fixo e a do contrato padrao do escritorio. */
export function segmentosClausula2(comParteFixa: boolean): Segmento[] {
  const seg: Segmento[] = [
    ['Cláusula 2ª) ', true],
    ['Em remuneração aos serviços ', false],
    ['CONTRATADOS', true],
    [', a ', false],
    ['CONTRATANTE', true],
    [' pagará ao ', false],
    ['CONTRATADO', true],
  ]
  if (comParteFixa) seg.push([' o valor fixo de ', false], ['R$ 1.000,00 (mil reais)', true], [', além do valor equivalente a ', false])
  else seg.push([' o valor equivalente ', false])
  seg.push(
    ['03 (três) salários-mínimos', true],
    [' e ou benefícios do segurado/CONTRATANTE, podendo ser pago de modo fracionado em até ', false],
    ['06 (seis) parcelas mensais', true],
    [', iguais e consecutivas, vencendo-se a primeira', false],
  )
  if (comParteFixa) seg.push([', bem como o valor fixo,', false])
  seg.push(
    [' quando da concessão e recebimento efetivo do benefício, além do percentual de ', false],
    ['30% de valores eventualmente tidos por “atrasados”', true],
    [
      ', caso a título de êxito na demanda, caso a ação venha a ser julgada procedente, total ou parcialmente, tanto na esfera judicial quanto no administrativo.',
      false,
    ],
  )
  return seg
}

export function dataPorExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

export function signatario(d: DadosContrato): string {
  return (d.menor ? d.repNome : d.nome).toUpperCase()
}

export function nomeDoArquivo(d: DadosContrato, comParteFixa: boolean, data = new Date()): string {
  const base = d.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'contratante'
  const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  return `Contrato_BPC_LOAS_${base}_${comParteFixa ? 'com_valor_fixo' : 'padrao'}_${iso}.docx`
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

function escaparXml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function run([texto, negrito]: Segmento): string {
  return `<w:r><w:rPr>${negrito ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`
}

function textoDoParagrafo(xml: string): string {
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
}

/**
 * Troca cada paragrafo-marcador pelos segmentos, mantendo a formatacao do
 * paragrafo (recuo, espacamento, numeracao). Devolve o XML e os marcadores
 * achados, para recusar um modelo trocado sem os marcadores.
 */
export function preencherXml(xml: string, trocas: Record<string, Segmento[]>): { xml: string; achados: string[] } {
  const achados: string[] = []
  let saida = xml.replace(/<w:p(?: [^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g, (paragrafo) => {
    const texto = textoDoParagrafo(paragrafo).trim()
    const segmentos = trocas[texto]
    if (!segmentos) return paragrafo
    achados.push(texto)
    const abertura = paragrafo.match(/^<w:p(?: [^>]*)?>/)![0]
    const pPr = paragrafo.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    return `${abertura}${pPr}${segmentos.map(run).join('')}</w:p>`
  })

  // A minuta veio com uma referencia cruzada quebrada na Clausula 3a ("Erro!
  // Fonte de referencia nao encontrada."). Ela aponta para a clausula de
  // honorarios: troca pelo texto certo em vez de mandar o erro ao cliente.
  saida = saida.replace(
    /<w:r>(?:(?!<w:r>)[\s\S])*?<w:t[^>]*>Erro!<\/w:t><\/w:r>[\s\S]*?encontrad[ao]\.?<\/w:t><\/w:r>/,
    run(['Cláusula 2ª', true]),
  )
  // Preferencia do escritorio para textos gerados: sem travessao nem meia-risca.
  // O caractere fica sozinho num <w:t>, entre espacos de outros runs.
  saida = saida.replace(TRACOS, '-')
  return { xml: saida, achados }
}

export async function gerarContratoDocx(modelo: ArrayBuffer | Uint8Array, d: DadosContrato, comParteFixa: boolean, data = new Date()) {
  const zip = await JSZip.loadAsync(modelo)
  const arquivo = zip.file('word/document.xml')
  if (!arquivo) throw new Error('O modelo de contrato não é um .docx válido.')
  const xml = await arquivo.async('string')
  const { xml: novo, achados } = preencherXml(xml, {
    '{{PARTE_CONTRATANTE}}': segmentosParte(d),
    '{{CLAUSULA_2}}': segmentosClausula2(comParteFixa),
    '{{CIDADE_DATA}}': [[`Santos/SP, ${dataPorExtenso(data)}.`, false]],
    '{{SIGNATARIO_NOME}}': [[signatario(d), false]],
  })
  const faltam = MARCADORES.filter((m) => !achados.includes(m))
  if (faltam.length) throw new Error(`O modelo de contrato está sem os marcadores ${faltam.join(', ')}.`)
  zip.file('word/document.xml', novo)
  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
