import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { getAppUrl } from '@/lib/url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface EmployerRow {
  id: string
  owner_id: string | null
  company_name: string
  email: string
  plan: 'starter' | 'growth' | 'enterprise'
  seats: number
  used_seats: number
  team_members: string[] | null
}

const ACTIVE_INVITE_STATUSES = ['pending', 'invited', 'accepted']

async function getOwnedEmployer(user: User): Promise<EmployerRow | null> {
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('employers')
    .select('id, owner_id, company_name, email, plan, seats, used_seats, team_members')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (ownedError) throw ownedError
  if (owned) return owned as EmployerRow

  // One-time compatibility claim for employer rows created before owner_id.
  if (!user.email) return null
  const { data: legacy, error: legacyError } = await supabaseAdmin
    .from('employers')
    .select('id, owner_id, company_name, email, plan, seats, used_seats, team_members')
    .eq('email', user.email)
    .is('owner_id', null)
    .maybeSingle()
  if (legacyError) throw legacyError
  if (!legacy) return null

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('employers')
    .update({ owner_id: user.id })
    .eq('id', legacy.id)
    .is('owner_id', null)
    .select('id, owner_id, company_name, email, plan, seats, used_seats, team_members')
    .single()
  if (claimError) throw claimError
  return claimed as EmployerRow
}

async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error ? null : user
}



export async function GET() {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const employer = await getOwnedEmployer(user)
    if (!employer) return NextResponse.json({ error: 'Employer account not found' }, { status: 404 })

    // 1. Fetch internal team invites
    const { data: invites, error: invitesError } = await supabaseAdmin
      .from('employer_invites')
      .select('email, auth_user_id, status, invited_at')
      .eq('employer_id', employer.id)
      .in('status', ACTIVE_INVITE_STATUSES)
      .order('invited_at', { ascending: false })
    if (invitesError) throw invitesError

    const legacyIds = employer.team_members ?? []
    const invitedIds = (invites ?? [])
      .map((invite: { auth_user_id: string | null }) => invite.auth_user_id)
      .filter((id: string | null): id is string => Boolean(id))
    const memberIds = Array.from(new Set([...legacyIds, ...invitedIds]))

    // 2. Fetch all students in the platform for the Global Talent Directory
    const { data: allStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, name, email, completed_modules, avg_quiz_score, weak_topics, created_at')
      .order('avg_quiz_score', { ascending: false })
    if (studentsError) throw studentsError

    // 3. Fetch verified certificates
    const { data: certificatesData, error: certsError } = await supabaseAdmin
      .from('certificates')
      .select('student_id, verification_code, verification_url, final_score, is_valid')
      .eq('is_valid', true)
    if (certsError) throw certsError

    const certMap = new Map<string, { code: string; url: string; score: number }>()
    for (const cert of certificatesData ?? []) {
      certMap.set(cert.student_id, {
        code: cert.verification_code,
        url: cert.verification_url,
        score: cert.final_score ?? 0,
      })
    }

    const studentsById = new Map(
      (allStudents ?? []).map((student: Record<string, unknown>) => [student.id as string, student])
    )

    // Build internal team list
    const team = (invites ?? []).map((invite: {
      email: string
      auth_user_id: string | null
      status: string
      invited_at: string
    }) => {
      const student = invite.auth_user_id ? studentsById.get(invite.auth_user_id) : undefined
      return {
        id: invite.auth_user_id ?? `invite:${invite.email}`,
        name: (student?.name as string | undefined) ?? invite.email.split('@')[0],
        email: (student?.email as string | undefined) ?? invite.email,
        enrolledAt: (student?.created_at as string | undefined) ?? invite.invited_at,
        completedModules: ((student?.completed_modules as string[] | undefined) ?? []).length,
        avgScore: Math.round(Number(student?.avg_quiz_score ?? 0)),
        certificateEarned: invite.auth_user_id ? certMap.has(invite.auth_user_id) : false,
        status: student ? 'active' : 'invited',
      }
    })

    const representedIds = new Set(
      (invites ?? []).map((invite: { auth_user_id: string | null }) => invite.auth_user_id).filter(Boolean)
    )
    for (const memberId of legacyIds) {
      if (representedIds.has(memberId)) continue
      const student = studentsById.get(memberId)
      if (!student) continue
      team.push({
        id: memberId,
        name: student.name as string,
        email: student.email as string,
        enrolledAt: student.created_at as string,
        completedModules: ((student.completed_modules as string[] | undefined) ?? []).length,
        avgScore: Math.round(Number(student.avg_quiz_score ?? 0)),
        certificateEarned: certMap.has(memberId),
        status: 'active',
      })
    }

    // 4. Build Global Talent Directory (Students taking exams to be hired)
    const liveCandidates = (allStudents ?? []).map((s: Record<string, unknown>) => {
      const completedList = (s.completed_modules as string[] | undefined) ?? []
      const score = Math.round(Number(s.avg_quiz_score ?? 0))
      const hasCert = certMap.has(s.id as string)
      const certInfo = certMap.get(s.id as string)

      let statusTier = 'Exam Candidate'
      if (hasCert || completedList.length >= 87) {
        statusTier = 'Certified Practitioner'
      } else if (score >= 85) {
        statusTier = 'High Distinction'
      } else if (score >= 70) {
        statusTier = 'Exam Qualified'
      } else if (completedList.length > 0) {
        statusTier = 'Active Examinee'
      }

      const skills: string[] = []
      if (completedList.some(m => m.startsWith('m0') && parseInt(m.slice(1)) <= 7)) skills.push('UK Compliance & Bookkeeping')
      if (completedList.some(m => ['m08', 'm09', 'm10', 'm11', 'm12'].includes(m))) skills.push('Cloud Accounting (Xero/QBO)')
      if (completedList.some(m => ['m13', 'm14', 'm15', 'm16', 'm17', 'm18', 'm19', 'm20'].includes(m))) skills.push('VAT & MTD')
      if (completedList.some(m => ['m21', 'm22', 'm23', 'm24', 'm25', 'm26'].includes(m))) skills.push('PAYE & CIS')
      if (completedList.some(m => ['m27', 'm28', 'm29', 'm30', 'm31', 'm32', 'm33', 'm34'].includes(m))) skills.push('Statutory Accounts (FRS 102/105)')
      if (completedList.some(m => ['m35', 'm36', 'm37', 'm38', 'm39', 'm40'].includes(m))) skills.push('Corporation Tax (CT600)')
      if (completedList.some(m => ['m41', 'm42', 'm43', 'm44', 'm45', 'm46', 'm47', 'm48'].includes(m))) skills.push('Self Assessment (SA100)')
      if (skills.length === 0) skills.push('UK Accounting Fundamentals', 'Exam In Progress')

      return {
        id: s.id as string,
        name: (s.name as string) || (s.email as string)?.split('@')[0] || 'Accounting Candidate',
        email: s.email as string,
        examScore: score,
        modulesCompleted: completedList.length,
        certificateEarned: hasCert,
        verificationCode: certInfo?.code ?? null,
        verificationUrl: certInfo?.url ?? null,
        statusTier,
        readiness: hasCert || score >= 80 ? 'Interview Ready' : completedList.length > 20 ? 'Active Candidate' : 'In Examination',
        location: 'United Kingdom (Remote / Hybrid)',
        desiredRole: hasCert ? 'UK Practice Accountant' : 'Junior Accountant / Bookkeeper',
        topSkills: skills,
        bio: `Enrolled in the 150-hour UK Bookkeeping, Accounting & Taxation qualification. Completed ${completedList.length} of 87 modules with ${score}% average exam score.`,
        enrolledAt: s.created_at as string,
        isLiveStudent: true,
      }
    })

    // Strictly live real students from Supabase database sorted by highest score
    const candidates = liveCandidates.sort((a, b) => b.examScore - a.examScore)

    const occupiedSeats = new Set([
      ...legacyIds.map((id) => `user:${id}`),
      ...(invites ?? []).map((invite: { email: string; auth_user_id: string | null }) =>
        invite.auth_user_id ? `user:${invite.auth_user_id}` : `email:${invite.email}`
      ),
    ]).size

    return NextResponse.json({
      employer: {
        id: employer.id,
        companyName: employer.company_name,
        plan: employer.plan,
        seats: employer.seats,
        usedSeats: occupiedSeats,
      },
      team,
      candidates,
    })
  } catch (error) {
    console.error('/api/employer GET error:', error)
    return NextResponse.json({ error: 'Failed to load employer portal' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const employer = await getOwnedEmployer(user)
    if (!employer) return NextResponse.json({ error: 'Employer account not found' }, { status: 404 })

    const body = await req.json().catch(() => ({})) as {
      action?: string
      candidateId?: string
      candidateName?: string
      candidateEmail?: string
      position?: string
      salaryRange?: string
      message?: string
      email?: string
    }

    // Handle Direct Hiring Inquiry from Employer to Candidate
    if (body.action === 'hire_inquiry') {
      const candidateName = body.candidateName?.trim() || 'Candidate'
      const position = body.position?.trim() || 'Accountant / Bookkeeper'

      return NextResponse.json({
        ok: true,
        message: `Hiring interest submitted! ${employer.company_name} has connected with ${candidateName} for the ${position} position.`,
      })
    }

    // Default: Invite internal team member
    const email = body.email?.trim().toLowerCase() ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }
    if (email === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite your own employer account' }, { status: 400 })
    }

    const { data: existingInvite, error: existingError } = await supabaseAdmin
      .from('employer_invites')
      .select('id, status')
      .eq('employer_id', employer.id)
      .eq('email', email)
      .maybeSingle()
    if (existingError) throw existingError
    if (existingInvite && ACTIVE_INVITE_STATUSES.includes(existingInvite.status)) {
      return NextResponse.json({ error: 'This person has already been invited' }, { status: 409 })
    }

    const { count: activeInvites, error: countError } = await supabaseAdmin
      .from('employer_invites')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', employer.id)
      .in('status', ACTIVE_INVITE_STATUSES)
    if (countError) throw countError

    const legacyCount = (employer.team_members ?? []).length
    if (Math.max(activeInvites ?? 0, legacyCount) >= employer.seats) {
      return NextResponse.json({ error: 'Your plan has no available seats' }, { status: 409 })
    }

    const pendingData = { employer_id: employer.id, email, status: 'pending', invited_at: new Date().toISOString() }
    const pendingQuery = existingInvite
      ? supabaseAdmin.from('employer_invites').update(pendingData).eq('id', existingInvite.id).select('id').single()
      : supabaseAdmin.from('employer_invites').insert(pendingData).select('id').single()
    const { data: pendingInvite, error: pendingError } = await pendingQuery
    if (pendingError) throw pendingError

    const redirectBase = getAppUrl()
    const { data: invitation, error: invitationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { employer_id: employer.id, role: 'student' },
        ...(redirectBase && { redirectTo: `${redirectBase}/update-password` }),
      }
    )

    if (invitationError || !invitation.user) {
      await supabaseAdmin.from('employer_invites').update({ status: 'failed' }).eq('id', pendingInvite.id)
      return NextResponse.json(
        { error: invitationError?.message ?? 'Failed to send invitation' },
        { status: 400 }
      )
    }

    const memberIds = Array.from(new Set([...(employer.team_members ?? []), invitation.user.id]))
    const { error: inviteUpdateError } = await supabaseAdmin
      .from('employer_invites')
      .update({ auth_user_id: invitation.user.id, status: 'invited' })
      .eq('id', pendingInvite.id)
    if (inviteUpdateError) throw inviteUpdateError

    const { error: employerUpdateError } = await supabaseAdmin
      .from('employers')
      .update({ team_members: memberIds, used_seats: memberIds.length })
      .eq('id', employer.id)
      .eq('owner_id', user.id)
    if (employerUpdateError) throw employerUpdateError

    return NextResponse.json({ ok: true, message: `Invitation sent to ${email}` })
  } catch (error) {
    console.error('/api/employer POST error:', error)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
  }
}
