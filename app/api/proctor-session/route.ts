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
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', terminal: true }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { moduleId?: string, action?: string, token?: string, sessionId?: string, forceNew?: boolean }
    const { action, token, sessionId } = body

    if (action === 'verify') {
      // Mobile app claiming a session
      if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

      const now = new Date().toISOString()
      
      // 1. Fetch the session by token first to check identity
      const { data: session, error: fetchError } = await supabaseAdmin
        .from('proctor_sessions')
        .select('id, user_id, status')
        .eq('token', token)
        .gt('pairing_expires_at', now)
        .single()

      if (fetchError || !session) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
      }

      // 2. Identity Check
      if (session.user_id !== user.id) {
        return NextResponse.json({ 
          error: 'identity_mismatch',
          message: 'Account mismatch. Please ensure you are logged into the same account on both your phone and laptop.'
        }, { status: 403 })
      }

      // 3. Status check
      if (session.status !== 'pending') {
        return NextResponse.json({ error: 'Token already used or session inactive' }, { status: 400 })
      }

      // 4. Update to paired
      const { error: claimError } = await supabaseAdmin
        .from('proctor_sessions')
        .update({
          status: 'paired',
          paired_at: now,
          session_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', session.id)
        .eq('status', 'pending')
        .select('id')
        .single()

      if (claimError) {
        return NextResponse.json({ error: 'Failed to pair session' }, { status: 500 })
      }

      // Notify the web client immediately so the pairing state is not stuck waiting on a slow poll.
      const pairChannel = supabaseAdmin.channel(`proctor:${session.id}`, {
        config: { private: true },
      })
      await pairChannel.send({
        type: 'broadcast',
        event: 'paired',
        payload: {
          sessionId: session.id,
          status: 'paired',
          timestamp: new Date().toISOString(),
        },
      })

      return NextResponse.json({ success: true, sessionId: session.id, status: 'paired' })
    }

    if (action && ['start', 'pause', 'end'].includes(action)) {
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
      
      const newStatus = action === 'start' ? 'active' : action === 'pause' ? 'paused' : 'ended'
      const transitionTime = new Date().toISOString()
      const transitionFields = action === 'start'
        ? { started_at: transitionTime, paused_at: null }
        : action === 'pause'
          ? { paused_at: transitionTime }
          : { ended_at: transitionTime }
      
      const allowedCurrentStatuses = action === 'start'
        ? ['paired', 'paused', 'active']
        : action === 'pause'
          ? ['active', 'paused']
          : ['active', 'paused', 'paired']

      const { data, error: updateError } = await supabaseAdmin
        .from('proctor_sessions')
        .update({ status: newStatus, ...transitionFields })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .gt('session_expires_at', transitionTime)
        .in('status', allowedCurrentStatuses)
        .select('id')
        .single()
        
      if (updateError || !data) {
         return NextResponse.json({ error: 'Invalid session or illegal state transition' }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, status: newStatus })
    }
    const moduleId = body.moduleId
    const forceNew = body.forceNew === true

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    
    // If forceNew is true, expire existing pending sessions for this user/module
    if (forceNew) {
      await supabaseAdmin
        .from('proctor_sessions')
        .update({ status: 'expired' })
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .eq('status', 'pending')
    }

    // Reuse the same unfinished assessment after browser/mobile reload or crash.
    if (!forceNew) {
      const { data: existingSessions } = await supabaseAdmin
        .from('proctor_sessions')
        .select('id, token, status, pairing_expires_at, session_expires_at')
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .in('status', ['pending', 'paired', 'active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(5)

      const existingSession = existingSessions?.find((session) => {
        const expiry = session.status === 'pending'
          ? session.pairing_expires_at
          : session.session_expires_at
        return expiry && Date.parse(expiry) > Date.now()
      })

      if (existingSession) {
        const qrPayload = existingSession.status === 'pending'
          ? `lms://proctor/${existingSession.token}`
          : null
        return NextResponse.json({
          sessionId: existingSession.id,
          qrPayload,
          status: existingSession.status,
          expiresAt: existingSession.status === 'pending'
            ? existingSession.pairing_expires_at
            : existingSession.session_expires_at,
          sessionExpiresAt: existingSession.session_expires_at,
          reused: true,
        })
      }
    }

    const pairingToken = generatePairingToken()
    // Token expires in 15 minutes
    const pairingExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const sessionExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()

    const { data: insertedSession, error: insertError } = await supabaseAdmin
      .from('proctor_sessions')
      .insert({
        user_id: user.id,
        module_id: moduleId,
        token: pairingToken,
        // Keep expires_at populated for backwards compatibility while migration
        // 005 moves authorization to the two explicit expiry fields.
        expires_at: sessionExpiresAt,
        pairing_expires_at: pairingExpiresAt,
        session_expires_at: sessionExpiresAt,
      })
      .select('id')
      .single()

    if (insertError || !insertedSession) {
      console.error('[proctor-session] db error:', insertError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    const newSessionId = insertedSession.id
    const qrPayload = `lms://proctor/${pairingToken}`

    return NextResponse.json({ 
      sessionId: newSessionId, 
      qrPayload, 
      status: 'pending',
      expiresAt: pairingExpiresAt,
      sessionExpiresAt,
    })

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
      .select('id, status, token, pairing_expires_at, session_expires_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found or forbidden', code: 'SESSION_NOT_FOUND', terminal: true }, { status: 403 })
    }

    const relevantExpiry = session.status === 'pending'
      ? session.pairing_expires_at
      : session.session_expires_at
    if (!relevantExpiry || Date.parse(relevantExpiry) <= Date.now()) {
      return NextResponse.json({ error: 'Session expired', code: 'SESSION_EXPIRED', terminal: true }, { status: 410 })
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
      // The authenticated owner needs the pairing payload after a browser
      // refresh. Never expose it after pairing has completed.
      qrPayload: session.status === 'pending'
        ? `lms://proctor/${session.token}`
        : null,
      expiresAt: session.status === 'pending'
        ? session.pairing_expires_at
        : session.session_expires_at,
    })

  } catch (err) {
    console.error('[proctor-session] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
