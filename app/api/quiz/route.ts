import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { searchSimilar } from '@/lib/retrieval'
import { generateQuiz } from '@/lib/anthropic'
import { logUsage } from '@/lib/costTracker'

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

    const { moduleId, moduleTitle, partNumber, partTitle, count = 5 } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Fetch top 8 chunks for richer quiz context
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

    // Log approximate token usage (quiz generation ~800 input, ~500 output)
    try {
      await logUsage(user.id, 'quiz-' + moduleId + '-' + Date.now(), 800, 500)
    } catch (logErr) {
      console.warn('Failed to log token usage:', logErr)
    }

    return NextResponse.json({ questions })
  } catch (err: any) {
    console.error('/api/quiz error:', err)
    return NextResponse.json({ error: 'Failed to generate quiz', details: err.message || String(err) }, { status: 500 })
  }
}
