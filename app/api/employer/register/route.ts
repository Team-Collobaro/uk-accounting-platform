import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Default allocation for self-serve employer sign-ups.
const DEFAULT_PLAN = 'starter'
const DEFAULT_SEATS = 5

/**
 * Creates the employer (company) record for the signed-in employer account.
 * Idempotent: safe to call on sign-up and again on first sign-in (for flows
 * where email confirmation delays the session).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.user_metadata?.role !== 'employer') {
      return NextResponse.json({ error: 'This account is not an employer account' }, { status: 403 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('employers')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) return NextResponse.json({ ok: true, employerId: existing.id })

    const body = await req.json().catch(() => ({})) as { companyName?: string }
    const companyName = (
      body.companyName?.trim() ||
      (user.user_metadata?.company_name as string | undefined)?.trim() ||
      ''
    ).slice(0, 160)
    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('employers')
      .insert({
        owner_id: user.id,
        company_name: companyName,
        email: user.email.toLowerCase(),
        plan: DEFAULT_PLAN,
        seats: DEFAULT_SEATS,
        used_seats: 0,
        team_members: [],
      })
      .select('id')
      .single()

    // Unique owner index race: another request created it first.
    if (insertError?.code === '23505') return NextResponse.json({ ok: true })
    if (insertError) throw insertError

    return NextResponse.json({ ok: true, employerId: created.id })
  } catch (error) {
    console.error('/api/employer/register error:', error)
    return NextResponse.json({ error: 'Failed to create employer account' }, { status: 500 })
  }
}
