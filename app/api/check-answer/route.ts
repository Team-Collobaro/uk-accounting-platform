import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export async function POST(req: NextRequest) {
  try {
    const { question, answer, context } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Course context: ${context}\n\nQuestion: ${question}\nStudent answer: ${answer}\n\nGive brief feedback (2-3 sentences): correct or not? What did they get right/wrong? Be encouraging. Base only on the course context.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : 'Feedback could not be generated.'

    return NextResponse.json({ feedback: text })

  } catch (error) {
    console.error('check-answer error:', error)
    return NextResponse.json({ error: 'Failed to check answer' }, { status: 500 })
  }
}
