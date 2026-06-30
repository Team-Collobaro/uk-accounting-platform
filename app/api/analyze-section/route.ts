import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export async function POST(req: NextRequest) {
  try {
    const { sectionTitle, plainText } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

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

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : 'ACTION:NONE'

    if (text.includes('ACTION:NONE')) {
      return NextResponse.json({ action: 'NONE' })
    }

    if (text.includes('ACTION:QUESTION')) {
      const qMatch = text.match(/QUESTION:\s*([\s\S]+)/)
      const question = qMatch ? qMatch[1].trim() : ''
      return NextResponse.json({ action: 'QUESTION', question })
    }

    if (text.includes('ACTION:EXAMPLE')) {
      const tMatch = text.match(/TITLE:\s*(.+)/)
      const cMatch = text.match(/CONTENT:\s*([\s\S]+)/)
      const title = tMatch ? tMatch[1].trim() : 'Worked Example'
      const content = cMatch ? cMatch[1].trim() : ''
      return NextResponse.json({ action: 'EXAMPLE', title, content })
    }

    return NextResponse.json({ action: 'NONE' })

  } catch (error) {
    console.error('analyze-section error:', error)
    return NextResponse.json({ error: 'Failed to analyze section' }, { status: 500 })
  }
}
