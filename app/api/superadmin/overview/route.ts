import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireSuperAdminUser } from '@/lib/superadmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const adminUser = await requireSuperAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Superadmin access required' }, { status: 403 })
    }

    // 1. Total students count
    const { count: studentCount } = await supabaseAdmin
      .from('students')
      .select('id', { count: 'exact', head: true })

    // 2. Total employers count
    const { count: employerCount } = await supabaseAdmin
      .from('employers')
      .select('id', { count: 'exact', head: true })

    // 3. Active sessions counts (web vs mobile)
    let activeWebCount = 0
    let activeMobileCount = 0
    try {
      const { data: activeSessions } = await supabaseAdmin
        .from('active_sessions')
        .select('platform, last_seen')

      if (activeSessions) {
        // Count sessions active in the last 15 minutes
        const cutoff = Date.now() - 15 * 60 * 1000
        for (const s of activeSessions) {
          const isActive = new Date(s.last_seen).getTime() > cutoff
          if (isActive) {
            if (s.platform === 'web') activeWebCount++
            else if (s.platform === 'mobile') activeMobileCount++
          }
        }
      }
    } catch {
      // ignore if active_sessions not migrated yet
    }

    // 4. Flagged security incidents count
    let flaggedCount = 0
    let recentFlagged: Record<string, unknown>[] = []
    try {
      const { count: fCount } = await supabaseAdmin
        .from('session_audit')
        .select('id', { count: 'exact', head: true })
        .eq('flagged', true)
      flaggedCount = fCount ?? 0

      const { data: fRecent } = await supabaseAdmin
        .from('session_audit')
        .select('id, user_id, platform, event_type, ip, country, city, flag_reason, created_at')
        .eq('flagged', true)
        .order('created_at', { ascending: false })
        .limit(6)
      recentFlagged = (fRecent as Record<string, unknown>[]) ?? []
    } catch {
      // ignore if table not migrated
    }

    // 5. Total Certificates Issued
    const { count: certCount } = await supabaseAdmin
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .eq('is_valid', true)

    return NextResponse.json({
      admin: {
        id: adminUser.id,
        email: adminUser.email,
      },
      metrics: {
        totalStudents: studentCount ?? 0,
        totalEmployers: employerCount ?? 0,
        activeWebSessions: activeWebCount,
        activeMobileSessions: activeMobileCount,
        flaggedIncidents: flaggedCount,
        totalCertificates: certCount ?? 0,
      },
      recentFlagged,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Superadmin overview error:', message)
    return NextResponse.json({ error: 'Failed to load superadmin overview' }, { status: 500 })
  }
}
