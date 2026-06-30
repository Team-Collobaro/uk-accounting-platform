import { NextRequest, NextResponse } from 'next/server'
import courseData from '@/lib/courseDataRaw.json'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })

  try {
    const module = courseData.find((m: any) => m.id === moduleId)
    if (!module || !module.sections || module.sections.length === 0) {
      return NextResponse.json({ 
        module_title: 'Unknown Module',
        meta: '',
        learningObjHtml: '',
        sections: [{ section_id: '1.1', section_title: 'Overview', section_order: 1 }] 
      })
    }

    const sections = module.sections.map((s: any, idx: number) => ({
      section_id: s.id,
      section_title: s.title,
      section_order: idx + 1,
      aiPractice: s.aiPractice || null
    }))

    return NextResponse.json({ 
      module_title: module.title,
      meta: module.meta || '',
      learningObjHtml: module.learningObjHtml || '',
      hookHtml: module.hookHtml || '',
      hookText: module.hookText || '',
      sections 
    })
  } catch (err) {
    console.error('sections route error:', err)
    return NextResponse.json({ sections: [] }, { status: 500 })
  }
}
