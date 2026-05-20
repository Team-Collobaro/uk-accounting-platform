import Anthropic from '@anthropic-ai/sdk'
import type { Student, Module, ChatMessage, QuizQuestion, QuizResult, ProgressAnalysis } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '220', 10)

// ─── History compression ──────────────────────────────────────────────────────

function compressHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= 6) return history

  const old = history.slice(0, history.length - 6)
  const recent = history.slice(-6)

  const topics = old
    .filter((m) => m.role === 'user')
    .map((m) => m.content.slice(0, 60))
    .join('; ')

  const summary: ChatMessage = {
    role: 'assistant',
    content: `Earlier in this session: student asked about ${topics}. Key points were covered.`,
    timestamp: old[old.length - 1]?.timestamp ?? new Date().toISOString(),
  }

  return [summary, ...recent]
}

// ─── Streaming tutor ──────────────────────────────────────────────────────────

export async function* tutorStream(params: {
  student: Student
  module: Module
  history: ChatMessage[]
  message: string
  ragContext: string
  currentSection?: { sectionId: string; sectionTitle: string; sectionOrder: number }
  completedSections?: string[]
  teachingPointIdx?: number
  teachingPointTitle?: string | null
  totalTeachingPoints?: number
}): AsyncGenerator<string | { done: true; inputTokens: number; outputTokens: number }> {
  const { student, module: mod, history, message, ragContext, currentSection, completedSections = [], teachingPointIdx = 0, teachingPointTitle, totalTeachingPoints = 0 } = params

  const isAutoStart = message === '__AUTO_START__'
  const exchangeCount = Math.floor(history.length / 2)
  const isTeachingPhase = exchangeCount < 4
  const sectionLabel = currentSection ? `${currentSection.sectionId} — ${currentSection.sectionTitle}` : mod.title
  const completedLabel = completedSections.length > 0 ? `Completed so far: ${completedSections.join(', ')}` : 'No sections completed yet'
  const pointLabel = teachingPointTitle ?? null
  const pointProgress = totalTeachingPoints > 0 ? `Teaching point ${teachingPointIdx + 1} of ${totalTeachingPoints}` : ''

  const systemPrompt = `You are Alex, a warm and encouraging UK accounting tutor speaking out loud to a student.

Module: ${mod.title} (Part ${mod.partNumber}: ${mod.partTitle})
Current section: ${sectionLabel}
${completedLabel}
Student: ${student.name} | ${student.completedModules.length}/87 modules done | avg score ${student.avgQuizScore}%

VOICE & TONE:
- Warm, conversational, encouraging — like a human tutor, not a textbook
- Use "you", "let's", "great question" naturally
- Short sentences that sound natural spoken aloud
- NEVER use markdown: no #, *, **, -, bullet points — plain spoken sentences only
- Max 2-3 sentences per reply, NEVER more — keep it brief and focused
- Only use facts from COURSE CONTENT below — never invent figures or rules
- Always state the tax year for any figure, e.g. 2024/25
- If the student is wrong, gently correct in one warm sentence then continue

TOPIC-BY-TOPIC TEACHING METHOD — follow this strictly:
${pointLabel ? `- You are currently teaching: "${pointLabel}" (${pointProgress})` : '- Begin with the first topic from COURSE CONTENT'}
- Teach ONLY this one topic this reply. Do not mention other topics yet.
- Say the topic title naturally in your opening sentence, e.g. "So let's talk about ${pointLabel ?? 'this first idea'}..."
- Explain the topic in 2-3 warm, spoken sentences using ONLY facts from COURSE CONTENT
- End with ONE specific question about ONLY this topic
- When the student answers correctly, say "Great, let's move on to the next point" to signal you are done with this topic
- If answered poorly: give one gentle hint and ask again — do NOT move on yet
- Never skip ahead or teach multiple topics in one reply

${isAutoStart ? `OPENING — do all of these in order:
1. Greet ${student.name} warmly by first name (one sentence)
2. One sentence: what section ${currentSection?.sectionId ?? '1.1'} is about and why it matters
3. Say "Let's start with..." then teach the FIRST topic: "${pointLabel ?? 'the opening concept'}" — 2 sentences, then one question` :

isTeachingPhase ? `CURRENT EXCHANGE (${exchangeCount + 1}):
- Respond to the student's answer (affirm warmly or correct gently) in ONE sentence
- If they answered well: say "Great, let's move on to the next point." then teach the next topic from COURSE CONTENT
- If they answered poorly: give a warm hint and re-ask the SAME topic — don't advance` :

`WRAP-UP (exchange ${exchangeCount + 1}):
- Ask a connecting question that ties two topics from this section together
- If correct: affirm and say "You've covered section ${currentSection?.sectionId ?? 'this'} really well! Click 'Section Complete' when you're ready."
- If incorrect: give a warm hint and re-ask`}

COURSE CONTENT for "${pointLabel ?? sectionLabel}" — use ONLY these facts, teach the current topic first:
${ragContext}`

  const compressed = compressHistory(history)
  const messages: Anthropic.MessageParam[] = [
    ...compressed.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: isAutoStart ? 'Please begin the lesson.' : message },
  ]

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
    system: systemPrompt,
    messages,
  })

  let inputTokens = 0
  let outputTokens = 0

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }

    if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens
    }

    if (event.type === 'message_start' && event.message.usage) {
      inputTokens = event.message.usage.input_tokens
    }
  }

  yield { done: true, inputTokens, outputTokens }
}

// ─── Quiz generation ──────────────────────────────────────────────────────────

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

// ─── Progress analysis ────────────────────────────────────────────────────────

export async function analyseProgress(params: {
  student: Student
  recentResults: QuizResult[]
  completedModules: string[]
}): Promise<ProgressAnalysis> {
  const { student, recentResults, completedModules } = params

  const prompt = `You are a learning progress analyst for a UK accounting course with 87 modules.
Analyse this student's performance and recommend next steps.

Student: ${student.name}
Completed modules: ${completedModules.length} of 87 (${Math.round((completedModules.length / 87) * 100)}%)
Average quiz score: ${student.avgQuizScore}%
Known weak topics: ${student.weakTopics.join(', ') || 'none'}

Recent quiz results (last ${recentResults.length}):
${recentResults
  .map(
    (r) =>
      `- Module ${r.moduleId}: ${r.percentage}% (${r.passed ? 'passed' : 'failed'}), weak areas: ${r.weakAreas.join(', ') || 'none'}`
  )
  .join('\n')}

Return ONLY valid JSON with no markdown:
{
  "recommendation": "proceed OR review OR exam",
  "reason": "brief explanation",
  "suggestedModule": "module id if review needed or null",
  "weakTopics": ["topic1", "topic2"],
  "overallProgress": percentage as number
}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as ProgressAnalysis
  } catch {
    return {
      recommendation: 'proceed',
      reason: 'Unable to analyse at this time.',
      weakTopics: student.weakTopics,
      overallProgress: Math.round((completedModules.length / 87) * 100),
    }
  }
}
