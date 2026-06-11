import { NextRequest, NextResponse } from "next/server"

// ElevenLabs text-to-speech. Optional — works on the free tier. When the key is
// missing, or ElevenLabs returns an error (401 unauthorized, 429 quota
// exhausted, etc.), this route returns JSON `{ fallback: true }` and the client
// falls back to the browser's built-in Web Speech voice. Audio is never broken.

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? ""
// Default voice: "Daniel" — British male, warm and clear.
// Browse voices: https://elevenlabs.io/voice-library
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9"

// The two voices exposed to the UI (one male, one female).
const ELEVENLABS_VOICES = [
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female" },
]

const ALLOWED_VOICE_IDS = new Set(ELEVENLABS_VOICES.map((v) => v.id))

const fallback = () => NextResponse.json({ fallback: true })

export async function GET() {
  return NextResponse.json({ voices: ELEVENLABS_VOICES })
}

export async function POST(req: NextRequest) {
  const { text, voiceId } = (await req.json()) as {
    text?: string
    voiceId?: string
  }
  if (!text?.trim()) return NextResponse.json({ error: "No text" }, { status: 400 })

  // No key configured → tell the client to use the browser voice.
  if (!ELEVENLABS_API_KEY) return fallback()

  const id = voiceId && ALLOWED_VOICE_IDS.has(voiceId) ? voiceId : VOICE_ID

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${id}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5", // fast + cheap, available on the free tier
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.82,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (res.ok) {
      const audio = await res.arrayBuffer()
      return new Response(audio, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      })
    }

    // Quota exhausted (429), bad key (401), or any other error → fall back.
    console.error("ElevenLabs error:", res.status, await res.text())
    return fallback()
  } catch (err) {
    console.error("ElevenLabs fetch failed:", err)
    return fallback()
  }
}
