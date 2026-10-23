import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: dbEmployers, error } = await supabaseAdmin
      .from('employers')
      .select('id, company_name, plan, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Only real employers from the database — strictly no dummy data
    const employers = (dbEmployers ?? []).map(emp => ({
      id: emp.id,
      name: emp.company_name,
      plan: emp.plan || 'starter',
      joinedAt: emp.created_at,
      verified: true,
      hiring: true,
    }))

    return NextResponse.json({
      employers,
      totalCount: employers.length,
    })
  } catch (err) {
    console.error('Error fetching public employers:', err)
    return NextResponse.json({ employers: [], totalCount: 0 }, { status: 500 })
  }
}
