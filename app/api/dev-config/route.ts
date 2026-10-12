import { NextResponse } from 'next/server'
import { DEFAULT_PROCTORING_CONFIG } from '@/lib/proctoringConfig'

// Compatibility endpoint: existing mobile clients use this for settings and connectivity.
export async function GET() {
  return NextResponse.json(DEFAULT_PROCTORING_CONFIG)
}
