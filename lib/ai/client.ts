import Anthropic from '@anthropic-ai/sdk'

export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'
export const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '512', 10)
