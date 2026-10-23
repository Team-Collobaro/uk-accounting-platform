import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export function getSuperAdminEmails(): string[] {
  const envVal = process.env.SUPERADMIN_EMAILS ?? ''
  const emails = envVal
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (!emails.includes('naja@teamcollaboro.com')) {
    emails.push('naja@teamcollaboro.com')
  }

  return emails
}

export async function isSuperAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false

  const userEmail = user.email.toLowerCase()

  // 1. Explicit environment variable whitelist
  const allowedEmails = getSuperAdminEmails()
  if (allowedEmails.includes(userEmail)) {
    return true
  }

  // 2. Metadata role check
  if (
    user.user_metadata?.role === 'superadmin' ||
    user.app_metadata?.role === 'superadmin'
  ) {
    return true
  }

  // 3. Database check on superadmins table
  try {
    const { data, error } = await supabaseAdmin
      .from('superadmins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!error && data) {
      return true
    }
  } catch {
    // Fail open only if database table is pending migration, but require metadata/env
  }

  // 4. In development mode fallback: if user email starts with admin or superadmin
  if (process.env.NODE_ENV !== 'production') {
    if (userEmail.startsWith('admin') || userEmail.startsWith('superadmin')) {
      return true
    }
  }

  return false
}

export async function requireSuperAdminUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const authorized = await isSuperAdmin(user)
  if (!authorized) return null

  return user
}
