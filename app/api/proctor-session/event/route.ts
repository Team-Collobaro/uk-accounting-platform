import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getProctorRequestUser } from '@/lib/proctorAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getProctorRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, type, severity, confidence, source, description, metadata } = await req.json()

    if (!sessionId || !type || !source) {
      return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 })
    }

    // Insert the event (RLS/Trigger will reject if session isn't active and owned by user)
    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from('proctor_events')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        event_type: type,
        severity,
        confidence,
        source,
        metadata: {
          ...metadata,
          description
        }
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[proctor-event] db error:', insertError)
      return NextResponse.json({ error: 'Failed to record event' }, { status: 400 })
    }

    // Also broadcast to the active realtime channel so desktop UI updates instantly
    await supabaseAdmin.channel(`proctor:${sessionId}`).send({
      type: 'broadcast',
      event: 'violation',
      payload: {
        type,
        severity,
        confidence,
        description,
        source,
        eventId: insertedEvent.id
      }
    })

    return NextResponse.json({ success: true, eventId: insertedEvent.id })

  } catch (err) {
    console.error('[proctor-event] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
