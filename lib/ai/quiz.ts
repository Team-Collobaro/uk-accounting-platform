import type { Module, QuizQuestion } from '@/types'
import { client, MODEL } from './client'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const stripPrefix = (s: string) => s.replace(/^\s*[A-Za-z][.)]\s*/, '').trim()

// Move a question's correct answer to `targetIdx`, shuffle the distractors
// across the remaining slots, and re-letter everything. Each option keeps its
// "A. "-style prefix (the UI derives the answer letter from that prefix).
function placeCorrectAt(q: QuizQuestion, targetIdx: number): QuizQuestion {
  if (!Array.isArray(q.options) || q.options.length < 2) return q

  const correctLetter = (q.correct ?? '').trim().toUpperCase()
  const correctIndex = q.options.findIndex(
    (o) => o.trim().charAt(0).toUpperCase() === correctLetter,
  )
  const bare = q.options.map(stripPrefix)
  if (correctIndex < 0) {
    // Can't locate the correct option — fall back to a plain shuffle.
    const shuffled = fisherYates(bare)
    return {
      ...q,
      options: shuffled.map((t, i) => `${LETTERS[i]}. ${t}`),
      correct: q.correct,
    }
  }

  const target = Math.min(Math.max(targetIdx, 0), bare.length - 1)
  const correctText = bare[correctIndex]
  const distractors = fisherYates(bare.filter((_, i) => i !== correctIndex))

  const ordered: string[] = []
  let di = 0
  for (let i = 0; i < bare.length; i++) {
    ordered.push(i === target ? correctText : distractors[di++])
  }

  return {
    ...q,
    options: ordered.map((t, i) => `${LETTERS[i]}. ${t}`),
    correct: LETTERS[target],
  }
}

// The model has a strong bias toward placing the correct answer at the same
// position every question (usually A or B). Rather than shuffle each question
// independently — which can still cluster on a small set — assign correct-answer
// positions that are spread as evenly as possible across the whole quiz, then
// shuffle that assignment so the pattern isn't predictable.
function balanceCorrectPositions(questions: QuizQuestion[]): QuizQuestion[] {
  const optionCount = questions[0]?.options?.length ?? 4
  const targets = fisherYates(questions.map((_, i) => i % optionCount))
  return questions.map((q, i) => placeCorrectAt(q, targets[i]))
}

export async function generateQuiz(params: {
  module: Module
  ragContext: string
  count?: number
}): Promise<QuizQuestion[]> {
  const { module: mod, ragContext, count = 5 } = params

  const prompt = `You are a UK accounting examiner creating multiple choice questions for: ${mod.title}
Generate exactly ${count} MCQ questions based ONLY on the provided content.
Each question must test practical understanding not just memorisation.
Mix difficulty: 40% straightforward, 40% application, 20% analysis.
In "explanation", describe why the right answer is correct and why the others are wrong BY THEIR CONTENT — never refer to options by their letter (e.g. don't write "Option A" or "C and D"), because the options get reordered before display.

COURSE CONTENT:
${ragContext}

Return ONLY a valid JSON array with no markdown, no preamble, no explanation:
[
  {
    "id": "q1",
    "question": "question text here",
    "options": ["A. option", "B. option", "C. option", "D. option"],
    "correct": "A",
    "explanation": "why the correct answer is right and the others are wrong, referring to them by content not letter",
    "topic": "specific topic this tests"
  }
]`

  async function attempt(strictMode: boolean): Promise<QuizQuestion[]> {
    const extra = strictMode
      ? '\n\nCRITICAL: Output ONLY the raw JSON array. No text before or after. No markdown code fences.'
      : ''

    const response = await client.messages.create({
      model: MODEL,
      // Each MCQ (question + 4 options + explanation) runs ~250–350 tokens, so
      // scale the budget to the requested count or the JSON gets truncated.
      max_tokens: Math.max(2000, count * 400),
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt + extra }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''

    // Pull out just the JSON array — tolerant of markdown fences or any
    // stray preamble/trailing text the model might add.
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    const cleaned =
      start !== -1 && end > start
        ? raw.slice(start, end + 1)
        : raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim()

    const parsed = JSON.parse(cleaned) as QuizQuestion[]
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    return parsed
  }

  let questions: QuizQuestion[]
  try {
    questions = await attempt(false)
  } catch {
    questions = await attempt(true)
  }
  return balanceCorrectPositions(questions)
}
