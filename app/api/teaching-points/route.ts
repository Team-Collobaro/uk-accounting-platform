import { NextRequest, NextResponse } from 'next/server'
import { getSectionTeachingPoints } from '@/lib/courseHtml'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { canAccessModule, previousModuleId } from '@/lib/course-access'
import { MODULE_ID_PATTERN } from '@/lib/quiz-security'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const sectionId = req.nextUrl.searchParams.get('sectionId')
  if (!moduleId || !MODULE_ID_PATTERN.test(moduleId) || !sectionId) {
    return NextResponse.json({ error: 'Valid moduleId and sectionId required' }, { status: 400 })
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

    const tps = getSectionTeachingPoints(moduleId, sectionId)
    return NextResponse.json({
      points: tps.map(p => p.title),
      pointContents: tps.map(p => p.content),
    })
  } catch (err) {
    console.error('teaching-points route error:', err)
    return NextResponse.json({ points: [], pointContents: [] })
  }
}
