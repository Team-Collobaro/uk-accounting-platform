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

    // 1. Fetch all students
    const { data: students, error: studentErr } = await supabaseAdmin
      .from('students')
      .select('id, name, email, completed_modules, avg_quiz_score, weak_topics, total_tokens_used, created_at')
      .order('created_at', { ascending: false })

    if (studentErr) throw studentErr

    // 2. Fetch active sessions
    let sessionsByUser = new Map<string, Array<Record<string, unknown>>>()
    try {
      const { data: activeSessions } = await supabaseAdmin
        .from('active_sessions')
        .select('*')

      if (activeSessions) {
        for (const s of activeSessions) {
          const list = sessionsByUser.get(s.user_id) ?? []
          list.push(s as Record<string, unknown>)
          sessionsByUser.set(s.user_id, list)
        }
      }
    } catch {
      // ignore if active_sessions table not migrated
    }

    // 3. Fetch flagged incident counts per student
    let flaggedCountByUser = new Map<string, number>()
    try {
      const { data: flaggedAudits } = await supabaseAdmin
        .from('session_audit')
        .select('user_id')
        .eq('flagged', true)

      if (flaggedAudits) {
        for (const item of flaggedAudits) {
          const current = flaggedCountByUser.get(item.user_id) ?? 0
          flaggedCountByUser.set(item.user_id, current + 1)
        }
      }
    } catch {
      // ignore
    }

    // 4. Fetch valid certificates
    let certSet = new Set<string>()
    try {
      const { data: certs } = await supabaseAdmin
        .from('certificates')
        .select('student_id')
        .eq('is_valid', true)

      if (certs) {
        for (const c of certs) {
          certSet.add(c.student_id)
        }
      }
    } catch {
      // ignore
    }

    // Combine student data
    const enhancedStudents = (students ?? []).map((s: Record<string, unknown>) => {
      const id = s.id as string
      const activeList = sessionsByUser.get(id) ?? []
      const completedModules = (s.completed_modules as string[] | undefined) ?? []
      const avgScore = Math.round(Number(s.avg_quiz_score ?? 0))
      const flaggedCount = flaggedCountByUser.get(id) ?? 0
      const hasCertificate = certSet.has(id)

      return {
        id,
        name: (s.name as string) || (s.email as string)?.split('@')[0] || 'Student',
        email: s.email as string,
        modulesCompleted: completedModules.length,
        totalModules: 87,
        avgScore,
        weakTopics: (s.weak_topics as string[] | undefined) ?? [],
        totalTokens: Number(s.total_tokens_used ?? 0),
        hasCertificate,
        flaggedIncidents: flaggedCount,
        activeSessions: activeList,
        isOnline: activeList.some((sess) => {
          const lastSeen = sess.last_seen as string
          return lastSeen && Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000
        }),
        createdAt: s.created_at as string,
      }
    })

    return NextResponse.json({
      students: enhancedStudents,
      total: enhancedStudents.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Superadmin students error:', message)
    return NextResponse.json({ error: 'Failed to load students' }, { status: 500 })
  }
}
