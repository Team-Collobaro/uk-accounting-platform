import { NextRequest, NextResponse } from 'next/server'
import courseData from '@/lib/courseDataRaw.json'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const sectionId = req.nextUrl.searchParams.get('sectionId')

  if (!moduleId || !sectionId) {
    return NextResponse.json({ error: 'moduleId and sectionId required' }, { status: 400 })
  }

  try {
    const module = courseData.find((m: any) => m.id === moduleId)
    if (!module) return NextResponse.json({ content: '' })

    const section = module.sections?.find((s: any) => s.id === sectionId)
    return NextResponse.json({ content: section?.contentHtml || '' })
  } catch (err) {
    console.error('section-content route error:', err)
    return NextResponse.json({ content: '' }, { status: 500 })
  }
}
