import { supabaseAdmin } from '@/lib/supabase-server'

export interface ClientGeoInfo {
  ip: string
  country: string | null
  city: string | null
  userAgent: string
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8')
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function extractSessionId(token: string): string | null {
  const payload = parseJwtPayload(token)
  if (!payload) return null
  return (payload.session_id as string) ?? (payload.sub as string) ?? null
}

export function getClientGeoInfo(headers: Headers): ClientGeoInfo {
  const forwarded = headers.get('x-forwarded-for')
  const ip =
    (forwarded ? forwarded.split(',')[0].trim() : null) ??
    headers.get('x-real-ip') ??
    '127.0.0.1'

  const country = headers.get('x-vercel-ip-country') ?? null
  const city = headers.get('x-vercel-ip-city') ?? null
  const userAgent = headers.get('user-agent') ?? 'unknown'

  return { ip, country, city, userAgent }
}

export async function registerActiveSession(params: {
  userId: string
  platform: 'web' | 'mobile'
  sessionId: string
  geo: ClientGeoInfo
}) {
  const { userId, platform, sessionId, geo } = params

  try {
    // 1. Fetch previous session to detect location changes / superseded logins
    const { data: previous, error: fetchError } = await supabaseAdmin
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST205') {
      console.warn('[Session] Error fetching previous session:', fetchError.message)
    }

    let flagged = false
    let flagReason: string | null = null

    if (previous) {
      // Flag impossible travel or country shift if both country records exist and differ
      if (
        previous.current_country &&
        geo.country &&
        previous.current_country !== geo.country
      ) {
        const timeDiffMinutes =
          (Date.now() - new Date(previous.updated_at).getTime()) / (1000 * 60)
        
        // Flag-only mode as requested: logs the suspicious event without locking user out
        flagged = true
        flagReason = `Rapid country switch from ${previous.current_country} (${previous.current_city || 'unknown'}) to ${geo.country} (${geo.city || 'unknown'}) within ${Math.round(timeDiffMinutes)}m.`
      }

      // If there was an existing active session with a different session ID, record it as superseded
      if (previous.session_id && previous.session_id !== sessionId) {
        try {
          await supabaseAdmin.from('session_audit').insert({
            user_id: userId,
            platform,
            session_id: previous.session_id,
            event_type: 'superseded',
            ip: previous.current_ip,
            country: previous.current_country,
            city: previous.current_city,
            user_agent: previous.user_agent,
            flagged: false,
            flag_reason: null,
            metadata: { new_session_id: sessionId },
          })
        } catch {
          // ignore audit insert error
        }
      }
    }

    // 2. Upsert active_sessions row
    const nowIso = new Date().toISOString()
    const { error: upsertError } = await supabaseAdmin.from('active_sessions').upsert(
      {
        user_id: userId,
        platform,
        session_id: sessionId,
        current_ip: geo.ip,
        current_country: geo.country,
        current_city: geo.city,
        user_agent: geo.userAgent,
        last_seen: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'user_id,platform' }
    )

    if (upsertError && upsertError.code !== 'PGRST205') {
      console.warn('[Session] Upsert active_sessions failed:', upsertError.message)
    }

    // 3. Insert audit log for this login
    try {
      await supabaseAdmin.from('session_audit').insert({
        user_id: userId,
        platform,
        session_id: sessionId,
        event_type: 'login',
        ip: geo.ip,
        country: geo.country,
        city: geo.city,
        user_agent: geo.userAgent,
        flagged,
        flag_reason: flagReason,
        metadata: {
          previous_session_id: previous?.session_id ?? null,
          previous_country: previous?.current_country ?? null,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[Session] Audit log insert failed:', msg)
    }

    return { success: true, flagged, flagReason }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Session] registerActiveSession caught error:', message)
    return { success: false, error: message }
  }
}

export async function processHeartbeat(params: {
  userId: string
  platform: 'web' | 'mobile'
  sessionId: string
  geo: ClientGeoInfo
}) {
  const { userId, platform, sessionId, geo } = params

  try {
    const { data: row, error } = await supabaseAdmin
      .from('active_sessions')
      .select('session_id, current_country, current_city, current_ip, last_seen')
      .eq('user_id', userId)
      .eq('platform', platform)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST205') {
        // Table not migrated yet
        return { valid: true }
      }
      return { valid: true }
    }

    // If no row exists yet (e.g. session active before feature was launched), register it now
    if (!row) {
      await registerActiveSession({ userId, platform, sessionId, geo })
      return { valid: true }
    }

    // Single active login enforcement:
    // If the registered session ID differs from this client's session ID,
    // this client has been superseded by a newer login!
    if (row.session_id !== sessionId) {
      return {
        valid: false,
        reason: 'superseded',
        message: 'Your account was logged in from another device or window.',
      }
    }

    // Location change check during active session
    let locationChanged = false
    let changeReason: string | null = null

    if (
      row.current_country &&
      geo.country &&
      row.current_country !== geo.country
    ) {
      locationChanged = true
      changeReason = `Country changed from ${row.current_country} to ${geo.country} during active session.`
    } else if (
      row.current_city &&
      geo.city &&
      row.current_city !== geo.city &&
      geo.ip !== row.current_ip
    ) {
      locationChanged = true
      changeReason = `City changed from ${row.current_city} to ${geo.city} (IP: ${row.current_ip} -> ${geo.ip}) during active session.`
    }

    if (locationChanged) {
      // Flag-only mode per user requirement: Record the event in session_audit without kicking student out
      try {
        await supabaseAdmin.from('session_audit').insert({
          user_id: userId,
          platform,
          session_id: sessionId,
          event_type: 'heartbeat_location_change',
          ip: geo.ip,
          country: geo.country,
          city: geo.city,
          user_agent: geo.userAgent,
          flagged: true,
          flag_reason: changeReason,
          metadata: {
            previous_ip: row.current_ip,
            previous_country: row.current_country,
            previous_city: row.current_city,
          },
        })
      } catch {
        // ignore audit failure
      }
    }

    // Update last_seen and current IP/geo
    const nowIso = new Date().toISOString()
    try {
      await supabaseAdmin
        .from('active_sessions')
        .update({
          last_seen: nowIso,
          current_ip: geo.ip,
          current_country: geo.country,
          current_city: geo.city,
          user_agent: geo.userAgent,
          updated_at: locationChanged ? nowIso : undefined,
        })
        .eq('user_id', userId)
        .eq('platform', platform)
    } catch {
      // ignore update failure
    }

    return { valid: true, flagged: locationChanged }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Session] processHeartbeat caught error:', message)
    return { valid: true }
  }
}
