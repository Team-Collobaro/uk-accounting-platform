import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getProctorRequestUser } from '@/lib/proctorAuth'

export const runtime = 'nodejs'

import crypto from 'crypto'

// Generates a random, secure token for pairing
function generatePairingToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

// POST: Create / return the current proctor session for this user + exam
export async function POST(req: NextRequest) {
  try {
    const user = await getProctorRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { moduleId, action, token, sessionId } = await req.json() as { moduleId?: string, action?: string, token?: string, sessionId?: string }

    if (action === 'verify') {
      // Mobile app claiming a session
      if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

      const now = new Date().toISOString()
      const { data: session, error: claimError } = await supabaseAdmin
        .from('proctor_sessions')
        .update({ status: 'paired' })
        .eq('token', token)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .select('id')
        .single()

      if (claimError || !session) {
        return NextResponse.json({ error: 'Invalid, expired, or already-used token' }, { status: 400 })
      }

      return NextResponse.json({ success: true, sessionId: session.id })
    }

    if (action && ['start', 'pause', 'end'].includes(action)) {
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
      
      const newStatus = action === 'start' ? 'active' : action === 'pause' ? 'paused' : 'ended'
      
      const { data, error: updateError } = await supabaseAdmin
        .from('proctor_sessions')
        .update({ status: newStatus })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .in('status', action === 'start' ? ['paired', 'paused'] : ['active', 'paused'])
        .select('id')
        .single()
        
      if (updateError || !data) {
         return NextResponse.json({ error: 'Invalid session or illegal state transition' }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, status: newStatus })
    }

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId required' }, { status: 400 })
    }

    // BUG 6 FIX: Reuse existing pending/paired session for this user+module
    const now = new Date().toISOString()
    const { data: existingSession } = await supabaseAdmin
      .from('proctor_sessions')
      .select('id, token, status')
      .eq('user_id', user.id)
      .eq('module_id', moduleId)
      .in('status', ['pending', 'paired'])
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      const qrPayload = `lms://proctor/${existingSession.token}`
      return NextResponse.json({
        sessionId: existingSession.id,
        qrPayload,
        status: existingSession.status,
        reused: true,
      })
    }

    const pairingToken = generatePairingToken()
    // Token expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { data: insertedSession, error: insertError } = await supabaseAdmin
      .from('proctor_sessions')
      .insert({
        user_id: user.id,
        module_id: moduleId,
        token: pairingToken,
        expires_at: expiresAt
      })
      .select('id')
      .single()

    if (insertError || !insertedSession) {
      console.error('[proctor-session] db error:', insertError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    const newSessionId = insertedSession.id
    const qrPayload = `lms://proctor/${pairingToken}`

    return NextResponse.json({ sessionId: newSessionId, qrPayload, status: 'pending' })

  } catch (err) {
    console.error('[proctor-session] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Return the current link status for a given sessionId
export async function GET(req: NextRequest) {
  try {
    const user = await getProctorRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // BUG 2 FIX: Select status so web can detect pairing
    const { data: session } = await supabaseAdmin
      .from('proctor_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found or forbidden' }, { status: 403 })
    }

    // Fetch violation count from Supabase (count only, no details per Q3)
    const { data } = await supabaseAdmin
      .from('proctor_violation_counts')
      .select('count')
      .eq('session_id', sessionId)
      .maybeSingle()

    return NextResponse.json({
      sessionId,
      status: session.status,
      violationCount: data?.count ?? 0,
    })

  } catch (err) {
    console.error('[proctor-session] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
