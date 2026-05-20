import { NextRequest, NextResponse } from 'next/server'
import { getModuleSections } from '@/lib/courseHtml'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })

  try {
    const sections = getModuleSections(moduleId)
    if (sections.length === 0) {
      return NextResponse.json({ sections: [{ section_id: '1.1', section_title: 'Overview', section_order: 1 }] })
    }
    return NextResponse.json({ sections })
  } catch (err) {
    console.error('sections route error:', err)
    return NextResponse.json({ sections: [] }, { status: 500 })
  }
}
