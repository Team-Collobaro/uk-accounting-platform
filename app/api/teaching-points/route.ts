import { NextRequest, NextResponse } from 'next/server'
import { getSectionTeachingPoints } from '@/lib/courseHtml'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const sectionId = req.nextUrl.searchParams.get('sectionId')
  if (!moduleId || !sectionId) return NextResponse.json({ points: [], pointContents: [] })

  try {
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
