import { NextRequest, NextResponse } from 'next/server'
import {
  createServerSupabaseClient,
  getStudent,
  saveQuizResult,
  updateModuleProgress,
  updateStudent,
  supabaseAdmin,
} from '@/lib/supabase-server'
import { analyseProgress } from '@/lib/anthropic'
import { isEligible, generateCertificate } from '@/lib/certificate'
import {
  QUIZ_PASS_PERCENTAGE,
  normaliseQuizChoice,
  validateGeneratedQuiz,
  validateQuizAnswers,
} from '@/lib/quiz-security'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface QuizAttemptRow {
  id: string
  module_id: string
  questions: unknown
  status: 'active' | 'submitted' | 'expired'
  expires_at: string
}

function databaseErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code)
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { attemptId?: string; answers?: unknown }
    if (!body.attemptId || typeof body.attemptId !== 'string') {
      return NextResponse.json({ error: 'attemptId and answers are required' }, { status: 400 })
    }

    const { data, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .select('id, module_id, questions, status, expires_at')
      .eq('id', body.attemptId)
      .eq('student_id', user.id)
      .maybeSingle()

    if (attemptError) throw attemptError
    if (!data) return NextResponse.json({ error: 'Quiz attempt not found' }, { status: 404 })

    const attempt = data as QuizAttemptRow
    if (attempt.status === 'submitted') {
      return NextResponse.json({ error: 'Quiz attempt has already been submitted' }, { status: 409 })
    }
    if (attempt.status === 'expired' || new Date(attempt.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from('quiz_attempts').update({ status: 'expired' }).eq('id', attempt.id)
      return NextResponse.json({ error: 'Quiz attempt has expired' }, { status: 410 })
    }

    const storedQuestionCount = Array.isArray(attempt.questions) ? attempt.questions.length : 0
    const questions = validateGeneratedQuiz(attempt.questions, storedQuestionCount)
    let answers: Record<string, string>
    try {
      answers = validateQuizAnswers(body.answers, questions)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Answers are invalid' },
        { status: 400 }
      )
    }

    let score = 0
    const weakAreas: string[] = []
    const explanations: Record<string, { correct: string; explanation: string; userAnswer: string }> = {}

    for (const question of questions) {
      const userAnswer = answers[question.id] ?? ''
      const isCorrect = normaliseQuizChoice(userAnswer) === normaliseQuizChoice(question.correct)
      if (isCorrect) {
        score++
      } else if (question.topic && !weakAreas.includes(question.topic)) {
        weakAreas.push(question.topic)
      }
      explanations[question.id] = {
        correct: question.correct,
        explanation: question.explanation,
        userAnswer,
      }
    }

    const total = questions.length
    const percentage = Math.round((score / total) * 100)
    const passed = percentage >= QUIZ_PASS_PERCENTAGE
    const student = await getStudent(user.id)

    let result
    try {
      result = await saveQuizResult({
        attemptId: attempt.id,
        studentId: user.id,
        moduleId: attempt.module_id,
        score,
        total,
        percentage,
        passed,
        weakAreas,
        answers,
      })
    } catch (error) {
      if (databaseErrorCode(error) === '23505') {
        return NextResponse.json({ error: 'Quiz attempt has already been submitted' }, { status: 409 })
      }
      throw error
    }

    const { error: submittedError } = await supabaseAdmin
      .from('quiz_attempts')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', attempt.id)
      .eq('status', 'active')
    if (submittedError) console.error('Failed to close quiz attempt:', submittedError)

    if (passed) {
      await updateModuleProgress(user.id, attempt.module_id, {
        status: 'completed',
        quizScore: score,
        completedAt: new Date().toISOString(),
      })
    } else if (!student.completedModules.includes(attempt.module_id)) {
      await updateModuleProgress(user.id, attempt.module_id, {
        status: 'in_progress',
        quizScore: score,
      })
    }

    const allResults = await supabaseAdmin
      .from('quiz_results')
      .select('percentage')
      .eq('student_id', user.id)
    if (allResults.error) throw allResults.error

    const scores = (allResults.data ?? []).map((row: { percentage: number }) => Number(row.percentage))
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : 0
    const updatedWeak = Array.from(new Set([...student.weakTopics, ...weakAreas]))
    const completedModules = passed && !student.completedModules.includes(attempt.module_id)
      ? [...student.completedModules, attempt.module_id]
      : student.completedModules

    await updateStudent(user.id, {
      avgQuizScore: avgScore,
      weakTopics: updatedWeak,
      completedModules,
    })

    let certificateEarned = false
    if (completedModules.length >= 87 && await isEligible(user.id)) {
      const { data: existingCertificate } = await supabaseAdmin
        .from('certificates')
        .select('id, is_valid')
        .eq('student_id', user.id)
        .order('completion_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!existingCertificate) {
        await generateCertificate({ ...student, completedModules }, avgScore)
        certificateEarned = true
      } else {
        certificateEarned = existingCertificate.is_valid === true
      }
    }

    const recentResults = await supabaseAdmin
      .from('quiz_results')
      .select('*')
      .eq('student_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(5)

    analyseProgress({
      student: { ...student, completedModules, avgQuizScore: avgScore, weakTopics: updatedWeak },
      recentResults: recentResults.data ?? [],
      completedModules,
    }).catch(() => {/* fire and forget */})

    return NextResponse.json({
      score,
      total,
      percentage,
      passed,
      weakAreas,
      explanations,
      certificateEarned,
      resultId: result.id,
    })
  } catch (err) {
    console.error('/api/quiz/submit error:', err)
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 })
  }
}
