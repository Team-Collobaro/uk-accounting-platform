import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/superadmin'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    let user = null

    // 1. Check Bearer token first
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length)
      const { data: authData } = await supabaseAdmin.auth.getUser(token)
      user = authData?.user ?? null
    }

    // 2. Check cookies if no Bearer token
    if (!user) {
      const supabase = await createServerSupabaseClient()
      const { data: authData } = await supabase.auth.getUser()
      user = authData?.user ?? null
    }

    if (!user) {
      return NextResponse.json({ isAdmin: false }, { status: 200 })
    }

    const isAdmin = await isSuperAdmin(user)
    return NextResponse.json({ isAdmin }, { status: 200 })
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 200 })
  }
}
