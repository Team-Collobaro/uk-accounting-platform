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
import type { QuizQuestion } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      moduleId: string
      answers: Record<string, string>   // { q1: 'A', q2: 'C', ... }
      questions: QuizQuestion[]
    }

    const { moduleId, answers, questions } = body

    if (!moduleId || !answers || !questions?.length) {
      return NextResponse.json({ error: 'moduleId, answers and questions are required' }, { status: 400 })
    }

    // Grade
    let score = 0
    const weakAreas: string[] = []
    const explanations: Record<string, { correct: string; explanation: string; userAnswer: string }> = {}

    for (const q of questions) {
      const userAnswer = answers[q.id] ?? ''
      const isCorrect = userAnswer.trim().toUpperCase() === q.correct.trim().toUpperCase()
      if (isCorrect) {
        score++
      } else {
        if (q.topic && !weakAreas.includes(q.topic)) weakAreas.push(q.topic)
      }
      explanations[q.id] = {
        correct: q.correct,
        explanation: q.explanation,
        userAnswer,
      }
    }

    const total = questions.length
    const percentage = Math.round((score / total) * 100)
    const passed = percentage >= 70

    // Save result
    const result = await saveQuizResult({
      studentId: user.id,
      moduleId,
      score,
      total,
      percentage,
      passed,
      weakAreas,
    })

    // Update module progress
    if (passed) {
      await updateModuleProgress(user.id, moduleId, {
        status: 'completed',
        quizScore: score,
        completedAt: new Date().toISOString(),
      })
    } else {
      await updateModuleProgress(user.id, moduleId, {
        status: 'in_progress',
        quizScore: score,
      })
    }

    // Refresh student stats
    const student = await getStudent(user.id)
    const allResults = await supabaseAdmin
      .from('quiz_results')
      .select('percentage')
      .eq('student_id', user.id)

    const scores = (allResults.data ?? []).map((r: { percentage: number }) => Number(r.percentage))
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

    // Merge weak topics: add new, keep existing unless perfect score clears them
    const updatedWeak = Array.from(
      new Set([...student.weakTopics, ...weakAreas])
    )
    const completedModules = passed && !student.completedModules.includes(moduleId)
      ? [...student.completedModules, moduleId]
      : student.completedModules

    await updateStudent(user.id, {
      avgQuizScore: avgScore,
      weakTopics: updatedWeak,
      completedModules,
    })

    // Certificate check — run async, don't block response
    let certificateEarned = false
    if (completedModules.length >= 87) {
      const eligible = await isEligible(user.id)
      if (eligible) {
        const updatedStudent = { ...student, completedModules }
        await generateCertificate(updatedStudent, avgScore)
        certificateEarned = true
      }
    }

    // Background progress analysis (don't await)
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
