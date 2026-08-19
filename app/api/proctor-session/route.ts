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
        .gt('expires_at', now)
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
        .update({ status: 'paired' })
        .eq('id', session.id)

      if (claimError) {
        return NextResponse.json({ error: 'Failed to pair session' }, { status: 500 })
      }

      // Notify the web client immediately so the pairing state is not stuck waiting on a slow poll.
      const pairChannel = supabaseAdmin.channel(`proctor:${session.id}`)
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

    // BUG 6 FIX: Reuse existing pending/paired session for this user+module
    if (!forceNew) {
      const { data: existingSession } = await supabaseAdmin
        .from('proctor_sessions')
        .select('id, token, status, expires_at')
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
          expiresAt: existingSession.expires_at,
          reused: true,
        })
      }
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

    return NextResponse.json({ 
      sessionId: newSessionId, 
      qrPayload, 
      status: 'pending',
      expiresAt 
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
