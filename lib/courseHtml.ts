import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'
import { parseModuleSections } from './courseParser'
import { PART_TITLES, getPartNumber } from '@/constants/course'

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
  const content = section?.content ?? ''

  // For sub-sections like 1.2.1, prepend the parent stub's intro (e.g. 1.2)
  // so the tutor has that context without the student needing to visit the stub
  const dotCount = (sectionId.match(/\./g) ?? []).length
  if (dotCount >= 2) {
    const parentId = sectionId.split('.').slice(0, 2).join('.')
    const parent = parsed.find(s => s.sectionId === parentId)
    if (parent?.content) return `${parent.content}\n\n${content}`
  }

  return content
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

  // Strip structural headings that aren't real teaching content
  const isStructural = (title: string) =>
    /end-of-section\s*mcq|end.of.section|module\s*\d+\s*[—-]\s*(summary|mcq|quiz)/i.test(title)
  const filtered = points.filter(p => !isStructural(p.title))

  // For sub-sections like 1.2.1, prepend the parent stub's intro into the
  // first teaching point so the tutor has that context without a separate session
  const dotCount = (sectionId.match(/\./g) ?? []).length
  if (dotCount >= 2 && filtered.length > 0) {
    const parentId = sectionId.split('.').slice(0, 2).join('.')
    const parent = sections.find(s => s.sectionId === parentId)
    if (parent?.content) {
      filtered[0] = { ...filtered[0], content: `${parent.content}\n\n${filtered[0].content}` }
    }
  }

  return filtered
}

// Legacy: returns just titles for backward compatibility
export function getSectionSubTopics(moduleId: string, sectionId: string): string[] {
  const pts = getSectionTeachingPoints(moduleId, sectionId)
  if (pts.length > 0) return pts.map(p => p.title)
  return []
}

export interface HtmlQuizQuestion {
  id: string
  question: string
  options: string[]   // ["A. text", "B. text", ...]
  correct: string     // "A" | "B" | "C" | "D"
  explanation: string
  topic: string
}

// Parse the hand-written quiz block embedded in the HTML for a given module.
// Returns [] if no quiz-block is found (fall back to AI generation).
export function getModuleQuiz(moduleId: string): HtmlQuizQuestion[] {
  const $ = getCheerio()
  const moduleEl = $(`#${moduleId}`)
  if (!moduleEl.length) return []

  const quizBlock = moduleEl.find('.quiz-block').first()
  if (!quizBlock.length) return []

  const questions: HtmlQuizQuestion[] = []
  const letters = ['A', 'B', 'C', 'D']

  quizBlock.find('.quiz-q').each((qi, qEl) => {
    const questionText = $(qEl).find('.q-text').text().replace(/\s+/g, ' ').trim()
    if (!questionText) return

    const opts: string[] = []
    let correctLetter = 'A'

    $(qEl).find('.opt').each((oi, optEl) => {
      const letter = letters[oi] ?? String.fromCharCode(65 + oi)
      const text = $(optEl).text().replace(/\s+/g, ' ').trim()
      opts.push(`${letter}. ${text}`)
      if ($(optEl).attr('data-correct') === 'true') correctLetter = letter
    })

    const explanation = $(qEl).find('.feedback').text().replace(/\s+/g, ' ').trim()

    questions.push({
      id: `${moduleId}_q${qi + 1}`,
      question: questionText,
      options: opts,
      correct: correctLetter,
      explanation,
      topic: moduleId,
    })
  })

  return questions
}
