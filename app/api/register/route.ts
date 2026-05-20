import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { userId: string; name: string; email: string }
    const { userId, name, email } = body

    if (!userId || !name || !email) {
      return NextResponse.json({ error: 'userId, name and email are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('students').insert({
      id: userId,
      name,
      email,
      enrolled_courses: ['uk-accounting'],
      completed_modules: [],
      weak_topics: [],
      avg_quiz_score: 0,
      total_tokens_used: 0,
    })

    if (error) {
      // Ignore duplicate — user may have refreshed
      if (error.code === '23505') {
        return NextResponse.json({ ok: true })
      }
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('/api/register error:', err)
    return NextResponse.json({ error: 'Failed to create student profile' }, { status: 500 })
  }
}
