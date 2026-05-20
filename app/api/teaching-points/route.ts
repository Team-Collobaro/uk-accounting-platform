import { NextRequest, NextResponse } from 'next/server'
import { getSectionSubTopics } from '@/lib/courseHtml'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const sectionId = req.nextUrl.searchParams.get('sectionId')
  if (!moduleId || !sectionId) return NextResponse.json({ points: [] })

  try {
    const points = getSectionSubTopics(moduleId, sectionId)
    return NextResponse.json({ points })
  } catch (err) {
    console.error('teaching-points route error:', err)
    return NextResponse.json({ points: [] })
  }
}
