// Textos personalizados da equipe (pedido do Edu, 23/10/2026): textos de
// copiar e colar que qualquer pessoa da equipe cria e todos usam na conversa.
// Na demonstracao ficam no navegador; de verdade, na tabela textos_personalizados.
import { useCallback, useEffect, useState } from 'react'
import { apagarTextoPersonalizado, carregarTextosPersonalizados, salvarTextoPersonalizado, type TextoPersonalizado } from './repositorio'

export type { TextoPersonalizado }

const CHAVE_DEMO = 'cbaa-textos-personalizados-demo'

const EXEMPLO_DEMO: TextoPersonalizado[] = [
  {
    id: 'demo-apresentacao',
    titulo: 'Apresentação do Dr. André',
    texto: 'Bom dia! Tudo bem?\n\nSou o Dr. André, do escritório Cunha, Batista & Advogados Associados. Recebemos seu contato sobre o BPC/LOAS e ficamos felizes em ajudar!\n\nQual o melhor horário para eu te ligar e explicar como funciona?',
    autor: 'Equipe CB&AA',
    em: new Date().toISOString(),
  },
]

function lerDemo(): TextoPersonalizado[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE_DEMO) ?? 'null')
    return Array.isArray(guardado) ? guardado : EXEMPLO_DEMO
  } catch {
    // armazenamento bloqueado: fica o exemplo
    return EXEMPLO_DEMO
  }
}

function gravarDemo(lista: TextoPersonalizado[]) {
  try {
    localStorage.setItem(CHAVE_DEMO, JSON.stringify(lista))
  } catch {
    // sem armazenamento a demonstracao segue, so nao guarda
  }
}

const porTitulo = (a: TextoPersonalizado, b: TextoPersonalizado) => a.titulo.localeCompare(b.titulo, 'pt-BR')

export function useTextosPersonalizados(demonstracao: boolean, autor: string) {
  const [textos, setTextos] = useState<TextoPersonalizado[]>([])
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (demonstracao) return setTextos(lerDemo().sort(porTitulo))
    try {
      setTextos(await carregarTextosPersonalizados())
      setErro('')
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [demonstracao])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const salvar = useCallback(
    async (t: { id?: string; titulo: string; texto: string }) => {
      const titulo = t.titulo.trim().slice(0, 60)
      const texto = t.texto.trim()
      if (!titulo || !texto) throw new Error('Preencha o título e o texto.')
      if (demonstracao) {
        const em = new Date().toISOString()
        const atual = lerDemo()
        const nova = t.id ? atual.map((x) => (x.id === t.id ? { ...x, titulo, texto, autor, em } : x)) : [...atual, { id: crypto.randomUUID(), titulo, texto, autor, em }]
        gravarDemo(nova)
      } else await salvarTextoPersonalizado({ id: t.id, titulo, texto }, autor)
      await recarregar()
    },
    [demonstracao, autor, recarregar],
  )

  const apagar = useCallback(
    async (id: string) => {
      if (demonstracao) gravarDemo(lerDemo().filter((x) => x.id !== id))
      else await apagarTextoPersonalizado(id)
      await recarregar()
    },
    [demonstracao, recarregar],
  )

  return { textos, erro, recarregar, salvar, apagar }
}
