import { NextRequest, NextResponse } from 'next/server'
import { getCertificate } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const certificate = await getCertificate(params.id)

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (!certificate.isValid) {
      return NextResponse.json(
        { error: 'Certificate has been revoked', certificate },
        { status: 410 }
      )
    }

    return NextResponse.json({ certificate })
  } catch (err) {
    console.error('/api/verify error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
