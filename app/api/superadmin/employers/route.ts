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

    // 1. Fetch all employers
    const { data: employers, error: empErr } = await supabaseAdmin
      .from('employers')
      .select('id, owner_id, company_name, email, plan, seats, used_seats, team_members, created_at')
      .order('created_at', { ascending: false })

    if (empErr) throw empErr

    // 2. Fetch all employer invites to calculate accurate seat usage and member details
    const { data: invites } = await supabaseAdmin
      .from('employer_invites')
      .select('id, employer_id, email, auth_user_id, status, invited_at')

    const invitesByEmployer = new Map<string, Array<Record<string, unknown>>>()
    if (invites) {
      for (const inv of invites) {
        const list = invitesByEmployer.get(inv.employer_id) ?? []
        list.push(inv as Record<string, unknown>)
        invitesByEmployer.set(inv.employer_id, list)
      }
    }

    const enhancedEmployers = (employers ?? []).map((emp: Record<string, unknown>) => {
      const id = emp.id as string
      const empInvites = invitesByEmployer.get(id) ?? []
      const legacyMembers = (emp.team_members as string[] | undefined) ?? []
      
      const distinctOccupiedSeats = new Set([
        ...legacyMembers.map((m) => `member:${m}`),
        ...empInvites
          .filter((inv) => ['pending', 'invited', 'accepted'].includes(inv.status as string))
          .map((inv) => (inv.auth_user_id ? `user:${inv.auth_user_id}` : `email:${inv.email}`)),
      ]).size

      return {
        id,
        ownerId: emp.owner_id as string | null,
        companyName: emp.company_name as string,
        email: emp.email as string,
        plan: (emp.plan as string) || 'starter',
        seats: Number(emp.seats ?? 5),
        usedSeats: Math.max(distinctOccupiedSeats, Number(emp.used_seats ?? 0)),
        invitesCount: empInvites.length,
        invites: empInvites,
        createdAt: emp.created_at as string,
      }
    })

    return NextResponse.json({
      employers: enhancedEmployers,
      total: enhancedEmployers.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Superadmin employers error:', message)
    return NextResponse.json({ error: 'Failed to load employers' }, { status: 500 })
  }
}
