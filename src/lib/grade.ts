// Grade de horarios do robo (tela Agenda > Horarios do robo), para quem so
// precisa ler: a ficha usa para sugerir os proximos horarios livres.
import { GRADE_PADRAO, type GradeDaAgenda } from '@motor/robo'
import { useEffect, useState } from 'react'
import { carregarGrade } from './repositorio'

/** Onde a demonstracao guarda a grade (a tela Horarios do robo grava aqui). */
export const CHAVE_GRADE_DEMO = 'cbaa-grade-demo'

export function useGradeDaAgenda(demonstracao: boolean): GradeDaAgenda {
  const [grade, setGrade] = useState<GradeDaAgenda>(GRADE_PADRAO)
  useEffect(() => {
    if (demonstracao) {
      try {
        const g = JSON.parse(localStorage.getItem(CHAVE_GRADE_DEMO) ?? 'null')
        if (g) setGrade(g)
      } catch {
        // armazenamento bloqueado: fica a grade padrao
      }
      return
    }
    // Sem grade salva ou sem acesso, a ficha sugere pela grade padrao.
    carregarGrade()
      .then((g) => g && setGrade(g))
      .catch(() => {})
  }, [demonstracao])
  return grade
}
