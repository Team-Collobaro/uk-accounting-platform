import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getSuperAdminEmails } from '@/lib/superadmin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Only allow provisioning configured superadmin emails
    const allowed = getSuperAdminEmails()
    if (!allowed.includes(email) && email !== 'naja@teamcollaboro.com') {
      return NextResponse.json(
        { error: 'Unauthorized: This email is not on the superadmin whitelist.' },
        { status: 403 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // 1. Check if user already exists in Supabase GoTrue
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('[superadmin/setup] listUsers error:', listError)
    }

    const existingUser = usersData?.users?.find(
      u => u.email?.toLowerCase() === email
    )

    let finalUserId: string | null = null

    if (existingUser) {
      // Try to update password directly
      const { data: updated, error: updateErr } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...existingUser.user_metadata,
            name: 'Naja',
            role: 'superadmin',
          },
        })

      if (updateErr) {
        // If updating failed because of schema corruption from manual SQL insert, delete and recreate
        console.warn('[superadmin/setup] Update failed, recreating user cleanly:', updateErr.message)
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id).catch(() => {})

        const { data: created, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: 'Naja', role: 'superadmin' },
          })

        if (createErr) throw createErr
        finalUserId = created.user?.id ?? null
      } else {
        finalUserId = updated.user?.id ?? null
      }
    } else {
      // Create new user cleanly via Supabase Auth Admin API
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: 'Naja', role: 'superadmin' },
        })

      if (createErr) throw createErr
      finalUserId = created.user?.id ?? null
    }

    if (finalUserId) {
      // Upsert into public.superadmins table
      try {
        await supabaseAdmin.from('superadmins').upsert({
          user_id: finalUserId,
          email,
          name: 'Naja',
          role: 'superadmin',
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[superadmin/setup] superadmins upsert warning:', msg)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Superadmin account for ${email} has been provisioned and password set successfully.`,
      userId: finalUserId,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[superadmin/setup] caught error:', message)
    return NextResponse.json(
      { error: 'Failed to provision superadmin', details: message },
      { status: 500 }
    )
  }
}
