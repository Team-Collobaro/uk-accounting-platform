import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

/**
 * Resolves a browser cookie session or a mobile Bearer token. Database work in
 * proctor routes must use supabaseAdmin after this check because a cookie-based
 * server client has no mobile JWT attached for RLS queries.
 */
export async function getProctorRequestUser(req: NextRequest): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length)
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return error ? null : data.user
}
