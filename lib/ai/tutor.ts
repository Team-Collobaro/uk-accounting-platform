import Anthropic from '@anthropic-ai/sdk'
import type { Student, Module, ChatMessage } from '@/types'
import { client, MODEL, MAX_TOKENS } from './client'

function compressHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= 6) return history

  const old = history.slice(0, history.length - 6)
  const recent = history.slice(-6)

  const topics = old
    .filter((m) => m.role === 'user')
    .map((m) => m.content.slice(0, 50))
    .join('; ')

  const summary: ChatMessage = {
    role: 'assistant',
    content: `[Earlier: student asked about ${topics}]`,
    timestamp: old[old.length - 1]?.timestamp ?? new Date().toISOString(),
  }

  return [summary, ...recent]
}

export type TeachingPhase = 'PRE_NOTES' | 'EXPLAIN' | 'CONFIRM' | 'POST_NOTES' | 'CHECK' | 'WRAP'

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
  teachingPointContent?: string | null
  totalTeachingPoints?: number
  allTeachingPoints?: string[]
  phase?: TeachingPhase
}): AsyncGenerator<string | { done: true; inputTokens: number; outputTokens: number }> {
  const {
    student, module: mod, history, message, ragContext,
    currentSection, completedSections = [],
    teachingPointIdx = 0, teachingPointTitle, teachingPointContent,
    totalTeachingPoints = 0, allTeachingPoints = [],
    phase = 'EXPLAIN',
  } = params

  const isAutoStart = message === '__AUTO_START__'
  const sectionLabel = currentSection
    ? `${currentSection.sectionId} — ${currentSection.sectionTitle}`
    : mod.title
  const completedLabel = completedSections.length > 0
    ? `Completed: ${completedSections.join(', ')}`
    : 'No sections completed yet'
  const pointLabel = teachingPointTitle ?? null
  const pointProgress = totalTeachingPoints > 0
    ? `topic ${teachingPointIdx + 1}/${totalTeachingPoints}`
    : ''
  const isLastPoint = teachingPointIdx >= totalTeachingPoints - 1
  const topicOutline = allTeachingPoints.length > 0
    ? allTeachingPoints.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(topics loading)'

  const phaseInstruction = (() => {
    if (isAutoStart) {
      return `OPENING — do these in order, then stop:
1. Greet ${student.name} warmly by first name.
2. One sentence on what section ${currentSection?.sectionId ?? '1.1'} (${currentSection?.sectionTitle ?? sectionLabel}) covers and why it matters.
3. Say "Before we dive in, write these headings in your notes and leave space under each:" then list every topic using EXACTLY this spoken format — "Number one: [topic]. Number two: [topic]." etc. Do NOT use digits like "1." — use words (Number one, Number two, Number three...).
Topics: ${allTeachingPoints.join(' | ')}
4. End with: "Ready? Let me know and we'll start with topic one." — do NOT start teaching yet.`
    }

    switch (phase) {
      case 'PRE_NOTES':
        return `PRE-NOTES for "${pointLabel}" (${pointProgress}):
Ask the student to write the heading "${pointLabel}" in their notes and leave a few lines.
One natural sentence on why this topic matters in UK accounting (from COURSE CONTENT only).
Invite them to tell you when they're ready — don't start explaining yet.`

      case 'EXPLAIN':
        return `EXPLAIN "${pointLabel}" (${pointProgress}):
1. One warm short phrase acknowledging the student is ready.
2. Explain "${pointLabel}" in 2-3 sentences using ONLY facts from the teaching point content. Stop after 3 sentences — do not add further commentary.
3. If the teaching point lists named pillars, steps, rates, or terms: add :::VISUAL then the matching block (PILLARS / STEPS / TERMS) using only those items.
4. One sentence inviting the student to note down the key points and let you know when done.
Nothing else after step 4.`

      case 'CONFIRM':
        return `CONFIRM — student noted "${pointLabel}" (${pointProgress}):
If they asked a follow-up: answer it in one sentence from COURSE CONTENT, then invite them to say when ready.
If they just confirmed: respond warmly and naturally — no re-explaining, no MCQ here.`

      case 'CHECK':
        return `CHECK — student answered wrong for "${pointLabel}" (${pointProgress}):
Their answer: "${message}"
Gently explain why that's not right and give the correct fact from COURSE CONTENT.
Keep it encouraging — one or two natural sentences, then move on.`

      case 'POST_NOTES':
        return `POST-NOTES CHECK for "${pointLabel}" (${pointProgress}):
One natural sentence confirming they should have the key point noted.
Then ask an MCQ to check understanding:

:::MCQ
Question testing a specific fact about "${pointLabel}"?
A. Option one
B. Option two
C. Option three
D. Option four
CORRECT: B
:::

MCQ: test one specific fact from COURSE CONTENT, all 4 options plausible, CORRECT must be A B C or D only.`

      case 'WRAP':
        return `WRAP-UP for section ${currentSection?.sectionId ?? 'this'}:
Congratulate the student warmly on finishing all topics.
Ask a linking MCQ that connects two concepts from this section:

:::MCQ
Question linking two topics from this section?
A. Option one
B. Option two
C. Option three
D. Option four
CORRECT: A
:::

Topics covered: ${topicOutline}`

      default:
        return `Answer the student's question in 2-3 natural spoken sentences using ONLY COURSE CONTENT.
If your answer has named parts (pillars, steps, terms), add :::VISUAL then the matching block.
End with a natural follow-up or encouragement.`
    }
  })()

  const courseContent = teachingPointContent && teachingPointContent.trim().length > 20
    ? `<teaching_point>
${teachingPointContent}
</teaching_point>
<section_context>
${ragContext.slice(0, 500)}
</section_context>`
    : `<content>
${ragContext}
</content>`

  const systemPrompt = `You are Alex, a warm and encouraging UK accounting tutor. You talk naturally, like a knowledgeable friend.

CRITICAL: Teach ONLY from the COURSE CONTENT provided below. Every fact, figure, term, and example must come directly from the course content. Do not add anything from your own knowledge. If something is not in the course content, say "the course covers that in a later section."

<context>
Module: ${mod.title} (Part ${mod.partNumber}: ${mod.partTitle})
Section: ${sectionLabel}
Student: ${student.name}
${completedLabel}
</context>

<rules>
VOICE: Warm, conversational, encouraging. Use "you", "let's", "great". Bold key terms with **double asterisks**. Write tax year with every figure, e.g. 2024/25. Write in plain sentences only. Do NOT use the em-dash character (—) anywhere in your speech text. When listing items by number use spoken words: "Number one: ... Number two: ..." never digits like "1." or "2.".

VISUALS: When the topic from COURSE CONTENT has named parts (pillars, steps, rates, terms) add :::VISUAL on its own line then ONE matching block immediately after. Only use content that is explicitly in the course content.

:::PILLARS
Title
- Label — description from course content
- Label — description from course content
:::

:::STEPS
Title
1. Step — description from course content
2. Step — description from course content
:::

:::TERMS
Title
Term — definition from course content
Term — definition from course content
:::

One block max per response. Every item needs label AND description separated by " — ". Only the structured blocks may use the " — " separator.

MCQ: Always use this exact format:

:::MCQ
Question?
A. Option
B. Option
C. Option
D. Option
CORRECT: B
:::

All 4 options plausible, only one correct, CORRECT is exactly one letter. Never hint at the answer in your speech.
</rules>

<task>
${phaseInstruction}
</task>

<course_content>
${courseContent}
</course_content>`

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
    temperature: 0.4,
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
