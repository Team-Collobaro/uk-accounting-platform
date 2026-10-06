import type { PublicQuizQuestion, QuizQuestion } from '@/types'

export const QUIZ_PASS_PERCENTAGE = 70
export const QUIZ_ATTEMPT_MINUTES = 45
export const MODULE_ID_PATTERN = /^m(?:0[1-9]|[1-7][0-9]|8[0-7])$/

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be text`)
  const text = value.trim()
  if (!text || text.length > maxLength) throw new Error(`${field} is invalid`)
  return text
}

/** Accept either an option label ("A") or a rendered option ("A. Cash"). */
export function normaliseQuizChoice(value: string): string {
  const text = value.trim().toUpperCase()
  const labelled = text.match(/^([A-Z])(?:[.)\s:\-]|$)/)
  return labelled?.[1] ?? text
}

export function validateGeneratedQuiz(
  value: unknown,
  expectedCount: number
): QuizQuestion[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`Quiz generator returned ${Array.isArray(value) ? value.length : 0} questions; expected ${expectedCount}`)
  }

  const ids = new Set<string>()
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`Question ${index + 1} is invalid`)
    }

    const candidate = raw as Record<string, unknown>
    const id = requireText(candidate.id, `Question ${index + 1} id`, 80)
    if (ids.has(id)) throw new Error(`Duplicate question id: ${id}`)
    ids.add(id)

    if (!Array.isArray(candidate.options) || candidate.options.length < 2 || candidate.options.length > 6) {
      throw new Error(`Question ${id} must have between 2 and 6 options`)
    }
    const options = candidate.options.map((option, optionIndex) =>
      requireText(option, `Question ${id} option ${optionIndex + 1}`, 500)
    )
    const correct = requireText(candidate.correct, `Question ${id} answer`, 500)
    const normalisedCorrect = normaliseQuizChoice(correct)
    if (!options.some((option) => normaliseQuizChoice(option) === normalisedCorrect)) {
      throw new Error(`Question ${id} answer does not match an option`)
    }

    return {
      id,
      question: requireText(candidate.question, `Question ${id} text`, 2000),
      options,
      correct,
      explanation: requireText(candidate.explanation, `Question ${id} explanation`, 4000),
      topic: requireText(candidate.topic, `Question ${id} topic`, 300),
    }
  })
}

export function publicQuizQuestions(questions: QuizQuestion[]): PublicQuizQuestion[] {
  return questions.map(({ id, question, options }) => ({ id, question, options }))
}

export function validateQuizAnswers(
  value: unknown,
  questions: QuizQuestion[]
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('answers must be an object')
  }

  const knownIds = new Set(questions.map((question) => question.id))
  const answers: Record<string, string> = {}
  for (const [questionId, answer] of Object.entries(value as Record<string, unknown>)) {
    if (!knownIds.has(questionId)) throw new Error(`Unknown question id: ${questionId}`)
    if (typeof answer !== 'string' || answer.length > 500) {
      throw new Error(`Answer for ${questionId} is invalid`)
    }
    answers[questionId] = answer
  }
  return answers
}
