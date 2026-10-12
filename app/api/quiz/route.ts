import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { generateQuiz } from '@/lib/anthropic'
import { logUsage } from '@/lib/costTracker'
import {
  MODULE_ID_PATTERN,
  QUIZ_ATTEMPT_MINUTES,
  publicQuizQuestions,
  validateGeneratedQuiz,
} from '@/lib/quiz-security'
import { canAccessModule, previousModuleId } from '@/lib/course-access'
import courseData from '@/lib/courseDataRaw.json'
import type { QuizQuestion } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function cleanHtmlToText(html: string): string {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

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
    const requestedCount = Number.isInteger(body.count) ? Math.min(10, Math.max(1, body.count!)) : 5

    if (!MODULE_ID_PATTERN.test(moduleId ?? '')) {
      return NextResponse.json({ error: 'A valid moduleId is required' }, { status: 400 })
    }
    if (!await canAccessModule(user.id, moduleId)) {
      return NextResponse.json(
        { error: 'Complete the previous module assessment first', prerequisite: previousModuleId(moduleId) },
        { status: 403 }
      )
    }

    const rawModule = (courseData as any[]).find((m: any) => m.id === moduleId)
    let questions: QuizQuestion[] = []

    // 1. Primary: Use pre-authored curated questions from courseDataRaw.json if present
    if (rawModule?.quiz && Array.isArray(rawModule.quiz) && rawModule.quiz.length > 0) {
      const takeCount = Math.min(requestedCount, rawModule.quiz.length)
      const curatedCandidates = rawModule.quiz.slice(0, takeCount).map((q: any, idx: number) => {
        const rawOptions = (q.options || []) as Array<{ text?: string; correct?: boolean } | string>
        const formattedOptions = rawOptions.map((opt, optIdx) => {
          const text = typeof opt === 'string' ? opt : (opt.text || '')
          return `${LETTERS[optIdx]}. ${text.trim()}`
        })

        const correctIdx = q.correctIndex !== undefined && q.correctIndex >= 0
          ? q.correctIndex
          : rawOptions.findIndex((opt) => typeof opt === 'object' && opt?.correct === true)
        const safeCorrectIdx = correctIdx >= 0 && correctIdx < formattedOptions.length ? correctIdx : 0
        const correctChoice = LETTERS[safeCorrectIdx]

        return {
          id: `q${idx + 1}`,
          question: q.question?.trim() || `Question ${idx + 1}`,
          options: formattedOptions,
          correct: correctChoice,
          explanation: q.feedback?.trim() || `The correct answer is ${formattedOptions[safeCorrectIdx]}.`,
          topic: rawModule.title || moduleTitle || moduleId,
        }
      })

      try {
        questions = validateGeneratedQuiz(curatedCandidates, takeCount)
      } catch (validationErr) {
        console.warn('Curated questions failed validation, falling back to AI/RAG:', validationErr)
        questions = []
      }
    }

    // 2. Secondary: If no curated questions, extract canonical learning content & generate via Claude
    if (questions.length === 0) {
      let ragContext = ''

      // Extract text from course sections in courseDataRaw.json
      if (rawModule?.sections && Array.isArray(rawModule.sections)) {
        const learningSections = rawModule.sections.filter(
          (s: any) => s.title?.trim().toLowerCase() !== 'knowledge check'
        )
        ragContext = learningSections
          .map((s: any) => {
            const plain = cleanHtmlToText(s.contentHtml || '')
            return `### ${s.title}\n${plain}`
          })
          .filter((t: string) => t.length > 25)
          .join('\n\n---\n\n')
      }

      // Fallback: Check Supabase course_chunks by module_id
      if (!ragContext.trim()) {
        try {
          const { data: dbChunks } = await supabaseAdmin
            .from('course_chunks')
            .select('content, section_title')
            .eq('module_id', moduleId)
            .order('section_order')
            .limit(10)

          if (dbChunks && dbChunks.length > 0) {
            ragContext = dbChunks
              .filter((c: any) => c.section_title?.trim().toLowerCase() !== 'knowledge check')
              .map((c: any) => c.content)
              .join('\n\n---\n\n')
          }
        } catch (dbErr) {
          console.warn('Database chunk retrieval failed:', dbErr)
        }
      }

      if (!ragContext.trim()) {
        return NextResponse.json({ error: 'No learning content is available for this module' }, { status: 404 })
      }

      const mod = {
        id: moduleId,
        title: moduleTitle ?? rawModule?.title ?? moduleId,
        partNumber: partNumber ?? 1,
        partTitle: partTitle ?? '',
        content: ragContext,
        order: 0,
      }

      try {
        const generated = await generateQuiz({ module: mod, ragContext, count: requestedCount })
        questions = validateGeneratedQuiz(generated, requestedCount)

        try {
          await logUsage(user.id, `quiz-${moduleId}-${Date.now()}`, 800, 500)
        } catch (logErr) {
          console.warn('Failed to log token usage:', logErr)
        }
      } catch (genErr) {
        console.error('AI quiz generation failed:', genErr)
        throw genErr
      }
    }

    const expiresAt = new Date(Date.now() + QUIZ_ATTEMPT_MINUTES * 60_000).toISOString()

    // Expire any existing active attempts for this module
    const { error: expireError } = await supabaseAdmin
      .from('quiz_attempts')
      .update({ status: 'expired' })
      .eq('student_id', user.id)
      .eq('module_id', moduleId)
      .eq('status', 'active')
    if (expireError) throw expireError

    // Insert the new attempt
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({ student_id: user.id, module_id: moduleId, questions, expires_at: expiresAt })
      .select('id, expires_at')
      .single()
    if (attemptError) throw attemptError

    return NextResponse.json({
      attemptId: attempt.id,
      expiresAt: attempt.expires_at,
      questions: publicQuizQuestions(questions),
    })
  } catch (err: unknown) {
    console.error('/api/quiz error:', err)
    return NextResponse.json({ error: 'Failed to prepare assessment questions' }, { status: 500 })
  }
}
