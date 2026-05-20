import { NextResponse } from 'next/server'

// TTS is handled client-side via Web Speech API — this route is no longer used.
export async function GET() {
  return NextResponse.json({ removed: true })
}
