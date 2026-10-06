import { NextRequest, NextResponse } from 'next/server'
import { getModuleMeta } from '@/lib/courseHtml'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { canAccessModule, previousModuleId } from '@/lib/course-access'
import { MODULE_ID_PATTERN } from '@/lib/quiz-security'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!moduleId || !MODULE_ID_PATTERN.test(moduleId)) {
    return NextResponse.json({ error: 'Valid moduleId required' }, { status: 400 })
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

    const meta = getModuleMeta(moduleId)
    return NextResponse.json(meta)
  } catch (err) {
    console.error('module-meta route error:', err)
    return NextResponse.json(null, { status: 500 })
  }
}
