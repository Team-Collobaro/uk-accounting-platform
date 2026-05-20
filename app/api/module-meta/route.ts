import { NextRequest, NextResponse } from 'next/server'
import { getModuleMeta } from '@/lib/courseHtml'

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!moduleId) return NextResponse.json(null, { status: 400 })

  try {
    const meta = getModuleMeta(moduleId)
    return NextResponse.json(meta)
  } catch (err) {
    console.error('module-meta route error:', err)
    return NextResponse.json(null, { status: 500 })
  }
}
