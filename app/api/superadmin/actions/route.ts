import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireSuperAdminUser } from '@/lib/superadmin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireSuperAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Superadmin access required' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      action: string
      userId?: string
      platform?: 'web' | 'mobile'
      employerId?: string
      plan?: string
      seats?: number
      adminEmail?: string
    }

    // 1. Action: Terminate a student's active session
    if (body.action === 'terminate_session') {
      const { userId, platform } = body
      if (!userId || !platform) {
        return NextResponse.json({ error: 'userId and platform are required' }, { status: 400 })
      }

      await supabaseAdmin
        .from('active_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform)

      try {
        await supabaseAdmin.from('session_audit').insert({
          user_id: userId,
          platform,
          event_type: 'admin_terminated',
          flagged: true,
          flag_reason: `Session terminated manually by Superadmin ${adminUser.email}`,
          metadata: { terminated_by: adminUser.email },
        })
      } catch {
        // ignore audit failure
      }

      return NextResponse.json({ success: true, message: `Terminated ${platform} session for student.` })
    }

    // 2. Action: Update Employer Plan / Seats
    if (body.action === 'update_employer') {
      const { employerId, plan, seats } = body
      if (!employerId) {
        return NextResponse.json({ error: 'employerId is required' }, { status: 400 })
      }

      const updates: Record<string, unknown> = {}
      if (plan) updates.plan = plan
      if (seats && typeof seats === 'number') updates.seats = seats

      const { error } = await supabaseAdmin
        .from('employers')
        .update(updates)
        .eq('id', employerId)

      if (error) throw error

      return NextResponse.json({ success: true, message: 'Employer updated successfully.' })
    }

    // 3. Action: Promote an existing user to Superadmin
    if (body.action === 'promote_admin') {
      const { adminEmail } = body
      if (!adminEmail) {
        return NextResponse.json({ error: 'adminEmail is required' }, { status: 400 })
      }

      const cleanEmail = adminEmail.trim().toLowerCase()
      // Find auth user
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
      const targetUser = usersData.users.find(u => u.email?.toLowerCase() === cleanEmail)

      if (!targetUser) {
        return NextResponse.json({ error: `User with email ${cleanEmail} not found.` }, { status: 404 })
      }

      const { error: insertErr } = await supabaseAdmin.from('superadmins').upsert({
        user_id: targetUser.id,
        email: cleanEmail,
        name: (targetUser.user_metadata?.name as string) ?? cleanEmail.split('@')[0],
        role: 'superadmin',
      }, { onConflict: 'user_id' })

      if (insertErr && insertErr.code !== 'PGRST205') {
        throw insertErr
      }

      // Also update user metadata role
      await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        user_metadata: { ...targetUser.user_metadata, role: 'superadmin' },
      })

      return NextResponse.json({ success: true, message: `Promoted ${cleanEmail} to Superadmin.` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Superadmin action error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
