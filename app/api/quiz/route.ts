import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { searchSimilar } from '@/lib/retrieval'
import { generateQuiz } from '@/lib/anthropic'
import { logUsage } from '@/lib/costTracker'
import {
  MODULE_ID_PATTERN,
  QUIZ_ATTEMPT_MINUTES,
  publicQuizQuestions,
  validateGeneratedQuiz,
} from '@/lib/quiz-security'
import { canAccessModule, previousModuleId } from '@/lib/course-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      moduleId: string
      moduleTitle?: string
      partNumber?: number
      partTitle?: string
      count?: number
    }

    const { moduleId, moduleTitle, partNumber, partTitle } = body
    const count = Number.isInteger(body.count) ? Math.min(10, Math.max(1, body.count!)) : 5

    if (!MODULE_ID_PATTERN.test(moduleId ?? '')) {
      return NextResponse.json({ error: 'A valid moduleId is required' }, { status: 400 })
    }
    if (!await canAccessModule(user.id, moduleId)) {
      return NextResponse.json(
        { error: 'Complete the previous module assessment first', prerequisite: previousModuleId(moduleId) },
        { status: 403 }
      )
    }

    // Fetch top 8 chunks for richer quiz context
    const chunks = await searchSimilar(moduleId, moduleId, 12)
    const learningChunks = chunks
      .filter((chunk) => chunk.sectionTitle.trim().toLowerCase() !== 'knowledge check')
      .slice(0, 8)
    const ragContext = learningChunks.map((chunk) => chunk.content).join('\n\n---\n\n')

    if (!ragContext.trim()) {
      return NextResponse.json({ error: 'No learning content is available for this module' }, { status: 404 })
    }

    const mod = {
      id: moduleId,
      title: moduleTitle ?? moduleId,
      partNumber: partNumber ?? 1,
      partTitle: partTitle ?? '',
      content: ragContext,
      order: 0,
    }

    const generatedQuestions = await generateQuiz({ module: mod, ragContext, count })
    const questions = validateGeneratedQuiz(generatedQuestions, count)
    const expiresAt = new Date(Date.now() + QUIZ_ATTEMPT_MINUTES * 60_000).toISOString()

    // Full questions, including the answer key, stay in a service-role-only table.
    const { error: expireError } = await supabaseAdmin
      .from('quiz_attempts')
      .update({ status: 'expired' })
      .eq('student_id', user.id)
      .eq('module_id', moduleId)
      .eq('status', 'active')
    if (expireError) throw expireError

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({ student_id: user.id, module_id: moduleId, questions, expires_at: expiresAt })
      .select('id, expires_at')
      .single()
    if (attemptError) throw attemptError

    // Log approximate token usage (quiz generation ~800 input, ~500 output)
    try {
      await logUsage(user.id, 'quiz-' + moduleId + '-' + Date.now(), 800, 500)
    } catch (logErr) {
      console.warn('Failed to log token usage:', logErr)
    }

    return NextResponse.json({
      attemptId: attempt.id,
      expiresAt: attempt.expires_at,
      questions: publicQuizQuestions(questions),
    })
  } catch (err: unknown) {
    console.error('/api/quiz error:', err)
    return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 })
  }
}
