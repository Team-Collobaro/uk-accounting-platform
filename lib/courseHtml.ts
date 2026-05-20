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
  const htmlPath = path.resolve(process.cwd(), 'UK_Master_Course 1-1 (1).html')
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

export function getSectionSubTopics(moduleId: string, sectionId: string): string[] {
  const content = getSectionContent(moduleId, sectionId)
  if (!content) return []

  const points: string[] = []
  const seen = new Set<string>()

  // courseParser stores h4 sub-headings as "[1.2.1 Title text]"
  const bracketRe = /\[(\d+\.\d+\.\d+(?:\.\d+)?)\s+([^\]]{3,80})\]/g
  for (const m of content.matchAll(bracketRe)) {
    const title = `${m[1]} ${m[2].trim()}`
    if (!seen.has(title)) { seen.add(title); points.push(title) }
  }

  // Also catch bare "x.x.x Title" patterns in plain text
  const bareRe = /(\d+\.\d+\.\d+(?:\.\d+)?)\s+([A-Z][^.!?\n]{3,70})/g
  for (const m of content.matchAll(bareRe)) {
    const title = `${m[1]} ${m[2].trim()}`
    if (!seen.has(title)) { seen.add(title); points.push(title) }
  }

  return points.slice(0, 10)
}
