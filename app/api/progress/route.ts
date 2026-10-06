import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getStudent, getModuleProgress, supabaseAdmin } from '@/lib/supabase-server'
import { getStudentCost } from '@/lib/costTracker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [student, moduleProgress, costReport] = await Promise.all([
      getStudent(user.id),
      getModuleProgress(user.id),
      getStudentCost(user.id),
    ])

    const { data: quizResults } = await supabaseAdmin
      .from('quiz_results')
      .select('*')
      .eq('student_id', user.id)
      .order('completed_at', { ascending: false })

    const { data: certificates } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_valid', true)

    // Determine next recommended module
    const completedSet = new Set(
      moduleProgress
        .filter((progress) => progress.status === 'completed')
        .map((progress) => progress.moduleId)
    )
    const completedModules = Array.from(completedSet).sort()
    let nextRecommendedModule = 'm01'
    for (let i = 1; i <= 87; i++) {
      const id = `m${String(i).padStart(2, '0')}`
      if (!completedSet.has(id)) {
        nextRecommendedModule = id
        break
      }
    }

    const overallPercentage = Math.round((completedModules.length / 87) * 100)

    return NextResponse.json({
      completedModules,
      moduleProgress,
      quizResults: quizResults ?? [],
      certificates: certificates ?? [],
      totalCost: costReport.totalCostUsd,
      nextRecommendedModule,
      overallPercentage,
      weakTopics: student.weakTopics,
      avgQuizScore: student.avgQuizScore,
    })
  } catch (err) {
    console.error('/api/progress error:', err)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Module completion is an assessment result, not a client-controlled state.
    // Section completion belongs to /api/notes; passed quizzes update modules internally.
    return NextResponse.json(
      { error: 'Module completion can only be recorded by a passed quiz' },
      { status: 403 }
    )
  } catch (err) {
    console.error('/api/progress POST error:', err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
