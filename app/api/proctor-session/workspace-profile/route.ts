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

    const body = await req.json()
    const { sessionId, profile } = body

    if (!sessionId || !profile) {
      return NextResponse.json({ error: 'sessionId and profile required' }, { status: 400 })
    }

    // Confirm session ownership and status
    const { data: session, error: fetchError } = await supabaseAdmin
      .from('proctor_sessions')
      .select('id, user_id, status, session_expires_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found or forbidden' }, { status: 403 })
    }

    if (!['paired', 'active', 'paused'].includes(session.status) ||
        !session.session_expires_at ||
        Date.parse(session.session_expires_at) <= Date.now()) {
       return NextResponse.json({ error: 'Session is not active or paired' }, { status: 400 })
    }

    // Validate coordinates (naive validation)
    const validateRect = (rect: any) => {
        if (!rect) return false;
        return typeof rect.left === 'number' && rect.left >= 0 && rect.left <= 1 &&
               typeof rect.right === 'number' && rect.right >= 0 && rect.right <= 1 &&
               typeof rect.top === 'number' && rect.top >= 0 && rect.top <= 1 &&
               typeof rect.bottom === 'number' && rect.bottom >= 0 && rect.bottom <= 1 &&
               rect.left < rect.right && rect.top < rect.bottom;
    }

    if (!validateRect(profile.studentZone) ||
        !validateRect(profile.deskZone) ||
        !validateRect(profile.expectedDeviceZone) ||
        !validateRect(profile.roomZone)) {
        return NextResponse.json({ error: 'Invalid zone coordinates' }, { status: 400 })
    }

    // Update session
    const { error: updateError } = await supabaseAdmin
      .from('proctor_sessions')
      .update({
        workspace_profile: profile,
      })
      .eq('id', sessionId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update workspace profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('[workspace-profile] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
