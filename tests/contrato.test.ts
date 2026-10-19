// node tests/contrato.test.ts
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import JSZip from 'jszip'
import { dadosVazios, faltando, gerarContratoDocx, nomeDoArquivo } from '../src/lib/contrato.ts'

const modelo = readFileSync(new URL('../public/modelos/contrato_bpc_loas.docx', import.meta.url))

function texto(xml: string) {
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
}

const menor = {
  ...dadosVazios(),
  menor: true,
  nome: 'Pedro Exemplo Ficticio',
  documento: 'CPF n. 000.000.000-00',
  nascimento: '10/03/2019',
  endereco: 'Rua Exemplo, 100, Centro, Santos/SP',
  email: 'teste@exemplo.com',
  repNome: 'Ana Exemplo Ficticia',
  repEstadoCivil: 'solteira',
  repProfissao: 'do lar',
  repDocumento: 'RG n. 00.000.000-0 e CPF n. 111.111.111-11',
}

assert.deepEqual(faltando(dadosVazios()), ['nome do(a) beneficiário(a)', 'RG/CPF do(a) beneficiário(a)', 'endereço'])
assert.deepEqual(faltando(menor), [])

const data = new Date(2026, 9, 19)
for (const fixo of [false, true]) {
  const bytes = await gerarContratoDocx(modelo, menor, fixo, data)
  const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string')
  const t = texto(xml)
  assert.doesNotMatch(t, /\{\{/, 'sobrou marcador')
  assert.doesNotMatch(t, /Erro!/, 'sobrou o erro de referencia da minuta')
  assert.match(t, /PEDRO EXEMPLO FICTICIO, brasileiro\(a\), menor incapaz, nascido\(a\) em 10\/03\/2019/)
  assert.match(t, /representado\(a\) por sua genitora, ANA EXEMPLO FICTICIA/)
  assert.match(t, /Santos\/SP, 19 de outubro de 2026\./)
  assert.match(t, /na Cláusula 2ª supra/)
  assert.doesNotMatch(t, new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']'))
  if (fixo) {
    assert.match(t, /valor fixo de R\$ 1\.000,00 \(mil reais\)/)
    assert.doesNotMatch(t, /laudo|médico|repasse/i, 'valor fixo nunca ligado a laudo/medico/repasse')
  } else {
    assert.doesNotMatch(t, /1\.000,00/)
  }
  mkdirSync(new URL('../tmp/', import.meta.url), { recursive: true })
  writeFileSync(new URL(`../tmp/${nomeDoArquivo(menor, fixo, data)}`, import.meta.url), bytes)
}
assert.equal(nomeDoArquivo(menor, true, data), 'Contrato_BPC_LOAS_Pedro_Exemplo_Ficticio_com_valor_fixo_2026-10-19.docx')
console.log('contrato: 2 versões ok (exemplos em tmp/)')
