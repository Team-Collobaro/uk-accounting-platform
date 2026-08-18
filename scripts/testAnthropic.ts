import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

async function test() {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }]
    })
    console.log(res.content)
  } catch (err) {
    console.error('Error:', err)
  }
}

test()
