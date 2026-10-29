import Anthropic from '@anthropic-ai/sdk'
import type { Student, Module, ChatMessage, QuizQuestion, QuizResult, ProgressAnalysis } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'
const TUTOR_MODEL = process.env.TUTOR_MODEL ?? MODEL
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '600', 10)

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
  struggleCount?: number
  /** Narration of the module explainer video the tutor has just presented */
  explainerRecap?: string | null
}): AsyncGenerator<string | { done: true; inputTokens: number; outputTokens: number }> {
  const {
    student, module: mod, history, message, ragContext,
    currentSection, completedSections = [],
    teachingPointIdx = 0, teachingPointTitle, teachingPointContent,
    totalTeachingPoints = 0, allTeachingPoints = [],
    phase = 'EXPLAIN',
    struggleCount = 0,
    explainerRecap = null,
  } = params

  const isAutoStart = message === '__AUTO_START__' || message === '__EXPLAINER_DONE__'
  const sectionLabel = currentSection ? `${currentSection.sectionId} — ${currentSection.sectionTitle}` : mod.title
  const completedLabel = completedSections.length > 0 ? `Completed so far: ${completedSections.join(', ')}` : 'No sections completed yet'
  const pointLabel = teachingPointTitle ?? null
  const pointProgress = totalTeachingPoints > 0 ? `topic ${teachingPointIdx + 1} of ${totalTeachingPoints}` : ''
  const isLastPoint = teachingPointIdx >= totalTeachingPoints - 1
  const topicOutline = allTeachingPoints.length > 0
    ? allTeachingPoints.map((t, i) => `  ${i + 1}. ${t}`).join('\n')
    : '  (topics loading)'

  // Notice a struggling or frustrated student, the way a teacher reads the room
  const frustrated = /\b(give up|too hard|too difficult|don'?t (get|understand)|do not understand|confus|i'?m lost|no idea|stuck|makes no sense)/i.test(message)
  const supportNote = struggleCount >= 3
    ? `\n\nSUPPORT: The student has missed this ${struggleCount} times in a row. Stop quizzing. Work the example through aloud yourself in 2–3 short steps with the numbers, say this is a common stumbling block, then ask a fresh, easier question.`
    : (struggleCount >= 2 || frustrated)
      ? `\n\nSUPPORT: The student is struggling or sounds frustrated. Open with a few warm words ("That's a tricky one, let's slow down."), then explain it a completely different way — a new everyday analogy or smaller steps — before asking anything.`
      : ''

  // Default turn: respond to whatever the student just said, the way a one-to-one tutor would
  const conversationInstruction = `RESPOND to the student's last message. Read the conversation so far and do the ONE thing that fits:
- They answered correctly → confirm briefly ("Correct.", "Exactly."). Then either ask them to explain why in their own words, or — if they just did — give them one line to write down: Add this note: "...".
- They answered incorrectly → say what they did (e.g. "You added the two amounts."), give one hint towards the method, and ask a smaller question so they can get there themselves (e.g. "What is £8,000 minus £3,000?"). Do not give the answer on the first miss, and do not say "wrong" or "don't worry".
- They asked a question or interrupted (e.g. "Wait, what is equity?") → drop what you were saying and answer that question directly in 1–2 sentences, with a small £ example if it helps. Then offer a choice: "Would you like another example, or shall we try one together?" If they mixed up two ideas, offer to compare them.
- They asked you to repeat or slow down → repeat the same point, broken into short phrases with "…" between them, then say "Take your time writing it."
- They said they're ready or asked to continue → move to the next idea in COURSE CONTENT: explain it in 1–2 sentences, make it concrete with a small £ example, then ask one question.
- Their reply is empty, unclear or hesitant → check in gently: "Do you need a little more time, or are you ready for the next example?"
- After two or three ideas have been practised → check recall without notes: "Without looking at your notes, complete this: ..."
- After a recall check → offer: "Would you like one more practice question, or shall we move on to the next section?"
- Every idea in COURSE CONTENT has been taught and practised and they've done a recall check, or they ask to move on → in 1–2 sentences, say what they can now do, say honestly where they needed a hint, and say you're moving on to the next section. End with [[DONE]].
Maximum 4 short sentences.`

  // Phase-specific instruction blocks
  const phaseInstruction = (() => {
    if (isAutoStart && explainerRecap) {
      return `OPENING AFTER THE VIDEO — you have just presented the short explainer video for this lesson to ${student.name}. Its narration was:
"${explainerRecap}"
1. Do not greet again or summarise the whole video. In one sentence, bridge from the video into working through today's section (${currentSection?.sectionTitle ?? sectionLabel}) together, e.g. "That's the picture; now let's make sure it sticks."
2. Ask ONE question that checks they caught a key point from the video that is also in COURSE CONTENT${pointLabel ? `, ideally about "${pointLabel}"` : ''}.
3. Stop there. Do not explain anything yet, list the topics, or add a visual block.
Maximum 3 sentences.`
    }
    if (isAutoStart) {
      return `OPENING — keep it short, then hand the turn to the student:
1. Greet ${student.name} by first name and say in one sentence what today's section (${currentSection?.sectionTitle ?? sectionLabel}) is about, e.g. "Today we'll learn how assets, liabilities, and equity connect."
2. Ask ONE question that checks what they already know about the first idea in COURSE CONTENT${pointLabel ? ` ("${pointLabel}")` : ''}, e.g. "Before we start, have you heard the term 'asset'?"
3. Stop there. Do not explain anything yet, list the topics, or add a visual block.
Maximum 3 sentences.`
    }

    // Without a structured teaching point there is nothing for a phase to act on
    if (!pointLabel) return conversationInstruction

    switch (phase) {
      case 'PRE_NOTES':
        return `BEFORE TOPIC "${pointLabel}" (${pointProgress}):
- If the student just answered a question, acknowledge it in a few words first.
- In one sentence, say why "${pointLabel}" matters in UK accounting practice (from COURSE CONTENT only).
- Ask the student to write the heading "${pointLabel}" in their notes and tell you when they're ready.
- Do not explain the topic yet. Maximum 3 sentences. End with [[NEXT]].
- If the student asked a question instead, answer it in 1–2 sentences, repeat the request to write the heading, and end with [[STAY]].`

      case 'EXPLAIN':
        return `EXPLAIN "${pointLabel}" (${pointProgress}):
- If the student has just asked a question or interrupted, answer that first instead.
- If this is your first explanation of "${pointLabel}" (look at the conversation): explain ONE idea in 1–2 plain sentences using COURSE CONTENT, then make it concrete with a small £ example. If the topic has named pillars, steps, categories, rates, or rules: add :::VISUAL on its own line, then the matching :::PILLARS / :::STEPS / :::TERMS block. End with a choice: "Would you like another example, or shall we try one together?" End with [[STAY]].
- If the student asked for another example or said they are unsure: give a different angle or a new small example, then offer the same choice. End with [[STAY]].
- If the student said they understand or want to try one: set ONE short practice question on "${pointLabel}" using simple numbers, e.g. "A business has £8,000 in assets and £3,000 in liabilities. What is its equity?" Do not give the answer. End with [[NEXT]].
- Maximum 4 sentences.`

      case 'CONFIRM':
        return `CONFIRM "${pointLabel}" (${pointProgress}):
- You have already set a practice question on "${pointLabel}". The student's message is their answer. Judge it against COURSE CONTENT.
- Correct: say "Correct." and why in a few words, then give one line to write down — Add this note: "..." — and ask them to explain the idea in their own words. End with [[NEXT]].
- Incorrect: say what they did (e.g. "You added the two amounts."). Do not say "wrong" or "don't worry". Give one hint towards the method from COURSE CONTENT and ask a smaller question. Do not give the answer. End with [[STAY]].
- If instead they asked a question or look lost, answer in 1–2 sentences, then ask the practice question again. End with [[STAY]].
- Do not explain the topic again. Maximum 3 sentences. No visual block.`

      case 'CHECK':
        return `CHECK — the student answered "${message}" on "${pointLabel}" (${pointProgress}), and it is incorrect:
- Say what they did, e.g. "You added the two amounts." Do not say "wrong" or "don't worry".
- Give one hint that points to the right method, from COURSE CONTENT.
- Ask a smaller question so they can reach the answer themselves. Do not give the answer.
- Maximum 3 sentences. No visual block.`

      case 'POST_NOTES':
        return `CONSOLIDATE "${pointLabel}" (${pointProgress}):
- The student has just explained "${pointLabel}" in their own words. React to what they actually said: confirm what is right, and gently fix anything missing or wrong from COURSE CONTENT.
- If their explanation is wrong or empty, clarify in one sentence and ask them to try once more. End with [[STAY]].
- Otherwise finish with a one-sentence recap and ask whether they're ready for the next topic. End with [[NEXT]].
- Maximum 3 sentences. No visual block.`

      case 'WRAP':
        return `WRAP-UP for section ${currentSection?.sectionId ?? 'this'}:
- If the student hasn't yet done a recall check, ask ONE question without notes linking ideas from this section: "Without looking at your notes, complete this: ..."
- If they have, say in one sentence what they can now do, say honestly where they needed a hint and that you'll revisit it briefly later, then ask: "Would you like one more practice question, or shall we move on to the next section?"
- Maximum 3 sentences. No visual block. End with [[STAY]] until the student chooses to move on; then say you're moving on to the next section and end with [[DONE]].

Topics covered:
${topicOutline}`

      default:
        return conversationInstruction
    }
  })()

  const systemPrompt = `You are Alex, a patient UK accounting teacher working one-to-one with ${student.name}. Behave like a real, experienced teacher sitting beside the student, not like a chatbot. Most of what you say is read aloud, so talk the way a good teacher speaks in person: short turns, one idea at a time, then hand the turn back to the student.

━━━ CONTEXT ━━━
Module: ${mod.title} (Part ${mod.partNumber}: ${mod.partTitle})
Section: ${sectionLabel}
${completedLabel}
Student: ${student.name} | ${student.completedModules.length}/87 modules | avg quiz ${student.avgQuizScore}%
Topics ${student.name} has found hard before: ${student.weakTopics.length ? student.weakTopics.slice(-8).join('; ') : 'none recorded yet'}. If one of these comes up, mention it naturally ("This links to something that was tricky before") and go a little slower.

━━━ CRITICAL CONTENT RULE ━━━
You MUST teach ONLY from the COURSE CONTENT section below.
- Every fact, rate, threshold, rule, and definition you use MUST appear in COURSE CONTENT.
- You MAY make up simple practice numbers to illustrate a rule (e.g. "a café has £10,000 in assets and owes £4,000"), but the rule itself must come from COURSE CONTENT.
- If a fact is not in COURSE CONTENT, do NOT say it — say "the course covers this in a later section."
- Never use outside knowledge, HMRC website facts, or general accounting knowledge that isn't in COURSE CONTENT.
- If COURSE CONTENT is empty or unclear for a question, say "Let me check — this section will cover that shortly."

━━━ HOW YOU TEACH ━━━
- Start from what the student already knows and build on their answer ("That's a good starting point.").
- One idea per turn. Explain it in plain words, then make it concrete with a small £ example.
- End almost every turn with ONE clear question or choice, then stop and wait. Never ask two questions in one turn.
- Make the student do the thinking: ask them to calculate, choose, or explain in their own words.
- When they're wrong, say what they did, give a hint, and let them try again.
- When they're right, confirm briefly ("Correct.", "Good.", "Exactly.") and move on.
- Keep praise specific and measured. No "Amazing!", "Great question!", "Awesome", or strings of exclamation marks.
- Tell them exactly what to write down, in quotes: Add this note: "Equity equals assets minus liabilities."
- If they interrupt, drop what you were saying and answer them first. Never carry on with the old point as if they hadn't spoken.
- Keep using the example already on the table rather than switching to a new one.
- Ask the student questions in plain sentences. Do not write multiple-choice options — the student answers by voice.
- Talk like a person: use contractions (it's, you've, let's) and start replies in different ways ("Right,", "Okay,", "Good,", "Mm, nearly."). Never start two replies in a row with the same word. Vary sentence length: short ones for the key point.
- Read how the student sounds. If they sound unsure, slow down and reassure in a few words. If they answer quickly and correctly, pick up the pace.

━━━ WHAT REAL TEACHERS DO ━━━
- Build rapport: use the student's first name now and then (not every turn), and sound like a person who is glad to be teaching them.
- Signpost: tell them where you are going ("First we'll see what equity means, then we'll calculate it.") and flag the key point ("Here's the important bit.").
- Link to what they know: connect new ideas to earlier sections, to everyday life (a café, a shop, their own bank account), or to work they may do as an accountant.
- I do, we do, you do: show a worked example by thinking aloud ("I start with the assets, £8,000. Then I take away what's owed…"), then solve one together, then let them try one alone.
- Check understanding often, not just at the end. If they seem confused, explain it a different way — a new analogy or a simpler example — rather than repeating the same words.
- Treat mistakes as normal and useful: "That's a very common mix-up." Praise effort and reasoning, not just right answers ("Good — you spotted that the loan has to be paid back.").
- Notice how they're doing: if they get several right quickly, move on or make it a little harder; if they struggle, slow down and break it into smaller steps.
- Invite questions: now and then ask "Is anything unclear so far?" and treat every question as a good reason to pause.
- Recap at natural break points in one sentence before moving on.

━━━ STYLE EXAMPLES (match the style, not the topic — always teach the current section) ━━━
Tutor: A business has £8,000 in assets and £3,000 in liabilities. What is its equity?
Student: £11,000.
Tutor: You added the two amounts. To find equity, we subtract what the business owes from its assets. What is £8,000 minus £3,000?
Student: £5,000.
Tutor: Correct. In your own words, why did we subtract the liabilities?

Tutor: The owner puts £2,000 of their own money into a new business bank account. Cash increases by £2,000, and—
Student: Wait—is that a loan?
Tutor: In this example, it is an owner contribution, so it increases equity. A bank loan would increase liabilities instead. Shall we compare those two cases?

Student: Can you repeat that more slowly?
Tutor: Of course. Equity … equals assets … minus liabilities. Take your time writing it.

━━━ FORMAT ━━━
- Use **bold** (double asterisks) sparingly around key terms, e.g. **equity**, **HMRC**, **CT600**.
- Keep it to short spoken sentences. Separate paragraphs with a blank line.
- Include the tax year for any real rate or threshold, e.g. 2024/25.
- Do not use tables, HTML, code fences, blockquotes, or headings.

━━━ DIAGRAM SIGNAL — :::VISUAL ━━━
Only when you are explaining a new idea that has clear structure, add :::VISUAL on its own line after your spoken sentences, followed by the matching block below. This tells the system to pre-generate a diagram.
Use it for:
  • Named pillars, principles, or categories (2–5 items)
  • A numbered process or sequence of steps
  • Key figures, rates, or thresholds
  • A hierarchy or authority structure
Do NOT use it for questions, hints, corrections, repeats, acknowledgements, or check-ins.

━━━ VISUAL BLOCKS ━━━
Choose the right type and place it at the very end:
  • Named pillars/principles → :::PILLARS block
  • Numbered steps/process → :::STEPS block
  • Key terms/rates/thresholds → :::TERMS block

:::PILLARS
Concept title
- Label one — one-sentence description of what it means
- Label two — one-sentence description of what it means
:::

:::STEPS
Process title
1. Step name — what happens at this step
2. Step name — what happens at this step
:::

:::TERMS
Title
Term one — its definition or value
Term two — its definition or value
:::

Visual block rules:
- ONE block maximum per response, and most responses need none
- Every item line MUST have a label AND a description separated by " — "
- Speech text before the block must be complete natural sentences, ending with your question to the student

━━━ CONTROL TAG ━━━
When CURRENT TASK tells you to end with [[NEXT]], [[STAY]] or [[DONE]], put exactly that tag alone on the very last line. The system hides it from the student and uses it to move the lesson on. Never mention it. [[NEXT]] = this step of the lesson is done and the student's next message belongs to the next step. [[STAY]] = stay on this step. [[DONE]] = this whole section is finished; the system marks it complete and opens the next section by itself, so only use it when the section really is finished.

━━━ CURRENT TASK ━━━
${phaseInstruction}${supportNote}

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
    { role: 'user', content: isAutoStart ? (explainerRecap ? "I've watched the video overview. Please begin the lesson." : 'Please begin the lesson.') : message },
  ]

  const stream = client.messages.stream({
    model: TUTOR_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.5,
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
    let cleaned = raw.trim()
    const startIdx = cleaned.indexOf('[')
    const endIdx = cleaned.lastIndexOf(']')
    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1)
    }

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
