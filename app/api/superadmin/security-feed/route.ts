import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireSuperAdminUser } from '@/lib/superadmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireSuperAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Superadmin access required' }, { status: 403 })
    }

    const flaggedOnly = req.nextUrl.searchParams.get('flaggedOnly') === 'true'

    // 1. Fetch audit logs
    let auditQuery = supabaseAdmin
      .from('session_audit')
      .select('id, user_id, platform, session_id, event_type, ip, country, city, user_agent, flagged, flag_reason, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (flaggedOnly) {
      auditQuery = auditQuery.eq('flagged', true)
    }

    const { data: audits, error: auditErr } = await auditQuery
    if (auditErr && auditErr.code !== 'PGRST205') {
      throw auditErr
    }

    // 2. Fetch student names map for quick reference in feed
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name, email')

    const studentMap = new Map<string, { name: string; email: string }>()
    if (students) {
      for (const s of students) {
        studentMap.set(s.id, { name: s.name, email: s.email })
      }
    }

    // 3. Fetch active sessions snapshot
    let activeSessions: Record<string, unknown>[] = []
    try {
      const { data: act } = await supabaseAdmin
        .from('active_sessions')
        .select('*')
        .order('last_seen', { ascending: false })
      activeSessions = (act as Record<string, unknown>[]) ?? []
    } catch {
      // ignore
    }

    const enrichedAudits = (audits ?? []).map((log: Record<string, unknown>) => {
      const uid = log.user_id as string
      const st = studentMap.get(uid)
      return {
        ...log,
        studentName: st?.name ?? 'Unknown Student',
        studentEmail: st?.email ?? uid,
      }
    })

    const enrichedActiveSessions = activeSessions.map((sess) => {
      const uid = sess.user_id as string
      const st = studentMap.get(uid)
      return {
        ...sess,
        studentName: st?.name ?? 'Unknown Student',
        studentEmail: st?.email ?? uid,
      }
    })

    return NextResponse.json({
      audits: enrichedAudits,
      activeSessions: enrichedActiveSessions,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Superadmin security-feed error:', message)
    return NextResponse.json({ error: 'Failed to load security feed' }, { status: 500 })
  }
}
