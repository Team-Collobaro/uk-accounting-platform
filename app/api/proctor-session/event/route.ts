import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getProctorRequestUser } from '@/lib/proctorAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getProctorRequestUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', terminal: true }, { status: 401 })

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId', code: 'SESSION_ID_REQUIRED', terminal: true }, { status: 400 })

    const { data: session } = await supabaseAdmin
      .from('proctor_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      // The desktop subscribes while the QR is still pending. Reading the
      // owner's (empty) incident list during setup is safe and avoids a 403
      // loop before the phone has paired. Event creation remains restricted
      // to paired/active sessions in POST below.
      .in('status', ['pending', 'paired', 'active', 'paused'])
      .gt('session_expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found, inactive, or forbidden', code: 'SESSION_INACTIVE', terminal: true }, { status: 403 })
    }

    const { data: incidents, error } = await supabaseAdmin
      .from('proctor_events')
      .select('id,event_type,severity,source,metadata,incident_key,model_version,occurred_at,created_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'pending_review')
      .is('resolved_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[proctor-event] restore error:', error)
      return NextResponse.json({ error: 'Incident storage is temporarily unavailable', code: 'INCIDENT_STORE_UNAVAILABLE', terminal: false }, { status: 503 })
    }

    return NextResponse.json({ incidents: incidents || [] })
  } catch (err) {
    console.error('[proctor-event] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getProctorRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', terminal: true }, { status: 401 })
    }

    const {
      version = 1,
      sessionId,
      type,
      severity,
      confidence,
      source,
      description,
      metadata,
      incidentKey,
      modelVersion,
      occurredAt,
    } = await req.json()

    if (!sessionId || !type || !source) {
      return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 })
    }

    const allowedTypes = new Set([
      'second_phone', 'second_monitor', 'second_person', 'notes_visible',
      'student_missing', 'student_returned', 'second_person_cleared', 'suspicious_object',
      'static_image_spoof', 'student_mismatch', 'distance_invalid', 'camera_moved',
      'camera_obstructed', 'technical_error', 'clear',
    ])
    const allowedSeverities = new Set(['info', 'soft', 'warning', 'hard', 'technical'])

    if (typeof type !== 'string' || !allowedTypes.has(type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }
    if (severity != null && (typeof severity !== 'string' || !allowedSeverities.has(severity))) {
      return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
    }
    if (confidence != null && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      return NextResponse.json({ error: 'Invalid confidence' }, { status: 400 })
    }
    if (typeof source !== 'string' || source.length > 64 ||
        (description != null && (typeof description !== 'string' || description.length > 500))) {
      return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 })
    }
    if (!Number.isInteger(version) || version < 1 || version > 1 ||
        (incidentKey != null && (typeof incidentKey !== 'string' || incidentKey.length > 128)) ||
        (modelVersion != null && (typeof modelVersion !== 'string' || modelVersion.length > 128)) ||
        (occurredAt != null && (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))))) {
      return NextResponse.json({ error: 'Invalid incident lifecycle fields' }, { status: 400 })
    }

    // supabaseAdmin bypasses RLS, so ownership and state must be enforced here.
    const { data: session } = await supabaseAdmin
      .from('proctor_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .in('status', ['paired', 'active'])
      .gt('session_expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found, inactive, or forbidden', code: 'SESSION_INACTIVE', terminal: true }, { status: 403 })
    }

    if (type === 'student_returned' || type === 'second_person_cleared' || type === 'clear') {
      const resolvedAt = new Date().toISOString()
      const resolvedType = type === 'student_returned'
        ? 'student_missing'
        : type === 'second_person_cleared'
          ? 'second_person'
          : '*'
      let resolveQuery = supabaseAdmin
        .from('proctor_events')
        .update({ status: 'resolved', resolved_at: resolvedAt })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .eq('source', source)
        .eq('status', 'pending_review')
        .is('resolved_at', null)

      if (resolvedType !== '*') {
        resolveQuery = resolveQuery.eq('event_type', resolvedType)
      }

      const { error: resolveError } = await resolveQuery

      if (resolveError) {
        console.error('[proctor-event] resolve error:', resolveError)
        return NextResponse.json({ error: 'Incident storage is temporarily unavailable', code: 'INCIDENT_STORE_UNAVAILABLE', terminal: false }, { status: 503 })
      }

      await supabaseAdmin.channel(`proctor:${sessionId}`, {
        config: { private: true },
      }).send({
        type: 'broadcast',
        event: 'resolved',
        payload: {
          type,
          resolvesType: resolvedType,
          description: description || 'Mobile camera condition recovered',
          source,
          resolvedAt,
        }
      })

      return NextResponse.json({ success: true, resolvedType })
    }

    const normalizedIncidentKey = incidentKey || `${source}:${type}`

    // Repeated frames for one active condition must not create duplicate incidents.
    const { data: existingEvent } = await supabaseAdmin
      .from('proctor_events')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('incident_key', normalizedIncidentKey)
      .eq('status', 'pending_review')
      .is('resolved_at', null)
      .maybeSingle()

    if (existingEvent) {
      return NextResponse.json({ success: true, eventId: existingEvent.id, duplicate: true })
    }

    // Insert only after the explicit ownership/state check above.
    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from('proctor_events')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        event_type: type,
        severity,
        confidence,
        source,
        schema_version: version,
        incident_key: normalizedIncidentKey,
        model_version: modelVersion || null,
        occurred_at: occurredAt || new Date().toISOString(),
        metadata: {
          ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          description
        }
      })
      .select('id')
      .single()

    if (insertError?.code === '23505') {
      const { data: concurrentEvent } = await supabaseAdmin
        .from('proctor_events')
        .select('id')
        .eq('session_id', sessionId)
        .eq('incident_key', normalizedIncidentKey)
        .eq('status', 'pending_review')
        .is('resolved_at', null)
        .single()
      return NextResponse.json({ success: true, eventId: concurrentEvent?.id, duplicate: true })
    }
    if (insertError) {
      console.error('[proctor-event] db error:', insertError)
      return NextResponse.json({ error: 'Incident storage is temporarily unavailable', code: 'INCIDENT_STORE_UNAVAILABLE', terminal: false }, { status: 503 })
    }

    // Also broadcast to the active realtime channel so desktop UI updates instantly
    await supabaseAdmin.channel(`proctor:${sessionId}`, {
      config: { private: true },
    }).send({
      type: 'broadcast',
      event: 'violation',
      payload: {
        type,
        severity,
        confidence,
        description,
        source,
        eventId: insertedEvent.id,
        incidentKey: normalizedIncidentKey,
        modelVersion: modelVersion || null,
        occurredAt: occurredAt || null,
      }
    })

    return NextResponse.json({ success: true, eventId: insertedEvent.id })

  } catch (err) {
    console.error('[proctor-event] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
