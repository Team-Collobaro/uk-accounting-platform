import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { name?: string }
    const metadataName = [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ')
    const name = (body.name?.trim() || metadataName || user.email.split('@')[0]).slice(0, 120)

    const { error } = await supabaseAdmin.from('students').insert({
      id: user.id,
      name,
      email: user.email,
      enrolled_courses: ['uk-accounting'],
      completed_modules: [],
      weak_topics: [],
      avg_quiz_score: 0,
      total_tokens_used: 0,
    })

    if (error && error.code !== '23505') throw error

    // Mark a server-created employer invitation as accepted when the learner
    // first establishes their profile. This is best-effort profile metadata.
    const { error: inviteError } = await supabaseAdmin
      .from('employer_invites')
      .update({ status: 'accepted', auth_user_id: user.id, accepted_at: new Date().toISOString() })
      .eq('email', user.email.toLowerCase())
      .in('status', ['pending', 'invited'])
    if (inviteError) console.warn('Failed to update employer invitation:', inviteError)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('/api/register error:', err)
    return NextResponse.json({ error: 'Failed to create student profile' }, { status: 500 })
  }
}
