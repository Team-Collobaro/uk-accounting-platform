import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

async function analyzeModule(moduleId: string) {
  const dataPath = path.join(process.cwd(), 'lib', 'courseDataRaw.json')
  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const mod = rawData.find((m: any) => m.id === moduleId)
  if (!mod) return console.log('Module not found')

  console.log(`Analyzing ${mod.sections.length} sections for ${moduleId}...`)

  const systemPrompt = `You are a UK accounting tutor. Review course content and decide if a student needs a practice question or worked example to consolidate understanding BEFORE moving on.
Rules:
1. Only act if the section contains a complex rule, calculation, legal threshold/deadline, or new concept with no worked example already present.
2. If the section is introductory/overview or already has examples and questions, respond with ACTION:NONE.
3. Choose ONE of: ACTION:NONE, ACTION:QUESTION, ACTION:EXAMPLE
Base everything strictly on what the section says. Do not use outside knowledge.`

  for (const sec of mod.sections) {
    const plainText = sec.contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200)
    if (!plainText) continue
    
    const userPrompt = `Section title: ${sec.section_title}\n\nContent:\n${plainText}\n\nDecide: does this student need an extra question or example right now?`

    try {
      const res = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
      const text = res.content[0].type === 'text' ? res.content[0].text : 'ACTION:NONE'
      let action = 'NONE'
      if (text.includes('ACTION:QUESTION')) action = 'QUESTION'
      else if (text.includes('ACTION:EXAMPLE')) action = 'EXAMPLE'
      
      console.log(`[${sec.section_id}] ${sec.section_title}: ${action}`)
    } catch (e) {
      console.error(e)
    }
  }
}

analyzeModule('m01')
