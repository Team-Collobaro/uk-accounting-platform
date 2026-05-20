import * as cheerio from 'cheerio'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any
import * as fs from 'fs'
import { encodingForModel } from 'js-tiktoken'
import type { Module, CourseChunk } from '@/types'

const PART_TITLES: Record<number, string> = {
  0: 'Front Matter',
  1: 'Foundations',
  2: 'Cloud Software Platforms',
  3: 'VAT',
  4: 'Payroll PAYE & CIS',
  5: 'Year-End Accounts',
  6: 'Corporation Tax',
  7: 'Self Assessment',
  8: 'Incorporation',
  9: 'Cessation',
  10: 'Structure Changes',
  11: 'Specialist Tax',
  12: 'Practice & Ethics',
  13: 'Appendices',
}

const SPECIAL_SECTIONS: Record<string, { partNumber: number; order: number; defaultTitle: string }> = {
  welcome:  { partNumber: 0, order: -3, defaultTitle: 'Welcome & How to Use' },
  visuals:  { partNumber: 0, order: -2, defaultTitle: 'Visual Companions' },
  contents: { partNumber: 0, order: -1, defaultTitle: 'Master Contents' },
  appA:     { partNumber: 13, order: 88, defaultTitle: 'Appendix A: Tax Rates & Allowances' },
  appB:     { partNumber: 13, order: 89, defaultTitle: 'Appendix B: Compliance Calendar' },
  appC:     { partNumber: 13, order: 90, defaultTitle: 'Appendix C: Glossary' },
  appD:     { partNumber: 13, order: 91, defaultTitle: 'Appendix D: Final Assessment' },
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

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract section number like "1.1", "1.2.3" from a heading string
function extractSectionNumber(text: string): string | null {
  const m = text.match(/^(\d+\.\d+(?:\.\d+)?)/)
  return m ? m[1] : null
}

export interface ParsedSection {
  sectionId: string    // e.g. "1.1"
  sectionTitle: string // e.g. "Why compliance is the centre of gravity"
  sectionOrder: number
  content: string
}

// Parse a module element's HTML into ordered sections (1.1, 1.2, 1.2.1 …)
export function parseModuleSections($: cheerio.CheerioAPI, moduleEl: cheerio.Cheerio<AnyEl>): ParsedSection[] {
  const sections: ParsedSection[] = []
  let sectionOrder = 0
  let currentSection: ParsedSection | null = null
  const contentParts: string[] = []

  const flush = () => {
    if (currentSection) {
      currentSection.content = contentParts.join(' ').replace(/\s+/g, ' ').trim()
      if (currentSection.content.length > 20) sections.push({ ...currentSection })
    }
    contentParts.length = 0
  }

  moduleEl.find('h2, h3, h4, p, ul, ol, table, div.example, div.warn, div.tip, div.danger').each((_i, el) => {
    const tag = (el as AnyEl).tagName?.toLowerCase() ?? ''
    const text = $(el).text().trim()

    if (tag === 'h2' || tag === 'h3') {
      const secNum = extractSectionNumber(text)
      if (secNum) {
        flush()
        sectionOrder++
        const title = text.replace(/^\d+\.\d+(?:\.\d+)?\s*/, '').trim() || text
        currentSection = { sectionId: secNum, sectionTitle: title, sectionOrder, content: '' }
        contentParts.push(text)
        return
      }
    }

    if (tag === 'h4') {
      const secNum = extractSectionNumber(text)
      if (secNum) {
        // Sub-section — keep under same parent but note it
        contentParts.push(`[${text}]`)
        return
      }
    }

    // Regular content — add to current section
    if (currentSection) {
      const cleaned = cleanText($.html(el) ?? '')
      if (cleaned.length > 5) contentParts.push(cleaned)
    }
  })

  flush()

  // Fallback: if no numbered sections found treat whole module as one section
  if (sections.length === 0) {
    const content = cleanText(moduleEl.html() ?? '')
    if (content.length > 20) {
      sections.push({ sectionId: '1.1', sectionTitle: 'Overview', sectionOrder: 1, content })
    }
  }

  return sections
}

export async function parseCourse(htmlFilePath: string): Promise<Module[]> {
  const html = fs.readFileSync(htmlFilePath, 'utf-8')
  const $ = cheerio.load(html)
  const modules: Module[] = []

  for (const [sectionId, meta] of Object.entries(SPECIAL_SECTIONS)) {
    const el = $(`#${sectionId}`)
    if (!el.length) continue
    const title = el.find('h1, h2, h3, h4').first().text().trim() || meta.defaultTitle
    const content = cleanText(el.html() ?? '')
    if (!content) continue
    const partTitle = PART_TITLES[meta.partNumber]
    modules.push({ id: sectionId, title, partNumber: meta.partNumber, partTitle, content, order: meta.order })
  }

  const modulePattern = /^m(\d{2})$/
  $('[id]').each((_index, el) => {
    const id = $(el).attr('id') ?? ''
    if (!modulePattern.test(id)) return
    const match = id.match(modulePattern)
    if (!match) return
    const moduleNum = parseInt(match[1], 10)
    const order = moduleNum
    let title = $(el).find('h1, h2, h3, h4').first().text().trim()
    if (!title) title = cleanText($(el).html() ?? '').slice(0, 80)
    const content = cleanText($(el).html() ?? '')
    const partNumber = getPartNumber(order)
    const partTitle = PART_TITLES[partNumber] ?? `Part ${partNumber}`
    modules.push({ id, title, partNumber, partTitle, content, order })
  })

  if (modules.length < 10) {
    modules.length = 0
    let order = 0
    $('h2, h3').each((_i, el) => {
      const headingText = $(el).text().trim()
      if (!/^\d|^module\s+\d|^m\d{2}/i.test(headingText)) return
      order += 1
      const id = `m${String(order).padStart(2, '0')}`
      const title = headingText.replace(/^module\s+\d+[:\-.\s]*/i, '').trim() || headingText
      const contentParts: string[] = [headingText]
      let sibling = $(el).next()
      while (sibling.length && !sibling.is('h2, h3')) {
        contentParts.push(cleanText(sibling.html() ?? ''))
        sibling = sibling.next()
      }
      const content = contentParts.join(' ').replace(/\s+/g, ' ').trim()
      const partNumber = getPartNumber(order)
      const partTitle = PART_TITLES[partNumber] ?? `Part ${partNumber}`
      modules.push({ id, title, partNumber, partTitle, content, order })
    })
  }

  return modules
}

export function chunkModule(module: Module, maxTokens = 500): CourseChunk[] {
  const enc = encodingForModel('gpt-4o')
  const overlap = 50
  const chunks: CourseChunk[] = []
  const tokens = enc.encode(module.content)

  if (tokens.length <= maxTokens) {
    return [{
      id: `${module.id}_chunk_0`,
      moduleId: module.id,
      moduleTitle: module.title,
      partNumber: module.partNumber,
      sectionId: '',
      sectionTitle: '',
      sectionOrder: 0,
      content: module.content,
      tokenCount: tokens.length,
    }]
  }

  let start = 0
  let chunkIndex = 0
  while (start < tokens.length) {
    const end = Math.min(start + maxTokens, tokens.length)
    const chunkTokens = tokens.slice(start, end)
    const decoded = enc.decode(chunkTokens)
    const chunkText = typeof decoded === 'string' ? decoded : new TextDecoder().decode(decoded)
    chunks.push({
      id: `${module.id}_chunk_${chunkIndex}`,
      moduleId: module.id,
      moduleTitle: module.title,
      partNumber: module.partNumber,
      sectionId: '',
      sectionTitle: '',
      sectionOrder: 0,
      content: chunkText,
      tokenCount: chunkTokens.length,
    })
    chunkIndex++
    start += maxTokens - overlap
  }
  return chunks
}

// Chunk a module by section — each section becomes its own set of chunks
export function chunkModuleBySections($: cheerio.CheerioAPI, moduleEl: cheerio.Cheerio<AnyEl>, module: Module, maxTokens = 600): CourseChunk[] {
  const enc = encodingForModel('gpt-4o')
  const sections = parseModuleSections($, moduleEl)
  const chunks: CourseChunk[] = []

  for (const section of sections) {
    const tokens = enc.encode(section.content)

    if (tokens.length <= maxTokens) {
      chunks.push({
        id: `${module.id}_${section.sectionId.replace(/\./g, '_')}_0`,
        moduleId: module.id,
        moduleTitle: module.title,
        partNumber: module.partNumber,
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        sectionOrder: section.sectionOrder,
        content: section.content,
        tokenCount: tokens.length,
      })
      continue
    }

    // Split large sections
    let start = 0
    let ci = 0
    while (start < tokens.length) {
      const end = Math.min(start + maxTokens, tokens.length)
      const chunkTokens = tokens.slice(start, end)
      const decoded = enc.decode(chunkTokens)
      const text = typeof decoded === 'string' ? decoded : new TextDecoder().decode(decoded)
      chunks.push({
        id: `${module.id}_${section.sectionId.replace(/\./g, '_')}_${ci}`,
        moduleId: module.id,
        moduleTitle: module.title,
        partNumber: module.partNumber,
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        sectionOrder: section.sectionOrder,
        content: text,
        tokenCount: chunkTokens.length,
      })
      ci++
      start += maxTokens - 50
    }
  }

  return chunks
}
