import { NextResponse } from 'next/server'

export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 503 })
  }

  // Step 1: short-lived session token (API key stays server-side)
  const tokenRes = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  })
  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Failed to create HeyGen token' }, { status: 502 })
  }
  const { data: { token } } = await tokenRes.json() as { data: { token: string } }

  // Step 2: create streaming session → returns LiveKit URL + access token
  const sessionRes = await fetch('https://api.heygen.com/v1/streaming.new', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      quality: 'high',
      avatar_name: process.env.HEYGEN_AVATAR_ID ?? 'Ann_Therapist_public',
      voice: {
        voice_id: process.env.HEYGEN_VOICE_ID ?? 'en-GB-SoniaNeural',
        rate: 1.0,
        emotion: 'Friendly',
      },
      video_encoding: 'H264',
      version: 'v2',
    }),
  })
  if (!sessionRes.ok) {
    const text = await sessionRes.text()
    console.error('HeyGen session error:', text)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 502 })
  }
  const { data: session } = await sessionRes.json() as {
    data: { session_id: string; url: string; access_token: string }
  }

  return NextResponse.json({
    sessionId: session.session_id,
    liveKitUrl: session.url,
    liveKitToken: session.access_token,
    heygenToken: token,
  })
}
