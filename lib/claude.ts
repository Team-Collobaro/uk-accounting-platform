// Shared settings for every Claude call in the app.

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-5-5'

/**
 * Claude Haiku 5.5 thinks before answering unless told not to. These are short, fast replies that
 * don't need it, and the installed SDK version predates thinking, so turn it off explicitly.
 * (Haiku 5.5 also rejects temperature/top_p/top_k: guide the output from the prompt instead.)
 */
export const NO_THINKING = { thinking: { type: 'disabled' } } as Record<never, never>

/** The reply text, read by block type rather than position. */
export function responseText(response: { content: ReadonlyArray<{ type: string; text?: string }> }, fallback = ''): string {
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
  return text || fallback
}

// Per-token prices in USD for cost tracking (prompts up to 100K tokens)
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.10 / 1_000_000, output: 0.50 / 1_000_000 },
  'claude-haiku-4-5': { input: 1.00 / 1_000_000, output: 5.00 / 1_000_000 },
}

export function tokenPrice(model = CLAUDE_MODEL): { input: number; output: number } {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k))
  return key ? PRICES[key] : PRICES['claude-haiku-5-5']
}
