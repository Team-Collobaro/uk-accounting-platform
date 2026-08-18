import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import defaultConfig from '@/config/proctoring.config.json'

const configPath = path.join(process.cwd(), 'config', 'proctoring.config.json')

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        ...defaultConfig,
        devMode: false,
        gates: {
          ...defaultConfig.gates,
          bypassIntegrityAgreement: false,
          bypassMobileCameraRequired: false,
        },
      })
    }

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      return NextResponse.json(JSON.parse(data))
    }
    return NextResponse.json(defaultConfig)
  } catch (error) {
    console.error('Error reading proctoring config file:', error)
    return NextResponse.json(defaultConfig)
  }
}

import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user?.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
    }

    const updated = await req.json()
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8')
    return NextResponse.json({ success: true, config: updated })
  } catch (error: any) {
    console.error('Error saving proctoring config:', error)
    return NextResponse.json({ error: error.message || 'Failed to save config' }, { status: 500 })
  }
}
