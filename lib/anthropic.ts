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

// Teaching phases that drive the structured loop
export type TeachingPhase = 'PRE_NOTES' | 'EXPLAIN' | 'CHECK' | 'POST_NOTES' | 'WRAP'

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
  allTeachingPoints?: string[]
  phase?: TeachingPhase
}): AsyncGenerator<string | { done: true; inputTokens: number; outputTokens: number }> {
  const {
    student, module: mod, history, message, ragContext,
    currentSection, completedSections = [],
    teachingPointIdx = 0, teachingPointTitle,
    totalTeachingPoints = 0, allTeachingPoints = [],
    phase = 'EXPLAIN',
  } = params

  const isAutoStart = message === '__AUTO_START__'
  const sectionLabel = currentSection ? `${currentSection.sectionId} — ${currentSection.sectionTitle}` : mod.title
  const completedLabel = completedSections.length > 0 ? `Completed so far: ${completedSections.join(', ')}` : 'No sections completed yet'
  const pointLabel = teachingPointTitle ?? null
  const pointProgress = totalTeachingPoints > 0 ? `topic ${teachingPointIdx + 1} of ${totalTeachingPoints}` : ''
  const isLastPoint = teachingPointIdx >= totalTeachingPoints - 1
  const topicOutline = allTeachingPoints.length > 0
    ? allTeachingPoints.map((t, i) => `  ${i + 1}. ${t}`).join('\n')
    : '  (topics loading)'

  // Phase-specific instruction blocks
  const phaseInstruction = (() => {
    if (isAutoStart) {
      return `OPENING — do ALL of the following in order, in plain spoken sentences:
1. Greet ${student.name} warmly by first name (one short sentence).
2. Say what section ${currentSection?.sectionId ?? '1.1'} (${currentSection?.sectionTitle ?? sectionLabel}) covers and why it matters (one sentence).
3. Say: "Before we dive in, I'd like you to write these headings in your notes." Then read out each topic title from the list below, numbering them clearly (e.g. "Number one: [topic]. Number two: [topic]..."). Tell the student to leave space under each to fill in as we go.
4. After reading the outline say: "Ready? Let's start with topic one." Then teach the FIRST topic "${pointLabel ?? 'the opening concept'}" in exactly 2 plain sentences using ONLY COURSE CONTENT facts.
5. End with ONE clear question about that first topic only.

Topics the student should write down:
${topicOutline}`
    }

    switch (phase) {
      case 'PRE_NOTES':
        return `PRE-TOPIC NOTES PROMPT for topic "${pointLabel}" (${pointProgress}):
- Say: "Before I explain this next topic, write the heading '${pointLabel}' in your notes and leave a few lines underneath."
- Add one sentence about WHY this topic is important (from COURSE CONTENT only).
- End with: "Ready? Tell me when you've written it and I'll explain." — do NOT start explaining yet.
- Maximum 3 sentences total.`

      case 'EXPLAIN':
        return `EXPLAIN phase — teaching "${pointLabel}" (${pointProgress}):
- Confirm the student is ready (one warm sentence acknowledging their note-taking).
- Explain "${pointLabel}" in exactly 2-3 plain spoken sentences using ONLY COURSE CONTENT facts.
- Say: "Now add those key points under your heading in your notes." (one sentence nudge).
- End with ONE specific check question about "${pointLabel}" only — do NOT ask about other topics.
- Maximum 5 sentences total.`

      case 'CHECK':
        return `CHECK phase — checking understanding of "${pointLabel}" (${pointProgress}):
- Read the student's answer and respond in ONE sentence: affirm warmly if correct, or gently correct if wrong.
- If CORRECT: say "Great — note that down!" then say "Let's move on to the next topic." (use exactly this phrase so the system can detect it). Do NOT explain the next topic yet.
- If INCORRECT: give ONE warm hint, re-ask the SAME question — do NOT move on.
- Maximum 3 sentences total.`

      case 'POST_NOTES':
        return `POST-TOPIC NOTES phase after "${pointLabel}" (${pointProgress}):
- Confirm what the student should now have written under the "${pointLabel}" heading.
- Give them ONE crisp bullet-point summary sentence they can copy: "The key point is: [fact from COURSE CONTENT]."
- ${isLastPoint
    ? `This was the LAST topic. Say "You've now covered all the topics in this section! Click 'Section Complete' when you're happy with your notes."`
    : `Transition: "The next topic is '${allTeachingPoints[teachingPointIdx + 1] ?? 'the next point'}'. Write that heading now and leave some space."  End with "Ready when you are!"`}
- Maximum 4 sentences total.`

      case 'WRAP':
        return `WRAP-UP for section ${currentSection?.sectionId ?? 'this'}:
- Ask ONE connecting question that links two topics from the outline below.
- If correct: affirm and say "You've covered section ${currentSection?.sectionId ?? 'this'} really well! Click 'Section Complete' when you're ready."
- If incorrect: give a warm hint and re-ask.
- Maximum 3 sentences total.
Topics covered: ${topicOutline}`

      default:
        return `Respond naturally to the student's message in 2-3 warm spoken sentences using ONLY COURSE CONTENT facts.`
    }
  })()

  const systemPrompt = `You are Alex, a warm and encouraging UK accounting tutor speaking out loud to a student.

Module: ${mod.title} (Part ${mod.partNumber}: ${mod.partTitle})
Current section: ${sectionLabel}
${completedLabel}
Student: ${student.name} | ${student.completedModules.length}/87 modules done | avg score ${student.avgQuizScore}%

VOICE & TONE:
- Warm, conversational, encouraging — like a human tutor not a textbook
- Use "you", "let's", "great" naturally
- Short sentences that sound natural spoken aloud
- NEVER use markdown: no #, *, **, -, bullet points — plain spoken sentences only
- Only use facts from COURSE CONTENT — never invent figures or rules
- Always state the tax year for any figure, e.g. 2024/25

${phaseInstruction}

COURSE CONTENT for "${pointLabel ?? sectionLabel}":
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
