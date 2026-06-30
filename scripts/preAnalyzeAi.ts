import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function analyzeModule(moduleId: string) {
  const dataPath = path.join(process.cwd(), 'lib', 'courseDataRaw.json')
  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const modIndex = rawData.findIndex((m: any) => m.id === moduleId)
  if (modIndex === -1) return console.log('Module not found')

  const mod = rawData[modIndex]
  console.log(`Analyzing ${mod.sections.length} sections for ${moduleId}...`)

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

  let updated = false

  for (let i = 0; i < mod.sections.length; i++) {
    const sec = mod.sections[i]
    
    // Skip if we already analyzed it
    if (sec.aiPractice !== undefined) {
      console.log(`[${sec.id}] Skipping, already analyzed (aiPractice exists)`)
      continue
    }

    const plainText = sec.contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200)
    if (!plainText) {
      sec.aiPractice = null
      updated = true
      continue
    }
    
    const userPrompt = `Section title: ${sec.title}\n\nContent:\n${plainText}\n\nDecide: does this student need an extra question or example right now?`

    try {
      const res = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
      const text = res.content[0].type === 'text' ? res.content[0].text : 'ACTION:NONE'
      
      let aiPractice: any = null
      if (text.includes('ACTION:QUESTION')) {
        const qMatch = text.match(/QUESTION:\s*([\s\S]+)/)
        if (qMatch) {
          aiPractice = { action: 'QUESTION', question: qMatch[1].trim() }
        }
      } else if (text.includes('ACTION:EXAMPLE')) {
        const tMatch = text.match(/TITLE:\s*(.+)/)
        const cMatch = text.match(/CONTENT:\s*([\s\S]+)/)
        if (tMatch && cMatch) {
          aiPractice = { action: 'EXAMPLE', title: tMatch[1].trim(), content: cMatch[1].trim() }
        }
      }
      
      sec.aiPractice = aiPractice
      
      // Clean up the old flag to keep DB clean
      delete sec.hasAiPractice

      updated = true
      console.log(`[${sec.id}] ${sec.title}: ${aiPractice ? aiPractice.action : 'NONE'}`)
      
      // Sleep to avoid rate limits
      await sleep(1000)
    } catch (e) {
      console.error(`Error on section ${sec.id}:`, e)
      // Wait longer if rate limited
      await sleep(5000)
    }
  }

  if (updated) {
    fs.writeFileSync(dataPath, JSON.stringify(rawData, null, 2), 'utf-8')
    console.log(`Updated courseDataRaw.json with AI analysis for ${moduleId}!`)
  } else {
    console.log(`No updates made for ${moduleId}.`)
  }
}

const targetModule = process.argv[2] || 'm01'
analyzeModule(targetModule)
