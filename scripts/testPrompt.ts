import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

async function test() {
  const sectionTitle = "1.8 Information Commissioner's Office (ICO) — data protection"
  const plainText = "If your business processes personal data (and as an accountant you process names, NINOs, salaries, bank details, addresses), you must register with the ICO (a notification fee, currently £40-£2,900 a year depending on size) and comply with the UK GDPR & Data Protection Act 2018. Module 86 covers this in detail."

  const systemPrompt = `You are a UK accounting tutor. Review course content and decide if a student needs a practice question or worked example to consolidate understanding BEFORE moving on.

Rules:
1. Only act if the section contains a complex rule, calculation, legal threshold/deadline, or new concept with no worked example already present.
2. If the section is introductory/overview or already has examples and questions, respond with ACTION:NONE.
3. Choose ONE of:
   ACTION:NONE
   ACTION:QUESTION
   QUESTION: [the question text]
   ACTION:EXAMPLE
   TITLE: [short title]
   CONTENT: [3-6 sentence worked example with numbers if relevant]

Base everything strictly on what the section says. Do not use outside knowledge.`

  const userPrompt = `Section title: ${sectionTitle}\n\nContent:\n${plainText}\n\nDecide: does this student need an extra question or example right now?`

  try {
    const res = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
    console.log("RESPONSE:")
    console.log(res.content)
  } catch (err) {
    console.error('Error:', err)
  }
}

test()
