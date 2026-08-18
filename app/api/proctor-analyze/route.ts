import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getProctorRequestUser } from '@/lib/proctorAuth'
import { inngest } from '@/inngest/client'

export const runtime = 'nodejs'

// ─── In-memory rate limiter ────────────────────────────────────────────────
// Enforces max 6 Claude calls/minute per session (10s between calls)
const lastCallMap = new Map<string, number>()

function isThrottled(sessionId: string): boolean {
  const last = lastCallMap.get(sessionId) ?? 0
  return Date.now() - last < 10_000
}

function markCalled(sessionId: string) {
  lastCallMap.set(sessionId, Date.now())
  if (lastCallMap.size > 100) {
    const cutoff = Date.now() - 60_000
    for (const [key, val] of lastCallMap.entries()) {
      if (val < cutoff) lastCallMap.delete(key)
    }
  }
}

// ─── Route Handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getProctorRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      filePath: string     // storage path from Flutter
      sessionId: string
      flaggedLabel: string // ML Kit label
    }

    const { filePath, sessionId, flaggedLabel } = body
    if (!filePath || !sessionId) {
      return NextResponse.json({ error: 'filePath and sessionId required' }, { status: 400 })
    }

    // Verify session ownership and expiry
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('proctor_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .in('status', ['paired', 'active', 'paused'])
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or forbidden' }, { status: 403 })
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 403 })
    }

    // 2. Rate limit check
    if (isThrottled(sessionId)) {
      return NextResponse.json({ status: 'throttled', verdict: 'skip' })
    }
    markCalled(sessionId)

    // 3. Queue background job
    await inngest.send({
      name: 'proctor/analyze.frame',
      data: {
        sessionId,
        userId: user.id,
        filePath,
        flaggedLabel
      }
    })

    return NextResponse.json({ status: 'queued' }, { status: 202 })

  } catch (err) {
    console.error('[proctor-analyze] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
