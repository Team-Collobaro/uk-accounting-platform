import { NextRequest, NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? ''
// "Daniel" — British male, warm and clear. Change voice ID to swap.
// Browse voices: https://elevenlabs.io/voice-library
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'onwK4e9ZLuTAKqWW03F9' // Daniel (British)

const ELEVENLABS_VOICES = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British male, warm' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'British male, authoritative' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep British male' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'British female, warm' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'British female, confident' },
]

export async function GET() {
  return NextResponse.json({ voices: ELEVENLABS_VOICES })
}

export async function POST(req: NextRequest) {
  const { text, voiceId } = await req.json() as { text: string; voiceId?: string }
  if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 })

  // Use ElevenLabs if API key is configured
  if (ELEVENLABS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || VOICE_ID}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5', // fastest + most realistic
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.82,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      )

      if (res.ok) {
        const audio = await res.arrayBuffer()
        return new Response(audio, {
          headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
        })
      }
      // Fall through to Google TTS on error
      console.error('ElevenLabs error:', res.status, await res.text())
    } catch (err) {
      console.error('ElevenLabs fetch failed:', err)
    }
  }

  // Fallback: Google Translate TTS (free, lower quality)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const googleTTS = require('google-tts-api') as {
    getAllAudioUrls: (text: string, opts: { lang: string; slow: boolean; host: string }) => { url: string }[]
  }

  const parts: { url: string }[] = googleTTS.getAllAudioUrls(text, {
    lang: 'en-GB',
    slow: false,
    host: 'https://translate.google.com',
  })

  const chunks = await Promise.all(
    parts.map(({ url }) =>
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.arrayBuffer())
    )
  )

  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  return new Response(merged, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  })
}
