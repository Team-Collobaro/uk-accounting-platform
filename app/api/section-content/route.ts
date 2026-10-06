import { NextRequest, NextResponse } from 'next/server'
import courseData from '@/lib/courseDataRaw.json'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { canAccessModule, previousModuleId } from '@/lib/course-access'
import { MODULE_ID_PATTERN } from '@/lib/quiz-security'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const sectionId = req.nextUrl.searchParams.get('sectionId')

  if (!moduleId || !MODULE_ID_PATTERN.test(moduleId) || !sectionId) {
    return NextResponse.json({ error: 'moduleId and sectionId required' }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccessModule(user.id, moduleId)) {
      return NextResponse.json(
        { error: 'Complete the previous module assessment first', prerequisite: previousModuleId(moduleId) },
        { status: 403 }
      )
    }

    const module = courseData.find((m: any) => m.id === moduleId)
    if (!module) return NextResponse.json({ content: '' })

    const section = module.sections?.find((s: any) => s.id === sectionId)
    return NextResponse.json({ content: section?.contentHtml || '' })
  } catch (err) {
    console.error('section-content route error:', err)
    return NextResponse.json({ content: '' }, { status: 500 })
  }
}
