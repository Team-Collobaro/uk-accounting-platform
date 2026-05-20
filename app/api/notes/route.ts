import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { moduleId, sectionId, sectionTitle, notes, keyPoints, status, teachingPointIdx, teachingPoints } =
    await req.json() as {
      moduleId: string
      sectionId: string
      sectionTitle: string
      notes?: string
      keyPoints?: string[]
      status?: string
      teachingPointIdx?: number
      teachingPoints?: { title: string; done: boolean }[]
    }

  const { error } = await supabase
    .from('section_progress')
    .upsert({
      student_id: user.id,
      module_id: moduleId,
      section_id: sectionId,
      section_title: sectionTitle,
      notes: notes ?? '',
      key_points: keyPoints ?? [],
      status: status ?? 'in_progress',
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      ...(teachingPointIdx !== undefined && { teaching_point_idx: teachingPointIdx }),
      ...(teachingPoints !== undefined && { teaching_points: teachingPoints }),
    }, { onConflict: 'student_id,module_id,section_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })

  const { data } = await supabase
    .from('section_progress')
    .select('*')
    .eq('student_id', user.id)
    .eq('module_id', moduleId)
    .order('section_id')

  return NextResponse.json({ progress: data ?? [] })
}
