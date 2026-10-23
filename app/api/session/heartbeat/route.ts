import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import {
  getClientGeoInfo,
  extractSessionId,
  processHeartbeat,
} from '@/lib/sessionManagement'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      platform?: 'web' | 'mobile'
      sessionId?: string
    }

    const platform: 'web' | 'mobile' = body.platform === 'mobile' ? 'mobile' : 'web'

    let userId: string | null = null
    let sessionId: string | null = body.sessionId ?? null

    // 1. Bearer token
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length)
      const { data: authData, error } = await supabaseAdmin.auth.getUser(token)
      if (!error && authData?.user) {
        userId = authData.user.id
        const extracted = extractSessionId(token)
        if (extracted) sessionId = extracted
      }
    }

    // 2. Browser cookies
    if (!userId) {
      const supabase = await createServerSupabaseClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!userError && user) {
        userId = user.id
        if (!sessionId) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.access_token) {
            const extracted = extractSessionId(session.access_token)
            if (extracted) sessionId = extracted
          }
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    if (!sessionId) {
      sessionId = userId
    }

    const geo = getClientGeoInfo(req.headers)

    const result = await processHeartbeat({
      userId,
      platform,
      sessionId,
      geo,
    })

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          reason: result.reason,
          message: result.message,
        },
        { status: 409 } // 409 Conflict: session superseded elsewhere
      )
    }

    return NextResponse.json({
      valid: true,
      flagged: result.flagged,
      ip: geo.ip,
      country: geo.country,
      city: geo.city,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[session/heartbeat] error:', message)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
