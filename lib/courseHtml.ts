import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'
import { parseModuleSections } from './courseParser'

const PART_TITLES: Record<number, string> = {
  0: 'Front Matter', 1: 'Foundations', 2: 'Cloud Software Platforms',
  3: 'VAT', 4: 'Payroll PAYE & CIS', 5: 'Year-End Accounts',
  6: 'Corporation Tax', 7: 'Self Assessment', 8: 'Incorporation',
  9: 'Cessation', 10: 'Structure Changes', 11: 'Specialist Tax',
  12: 'Practice & Ethics', 13: 'Appendices',
}

function getPartNumber(n: number) {
  if (n <= 7) return 1; if (n <= 12) return 2; if (n <= 20) return 3
  if (n <= 26) return 4; if (n <= 34) return 5; if (n <= 40) return 6
  if (n <= 48) return 7; if (n <= 57) return 8; if (n <= 66) return 9
  if (n <= 74) return 10; if (n <= 82) return 11; return 12
}

// Singleton — parsed once per process
let _cache: cheerio.CheerioAPI | null = null

function getCheerio(): cheerio.CheerioAPI {
  if (_cache) return _cache
  const htmlPath = path.resolve(process.cwd(), 'UK_Master_Course 3.html')
  const html = fs.readFileSync(htmlPath, 'utf-8')
  _cache = cheerio.load(html)
  return _cache
}

export interface ModuleMeta {
  module_title: string
  part_number: number
  part_title: string
}

export function getModuleMeta(moduleId: string): ModuleMeta | null {
  const $ = getCheerio()
  const moduleEl = $(`#${moduleId}`)
  if (!moduleEl.length) return null
  const title = moduleEl.find('h1, h2, h3').first().text().trim() || moduleId.toUpperCase()
  const num = parseInt(moduleId.replace(/\D/g, ''), 10) || 1
  const partNumber = getPartNumber(num)
  return { module_title: title, part_number: partNumber, part_title: PART_TITLES[partNumber] ?? `Part ${partNumber}` }
}

export interface SectionMeta {
  section_id: string
  section_title: string
  section_order: number
}

export function getModuleSections(moduleId: string): SectionMeta[] {
  const $ = getCheerio()
  const moduleEl = $(`#${moduleId}`)
  if (!moduleEl.length) return []

  const parsed = parseModuleSections($, moduleEl)
  return parsed.map(s => ({
    section_id: s.sectionId,
    section_title: s.sectionTitle,
    section_order: s.sectionOrder,
  }))
}

export function getSectionContent(moduleId: string, sectionId: string): string {
  const $ = getCheerio()
  const moduleEl = $(`#${moduleId}`)
  if (!moduleEl.length) return ''

  const parsed = parseModuleSections($, moduleEl)
  const section = parsed.find(s => s.sectionId === sectionId)
  return section?.content ?? ''
}

export interface TeachingPoint {
  title: string
  content: string
}

// Extract ordered teaching points from a section — each point maps to a specific
// content block in the HTML (paragraph, list, table, callout, sub-heading block).
// These are the EXACT items Alex must teach, in order, from the course file.
export function getSectionTeachingPoints(moduleId: string, sectionId: string): TeachingPoint[] {
  const $ = getCheerio()
  const moduleEl = $(`#${moduleId}`)
  if (!moduleEl.length) return []

  const { parseModuleSections } = require('./courseParser') as typeof import('./courseParser')
  const sections = parseModuleSections($, moduleEl)
  const section = sections.find(s => s.sectionId === sectionId)
  if (!section) return []

  // Re-parse this section's raw HTML for granular blocks
  // Find the h2/h3 that starts this section, collect until next same-level heading
  const points: TeachingPoint[] = []

  let inSection = false
  let sectionLevel = 0
  let currentSubTitle = ''
  let currentParts: string[] = []

  const flush = (title: string, parts: string[]) => {
    const text = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (text.length > 30) points.push({ title: title || 'Key concept', content: text })
  }

  moduleEl.find('h2, h3, h4, p, ul, ol, table, div').each((_i, el) => {
    const tag = ((el as unknown as { tagName?: string }).tagName ?? '').toLowerCase()
    const text = $(el).text().replace(/\s+/g, ' ').trim()

    // Detect section start
    if ((tag === 'h2' || tag === 'h3') && text.startsWith(sectionId)) {
      inSection = true
      sectionLevel = tag === 'h2' ? 2 : 3
      currentSubTitle = text.replace(/^\d+\.\d+(?:\.\d+)?\s*/, '').trim()
      currentParts = []
      return
    }

    // Detect section end (next same-or-higher heading)
    if (inSection && (tag === 'h2' || tag === 'h3')) {
      const level = tag === 'h2' ? 2 : 3
      if (level <= sectionLevel) {
        flush(currentSubTitle, currentParts)
        inSection = false
        return
      }
      // Sub-heading within section — flush current and start new block
      flush(currentSubTitle, currentParts)
      currentSubTitle = text.replace(/^\d+\.\d+(?:\.\d+)?\s*/, '').trim()
      currentParts = []
      return
    }

    if (!inSection) return

    // h4 sub-headings — start a new block
    if (tag === 'h4') {
      flush(currentSubTitle, currentParts)
      currentSubTitle = text.replace(/^\d+\.\d+(?:\.\d+)?\s*/, '').trim()
      currentParts = []
      return
    }

    // Tables — extract as structured text with heading row
    if (tag === 'table') {
      const rows: string[] = []
      $(el).find('tr').each((_ri, row) => {
        const cells = $(row).find('th, td').map((_ci, cell) => $(cell).text().trim()).get()
        if (cells.some(c => c.length > 0)) rows.push(cells.join(' | '))
      })
      if (rows.length > 0) currentParts.push('TABLE: ' + rows.join(' /// '))
      return
    }

    // Lists — join as bullet items
    if (tag === 'ul' || tag === 'ol') {
      const items = $(el).find('li').map((_li, item) => '• ' + $(item).text().trim()).get()
      if (items.length > 0) currentParts.push(items.join(' '))
      return
    }

    // Callout/tip/warn divs
    if (tag === 'div') {
      const cls = $(el).attr('class') ?? ''
      if (/callout|example|warn|tip|danger|info|legal|journal|formula|scenario/.test(cls)) {
        const divText = $(el).text().replace(/\s+/g, ' ').trim()
        if (divText.length > 20) currentParts.push(divText)
      }
      return
    }

    // Regular paragraphs
    if (tag === 'p' && text.length > 20) {
      currentParts.push(text)
    }
  })

  // Flush last block
  if (inSection) flush(currentSubTitle, currentParts)

  // If no blocks found (small section), create one point from full content
  if (points.length === 0 && section.content.length > 20) {
    points.push({ title: section.sectionTitle, content: section.content })
  }

  return points
}

// Legacy: returns just titles for backward compatibility
export function getSectionSubTopics(moduleId: string, sectionId: string): string[] {
  const pts = getSectionTeachingPoints(moduleId, sectionId)
  if (pts.length > 0) return pts.map(p => p.title)
  return []
}
