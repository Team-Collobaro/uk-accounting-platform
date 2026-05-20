const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  // Try direct table alter via PostgREST — not possible, use a workaround:
  // Insert a dummy row to check what columns exist
  const { data, error } = await sb.from('course_chunks').select('section_id').limit(1)
  if (error && error.message.includes('section_id')) {
    console.log('section_id column missing — cannot add via JS client. Please run fix_schema.sql in Supabase SQL Editor.')
    console.log('URL: https://supabase.com/dashboard/project/' + process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://','').replace('.supabase.co','') + '/sql/new')
  } else if (error) {
    console.log('Other error:', error.message)
  } else {
    console.log('section_id column EXISTS — schema is ready!')
    console.log('Sample row:', JSON.stringify(data?.[0]))
  }
}
run().catch(console.error)
