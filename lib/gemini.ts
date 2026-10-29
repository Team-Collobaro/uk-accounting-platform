// Minimal Gemini client (REST, no SDK). The key is read from GEMINI_API_KEY in .env.local.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

interface GeminiOptions {
  system?: string
  model?: string
  maxOutputTokens?: number
  temperature?: number
  // Gemini 3 models reason before answering, which is slow and costly; keep it low for tutoring.
  thinkingLevel?: 'low' | 'high'
  timeoutMs?: number
}

// Returns the reply text, or throws (callers should catch and fall back).
export async function generateGeminiText(prompt: string, opts: GeminiOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const res = await fetch(`${GEMINI_URL}/${opts.model ?? DEFAULT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        thinkingConfig: { thinkingLevel: opts.thinkingLevel ?? 'low' },
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
  if (!text) throw new Error('Gemini returned no text')
  return text
}
