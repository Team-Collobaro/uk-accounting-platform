import * as path from 'path'
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioEl = any

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { chunkModuleBySections } from '../lib/courseParser'
import { supabaseAdmin } from '../lib/supabase-server'


const PART_TITLES: Record<number, string> = {
  1: 'Foundations', 2: 'Cloud Software Platforms', 3: 'VAT',
  4: 'Payroll PAYE & CIS', 5: 'Year-End Accounts', 6: 'Corporation Tax',
  7: 'Self Assessment', 8: 'Incorporation', 9: 'Cessation',
  10: 'Structure Changes', 11: 'Specialist Tax', 12: 'Practice & Ethics',
}

function getPartNumber(moduleOrder: number): number {
  if (moduleOrder <= 7)  return 1
  if (moduleOrder <= 12) return 2
  if (moduleOrder <= 20) return 3
  if (moduleOrder <= 26) return 4
  if (moduleOrder <= 34) return 5
  if (moduleOrder <= 40) return 6
  if (moduleOrder <= 48) return 7
  if (moduleOrder <= 57) return 8
  if (moduleOrder <= 66) return 9
  if (moduleOrder <= 74) return 10
  if (moduleOrder <= 82) return 11
  return 12
}

function makeUUID(key: string): string {
  const h = crypto.createHash('sha256').update(key).digest('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${((parseInt(h[16],16)&3)|8).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`
}

async function main() {
  const start = Date.now()
  console.log('Indexing UK Master Course by section…')

  const htmlPath = path.resolve(process.cwd(), 'UK_Master_Course 1-1 (1).html')
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const $ = cheerio.load(html)

  const allChunks: {
    id: string
    module_id: string
    module_title: string
    part_number: number
    section_id: string
    section_title: string
    section_order: number
    content: string
    token_count: number
  }[] = []

  // Process each module element (m01–m87)
  $('[id]').each((_i, el) => {
    const id = $(el).attr('id') ?? ''
    if (!/^m(\d{2})$/.test(id)) return
    const moduleNum = parseInt(id.replace('m', ''), 10)
    const partNumber = getPartNumber(moduleNum)
    const title = $(el).find('h1, h2, h3').first().text().trim() || id.toUpperCase()
    const mod = { id, title, partNumber, partTitle: PART_TITLES[partNumber] ?? '', content: '', order: moduleNum }

    const chunks = chunkModuleBySections($, $(el) as cheerio.Cheerio<CheerioEl>, mod, 600)

    for (const chunk of chunks) {
      allChunks.push({
        id: makeUUID(chunk.id),
        module_id: chunk.moduleId,
        module_title: chunk.moduleTitle,
        part_number: chunk.partNumber,
        section_id: chunk.sectionId,
        section_title: chunk.sectionTitle,
        section_order: chunk.sectionOrder,
        content: chunk.content,
        token_count: chunk.tokenCount,
      })
    }

    console.log(`  ${id.toUpperCase()} — ${chunks.length} section chunks`)
  })

  console.log(`\nTotal chunks: ${allChunks.length}`)

  // Fetch existing IDs
  const { data: existing } = await supabaseAdmin.from('course_chunks').select('id')
  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id))
  const newChunks = allChunks.filter(c => !existingIds.has(c.id))

  if (newChunks.length === 0) {
    console.log('All chunks already indexed.')
    return
  }

  console.log(`Storing ${newChunks.length} new chunks…`)
  const batchSize = 50
  for (let i = 0; i < newChunks.length; i += batchSize) {
    const { error } = await supabaseAdmin
      .from('course_chunks')
      .upsert(newChunks.slice(i, i + batchSize), { onConflict: 'id' })
    if (error) { console.error('Upsert error:', error.message); throw error }
    process.stdout.write(`  batch ${Math.floor(i/batchSize)+1}/${Math.ceil(newChunks.length/batchSize)}\r`)
  }

  console.log(`\nDone in ${((Date.now()-start)/1000).toFixed(1)}s`)
}

main().catch(err => { console.error(err); process.exit(1) })
