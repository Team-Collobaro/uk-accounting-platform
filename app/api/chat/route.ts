import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getStudent, saveSession, updateSession } from '@/lib/supabase-server'
import { searchSimilar } from '@/lib/retrieval'
import { tutorStream } from '@/lib/anthropic'
import { logUsage } from '@/lib/costTracker'
import { calculateCost } from '@/lib/costTracker'
import type { ChatMessage } from '@/types'
import { canAccessModule, previousModuleId } from '@/lib/course-access'
import { MODULE_ID_PATTERN } from '@/lib/quiz-security'
import explainers from '@/lib/explainers.json'
import sectionExplainers from '@/lib/section-explainers.json'
import type { StoredExplainer } from '@/lib/explainer'

// Module intros ("m23") and lesson sections ("m23/s02")
const videoStores = [explainers, sectionExplainers] as unknown as Record<string, StoredExplainer>[]
const videoNarration = (id: string) => videoStores.find((s) => s[id])?.[id]?.scenes.map((s) => s.narration).join(' ') ?? null

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
      message: string
      moduleId: string
      sessionId?: string
      moduleTitle?: string
      partNumber?: number
      partTitle?: string
      currentSection?: { sectionId: string; sectionTitle: string; sectionOrder: number }
      completedSections?: string[]
      teachingPointIdx?: number
      teachingPointTitle?: string | null
      teachingPointContent?: string | null
      totalTeachingPoints?: number
      allTeachingPoints?: string[]
      phase?: import('@/lib/anthropic').TeachingPhase
      struggleCount?: number
      explainerIds?: string[]
    }

    const { message, moduleId, sessionId, moduleTitle, partNumber, partTitle, currentSection, completedSections, teachingPointIdx, teachingPointTitle, teachingPointContent, totalTeachingPoints, allTeachingPoints, phase, struggleCount, explainerIds } = body

    if (!message || !MODULE_ID_PATTERN.test(moduleId ?? '') || message.length > 8_000) {
      return NextResponse.json({ error: 'message and moduleId are required' }, { status: 400 })
    }
    if (!await canAccessModule(user.id, moduleId)) {
      return NextResponse.json(
        { error: 'Complete the previous module assessment first', prerequisite: previousModuleId(moduleId) },
        { status: 403 }
      )
    }

    // Load student profile
    const student = await getStudent(user.id)

    // Build a minimal module object from request params
    const mod = {
      id: moduleId,
      title: moduleTitle ?? moduleId,
      partNumber: partNumber ?? 1,
      partTitle: partTitle ?? '',
      content: '',
      order: 0,
    }

    // RAG — HTML course file is the single source of truth
    // Teaching point content (exact block from HTML) is used when available — it IS the content to teach
    // The tutor just presented the explainer video(s); open the lesson from what they covered.
    // Only this module's videos count, whatever the client sends.
    const afterExplainer = message === '__EXPLAINER_DONE__'
    const isAutoStart = message === '__AUTO_START__' || afterExplainer
    const presented = (Array.isArray(explainerIds) && explainerIds.length ? explainerIds : [moduleId])
      .filter((id): id is string => typeof id === 'string' && (id === moduleId || id.startsWith(`${moduleId}/`)))
      .slice(0, 3)
    const explainerRecap = afterExplainer
      ? (presented.map(videoNarration).filter(Boolean).join(' ') || null)
      : null
    let ragContext = ''
    const { getModuleSections, getSectionContent } = await import('@/lib/courseHtml')

    if (teachingPointContent && teachingPointContent.trim().length > 20) {
      // Exact content block for this teaching point from the HTML — use as primary context
      // Also include the full section content so MCQ questions can draw on broader context
      const sectionCtx = currentSection?.sectionId
        ? getSectionContent(moduleId, currentSection.sectionId)
        : ''
      ragContext = `TEACHING POINT CONTENT (teach THIS exactly):\n${teachingPointContent}\n\nFULL SECTION CONTEXT (for MCQ options and broader understanding):\n${sectionCtx.slice(0, 1500)}`
    } else if (currentSection?.sectionId) {
      ragContext = getSectionContent(moduleId, currentSection.sectionId)
    } else if (isAutoStart) {
      const sections = getModuleSections(moduleId)
      if (sections.length > 0) {
        ragContext = getSectionContent(moduleId, sections[0].section_id)
      }
    } else {
      if (currentSection?.sectionId) {
        ragContext = getSectionContent(moduleId, currentSection.sectionId)
      }
      try {
        const searchChunks = await searchSimilar(message, moduleId, 2)
        if (searchChunks.length > 0) {
          const extra = searchChunks.map((c: { content: string }) => c.content).join('\n\n---\n\n')
          ragContext = ragContext ? `${ragContext}\n\n---\n\n${extra}` : extra
        }
      } catch { /* DB unavailable */ }
    }

    if (!ragContext) {
      const sections = getModuleSections(moduleId)
      if (sections.length > 0) ragContext = getSectionContent(moduleId, sections[0].section_id)
    }

    // Get or create session, load history
    let currentSessionId = sessionId
    let history: ChatMessage[] = []

    if (currentSessionId) {
      const { data: sessionData } = await supabase
        .from('tutor_sessions')
        .select('messages')
        .eq('id', currentSessionId)
        .eq('student_id', user.id)
        .single()

      if (sessionData) {
        history = (sessionData.messages as ChatMessage[]).slice(-20)
      }
    } else {
      const session = await saveSession({
        studentId: user.id,
        moduleId,
        messages: [],
        totalTokens: 0,
        totalCostUsd: 0,
      })
      currentSessionId = session.id
    }

    // Stream response back to client
    const encoder = new TextEncoder()
    let inputTokens = 0
    let outputTokens = 0
    let fullResponse = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of tutorStream({ student, module: mod, history, message, ragContext, currentSection, completedSections, teachingPointIdx, teachingPointTitle, teachingPointContent, totalTeachingPoints, allTeachingPoints, phase, struggleCount, explainerRecap })) {
            if (typeof chunk === 'string') {
              fullResponse += chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: chunk })}\n\n`))
            } else if (chunk.done) {
              inputTokens = chunk.inputTokens
              outputTokens = chunk.outputTokens
            }
          }

          // Persist updated session — no user message stored for auto-start
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
            tokenCount: outputTokens,
          }
          const updatedMessages = isAutoStart
            ? [...history, assistantMsg]
            : [...history, { role: 'user' as const, content: message, timestamp: new Date().toISOString() }, assistantMsg]
          const totalTokens = inputTokens + outputTokens
          const cost = calculateCost(inputTokens, outputTokens)

          await updateSession(currentSessionId!, updatedMessages, totalTokens, cost)
          await logUsage(user.id, currentSessionId!, inputTokens, outputTokens)

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, sessionId: currentSessionId })}\n\n`
            )
          )
          controller.close()
        } catch (err) {
          // Full detail stays in the server log; the student gets a short code, never the upstream message
          console.error('/api/chat stream error:', err)
          const status = (err as { status?: number })?.status
          const text = err instanceof Error ? err.message : ''
          const code = /credit balance/i.test(text) || status === 401 || status === 403 ? 'unavailable'
            : status === 429 || status === 529 ? 'busy'
            : 'failed'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: code })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('/api/chat error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
