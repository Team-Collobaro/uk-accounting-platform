import { NextRequest, NextResponse } from 'next/server'
import { getSectionContent } from '@/lib/courseHtml'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const sectionId = req.nextUrl.searchParams.get('sectionId')
  if (!moduleId || !sectionId) return NextResponse.json({ content: '' }, { status: 400 })

  try {
    const content = getSectionContent(moduleId, sectionId)
    return NextResponse.json({ content })
  } catch (err) {
    console.error('section-content route error:', err)
    return NextResponse.json({ content: '' }, { status: 500 })
  }
}
