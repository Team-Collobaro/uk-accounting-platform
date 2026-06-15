import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getModuleQuiz, getSectionContent } from '@/lib/courseHtml'
import { searchSimilar } from '@/lib/retrieval'
import { generateQuiz } from '@/lib/ai'
import { logUsage } from '@/lib/costTracker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
      sectionId?: string
      sectionTitle?: string
      count?: number
    }

    const { moduleId, moduleTitle, partNumber, partTitle, sectionId, sectionTitle, count = 2 } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Subtopic quiz — AI-generated from that section's content only.
    // (The HTML file has no per-section questions, so always generate these.)
    if (sectionId) {
      let content = getSectionContent(moduleId, sectionId)
      // Fall back to RAG over the module if the section text is too thin.
      // Don't let a retrieval failure sink the whole quiz — keep what we have.
      if (content.trim().length < 200) {
        try {
          const chunks = await searchSimilar(moduleId, sectionTitle ?? sectionId, 6)
          content = chunks.map((c) => c.content).join('\n\n---\n\n') || content
        } catch (e) {
          console.error('/api/quiz section RAG fallback failed:', e)
        }
      }

      if (content.trim().length < 40) {
        return NextResponse.json(
          { error: 'No content found for this section', questions: [] },
          { status: 404 },
        )
      }

      const mod = {
        id: moduleId,
        title: sectionTitle ?? moduleTitle ?? moduleId,
        partNumber: partNumber ?? 1,
        partTitle: partTitle ?? '',
        content,
        order: 0,
      }

      const questions = await generateQuiz({ module: mod, ragContext: content, count })
      // Cost logging must never block quiz delivery — fire and forget.
      void logUsage(user.id, 'quiz-' + moduleId + '-' + sectionId + '-' + Date.now(), 800, 500)
        .catch((e) => console.error('logUsage failed (section quiz):', e))

      return NextResponse.json({ questions, source: 'ai-section' })
    }

    // Module quiz — hand-written HTML questions first (free, accurate, no latency)
    const htmlQuestions = getModuleQuiz(moduleId)
    if (htmlQuestions.length > 0) {
      return NextResponse.json({ questions: htmlQuestions, source: 'html' })
    }

    // Fall back to AI generation for modules without embedded questions
    const chunks = await searchSimilar(moduleId, moduleId, 8)
    const ragContext = chunks.map((c) => c.content).join('\n\n---\n\n')

    const mod = {
      id: moduleId,
      title: moduleTitle ?? moduleId,
      partNumber: partNumber ?? 1,
      partTitle: partTitle ?? '',
      content: ragContext,
      order: 0,
    }

    const questions = await generateQuiz({ module: mod, ragContext, count })
    void logUsage(user.id, 'quiz-' + moduleId + '-' + Date.now(), 800, 500)
      .catch((e) => console.error('logUsage failed (module quiz):', e))

    return NextResponse.json({ questions, source: 'ai' })
  } catch (err) {
    console.error('/api/quiz error:', err)
    return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 })
  }
}
