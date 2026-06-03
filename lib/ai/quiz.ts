import type { Module, QuizQuestion } from '@/types'
import { client, MODEL } from './client'

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

COURSE CONTENT:
${ragContext}

Return ONLY a valid JSON array with no markdown, no preamble, no explanation:
[
  {
    "id": "q1",
    "question": "question text here",
    "options": ["A. option", "B. option", "C. option", "D. option"],
    "correct": "A",
    "explanation": "why A is correct and others are wrong",
    "topic": "specific topic this tests"
  }
]`

  async function attempt(strictMode: boolean): Promise<QuizQuestion[]> {
    const extra = strictMode
      ? '\n\nCRITICAL: Output ONLY the raw JSON array. No text before or after. No markdown code fences.'
      : ''

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt + extra }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''

    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned) as QuizQuestion[]
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')
    return parsed
  }

  try {
    return await attempt(false)
  } catch {
    return await attempt(true)
  }
}
