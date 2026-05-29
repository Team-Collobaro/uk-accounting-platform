import Anthropic from '@anthropic-ai/sdk'
import type { Student, Module, ChatMessage, QuizQuestion, QuizResult, ProgressAnalysis } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '380', 10)

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
4. After reading the outline say: "Ready? Let's start with topic one." Then teach the FIRST topic "${pointLabel ?? 'the opening concept'}" in exactly 2 plain sentences using ONLY COURSE CONTENT facts. If that topic has named pillars, steps, or categories, add a PILLARS or STEPS or TERMS block.
5. End with a multiple-choice check question about that first topic using this EXACT format:

:::MCQ
Question about the first topic?
A. Option one
B. Option two
C. Option three
D. Option four
CORRECT: C
:::

Topics the student should write down:
${topicOutline}`
    }

    switch (phase) {
      case 'PRE_NOTES':
        return `PRE-TOPIC NOTES PROMPT for topic "${pointLabel}" (${pointProgress}):
- Say: "Before I explain this next topic, write the heading '${pointLabel}' in your notes and leave a few lines underneath."
- Add one sentence about WHY this topic matters in UK accounting practice (from COURSE CONTENT only).
- End with: "Ready? Tell me when you've written it and I'll explain." — do NOT start explaining yet.
- If "${pointLabel}" has a clear definition or relates to a key concept, add a :::TERMS block showing the term and its brief meaning so the student can write it down.
- Maximum 3 speech sentences total.`

      case 'EXPLAIN':
        return `EXPLAIN phase — teaching "${pointLabel}" (${pointProgress}):
- Confirm the student is ready (one warm sentence acknowledging their note-taking).
- Explain "${pointLabel}" in exactly 2-3 plain spoken sentences using ONLY COURSE CONTENT facts.
- If the topic has named pillars, steps, categories, rates, or rules: add :::VISUAL on its own line, then the matching :::PILLARS / :::STEPS / :::TERMS block immediately after.
- End with EXACTLY this sentence: "Take a moment to add those key points to your notes, then let me know when you're ready."
- Do NOT ask any question here. Maximum 4 speech sentences total.`

      case 'CONFIRM':
        return `CONFIRM phase — student has updated notes for "${pointLabel}" (${pointProgress}):
The student just replied to say they've noted it down (or asked a follow-up question).
- If they asked a follow-up question: answer it in ONE sentence using ONLY COURSE CONTENT, then say "Let me know when you're ready for a quick check."
- If they just confirmed ready: say ONE warm encouraging sentence (e.g. "Great — let's see how well that's landed.").
- Do NOT explain the topic again. Do NOT ask the MCQ here — that comes next automatically.
- Maximum 2 sentences. No visual or MCQ block.`

      case 'CHECK':
        return `CHECK phase — the student answered INCORRECTLY for "${pointLabel}" (${pointProgress}):
The student selected: "${message}"
- In ONE warm sentence explain why that answer is wrong and state the correct fact from COURSE CONTENT.
- In a second sentence say: "Don't worry — let's move on." (use exactly this phrase).
- Maximum 2 sentences total. No MCQ or visual block needed.`

      case 'POST_NOTES':
        return `POST-TOPIC CHECK — end of subtopic "${pointLabel}" (${pointProgress}):
This is the end of the full "${pointLabel}" subtopic. The student has been taught it and updated their notes.
- In ONE sentence confirm they should have the key point written down.
- Now ask a multiple-choice question to check their understanding of "${pointLabel}" — use this EXACT format:

:::MCQ
Question testing a specific fact about "${pointLabel}"?
A. Option one
B. Option two
C. Option three
D. Option four
CORRECT: B
:::

MCQ rules:
- Test one specific fact from COURSE CONTENT about "${pointLabel}"
- All 4 options plausible, only one correct
- CORRECT must be exactly A B C or D
- Do NOT reveal the answer in your speech sentence`

      case 'WRAP':
        return `WRAP-UP for section ${currentSection?.sectionId ?? 'this'}:
- Say one warm sentence congratulating the student on finishing all topics.
- Ask a multiple-choice question that links two concepts from this section using this EXACT format:

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
        return `Answer the student's question in 2-3 warm spoken sentences using ONLY COURSE CONTENT facts.
- If your answer introduces a named concept with multiple parts (pillars, steps, rules, rates, terms), add the appropriate visual block (PILLARS / STEPS / TERMS) at the end.
- If your answer is a factual check or simple acknowledgement, no visual block needed.
- End with an MCQ if you are testing understanding; otherwise end with a natural follow-up question or encouragement.`
    }
  })()

  const systemPrompt = `You are Alex, a warm and encouraging UK accounting tutor. You teach by speaking naturally and showing structured visual cards when content has clear structure.

━━━ CONTEXT ━━━
Module: ${mod.title} (Part ${mod.partNumber}: ${mod.partTitle})
Section: ${sectionLabel}
${completedLabel}
Student: ${student.name} | ${student.completedModules.length}/87 modules | avg quiz ${student.avgQuizScore}%

━━━ CRITICAL CONTENT RULE ━━━
You MUST teach ONLY from the COURSE CONTENT section below.
- Every fact, figure, rate, threshold, rule, and example you use MUST appear in COURSE CONTENT.
- If a fact is not in COURSE CONTENT, do NOT say it — say "the course covers this in a later section."
- Never use outside knowledge, HMRC website facts, or general accounting knowledge that isn't in COURSE CONTENT.
- If COURSE CONTENT is empty or unclear for a question, say "Let me check — this section will cover that shortly."

━━━ VOICE & TONE ━━━
- Warm, conversational, encouraging — like a friendly expert tutor
- Use "you", "let's", "great" naturally
- Keep sentences short and clear
- Use **bold** (double asterisks) around key terms, e.g. **Record-keeping**, **HMRC**, **CT600**
- When listing items inline (e.g. "Number one: ... Number two: ..."), put each item on its OWN LINE separated by a newline character so they display as separate items
- Always include the tax year for any figure, e.g. 2024/25
- No other markdown: no #, no -, no > blockquotes

━━━ DIAGRAM SIGNAL — :::VISUAL ━━━
When your explanation contains structured content that benefits from a diagram, add :::VISUAL on its own line BEFORE your structured block. This tells the system to pre-generate a diagram.
Use :::VISUAL when explaining:
  • Named pillars, principles, or categories (2–5 items)
  • A numbered process or sequence of steps
  • Key figures, rates, or thresholds
  • A hierarchy or authority structure
  • A central concept with related ideas
Do NOT use :::VISUAL for check questions, acknowledgements, or simple transitions.

━━━ VISUAL BLOCKS — USE FOR EVERY MODULE, EVERY TOPIC ━━━
After :::VISUAL (when used), ALSO add the matching structured block so the content is displayed inline:
  • Named pillars/principles → :::PILLARS block
  • Numbered steps/process → :::STEPS block
  • Key terms/rates/thresholds → :::TERMS block

Format — choose the right type and place it AFTER your speech sentences, at the very end:

:::PILLARS
Concept title
- Label one — one-sentence description of what it means
- Label two — one-sentence description of what it means
- Label three — one-sentence description of what it means
:::

:::STEPS
Process title
1. Step name — what happens at this step
2. Step name — what happens at this step
3. Step name — what happens at this step
:::

:::TERMS
Title
Term one — its definition or value
Term two — its definition or value
:::

Visual block rules:
- ONE block maximum per response
- Every item line MUST have a label AND a description separated by " — "
- Never use a block for check/acknowledgement responses
- Speech text before the block must be complete natural sentences

━━━ MCQ QUESTIONS ━━━
Whenever you ask a check question (at the end of EXPLAIN or WRAP phases), ALWAYS use MCQ format:

:::MCQ
Question text here?
A. First option
B. Second option
C. Third option
D. Fourth option
CORRECT: B
:::

MCQ rules:
- All 4 options must be plausible from the course content; only one correct
- CORRECT line must be exactly one letter A B C or D
- Never reveal the answer in your speech text

━━━ CURRENT TASK ━━━
${phaseInstruction}

━━━ COURSE CONTENT ━━━
${teachingPointContent && teachingPointContent.trim().length > 20
  ? `EXACT TEACHING POINT — reproduce ALL facts, figures, names, and lists from this verbatim:
${teachingPointContent}

BROADER SECTION CONTEXT (for MCQ distractors only — do not teach beyond teaching point above):
${ragContext.slice(0, 1000)}`
  : ragContext}`

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
