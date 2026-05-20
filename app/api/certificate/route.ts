import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getStudent, supabaseAdmin } from '@/lib/supabase-server'
import { isEligible, generateCertificate } from '@/lib/certificate'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const student = await getStudent(user.id)

    // Check all 87 modules completed
    if (student.completedModules.length < 87) {
      return NextResponse.json(
        {
          error: 'Not yet eligible',
          completed: student.completedModules.length,
          required: 87,
        },
        { status: 403 }
      )
    }

    // Check final exam eligibility
    const eligible = await isEligible(user.id)
    if (!eligible) {
      return NextResponse.json(
        { error: 'Final module quiz must be passed with 70% or above' },
        { status: 403 }
      )
    }

    // Check for existing certificate
    const { data: existing } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('student_id', user.id)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json({ certificate: existing, alreadyIssued: true })
    }

    // Calculate final score (average of all quiz results)
    const { data: quizResults } = await supabaseAdmin
      .from('quiz_results')
      .select('percentage')
      .eq('student_id', user.id)

    const scores = (quizResults ?? []).map((r: { percentage: number }) => Number(r.percentage))
    const finalScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : student.avgQuizScore

    const certificate = await generateCertificate(student, finalScore)

    return NextResponse.json({ certificate, alreadyIssued: false })
  } catch (err) {
    console.error('/api/certificate error:', err)
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: certificates } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('student_id', user.id)

    return NextResponse.json({ certificates: certificates ?? [] })
  } catch (err) {
    console.error('/api/certificate GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 })
  }
}
