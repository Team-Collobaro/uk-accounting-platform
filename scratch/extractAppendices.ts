import * as fs from 'fs'
import * as path from 'path'
import * as cheerio from 'cheerio'

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

function extractSectionNumber(text: string): string | null {
  const m = text.match(/^(\d+\.\d+(?:\.\d+)?)/)
  return m ? m[1] : null
}

function parseModuleSections($: any, moduleEl: any): any[] {
  const sections: any[] = []
  let sectionOrder = 0
  let currentSection: any = null
  const contentParts: string[] = []

  const flush = () => {
    if (currentSection) {
      currentSection.content = contentParts.join(' ').replace(/\s+/g, ' ').trim()
      if (currentSection.content.length > 20) sections.push({ ...currentSection })
    }
    contentParts.length = 0
  }

  moduleEl.find('h2, h3, h4, p, ul, ol, table, div.example, div.warn, div.tip, div.danger').each((_i: any, el: any) => {
    const tag = el.tagName?.toLowerCase() ?? ''
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
        contentParts.push(`[${text}]`)
        return
      }
    }

    if (currentSection) {
      const cleaned = cleanText($.html(el) ?? '')
      if (cleaned.length > 5) contentParts.push(cleaned)
    }
  })

  flush()

  if (sections.length === 0) {
    const content = cleanText(moduleEl.html() ?? '')
    if (content.length > 20) {
      sections.push({ sectionId: '1.1', sectionTitle: 'Overview', sectionOrder: 1, content })
    }
  }

  return sections
}

async function main() {
  const htmlPath = path.resolve(process.cwd(), 'oldveriosn.html')
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const $ = cheerio.load(html)
  
  const SPECIAL_SECTIONS = ['appA', 'appB', 'appC', 'appD']
  
  const newModules = []
  
  for (const sectionId of SPECIAL_SECTIONS) {
    const el = $(`#${sectionId}`)
    if (!el.length) {
      console.log(`Element #${sectionId} not found`)
      continue
    }
    
    let title = el.find('.module-meta').first().text().trim() || sectionId
    let mainHeading = el.find('.module-title').first().text().trim()
    if (mainHeading) title = `${title}: ${mainHeading}`
    
    const sections = parseModuleSections($, el)
    
    newModules.push({
      id: sectionId,
      title: title,
      meta: 'Appendix',
      learningObjHtml: '',
      hookHtml: '',
      hookText: '',
      sections: sections.map((s: any) => ({
        id: s.sectionId,
        title: s.sectionTitle,
        contentHtml: s.content,
        aiPractice: null
      }))
    })
    console.log(`Extracted ${sectionId} with ${sections.length} sections`)
  }
  
  const dataPath = path.resolve(process.cwd(), 'lib/courseDataRaw.json')
  const courseData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  
  for (const newMod of newModules) {
    if (!courseData.find((m: any) => m.id === newMod.id)) {
      courseData.push(newMod)
    }
  }
  
  fs.writeFileSync(dataPath, JSON.stringify(courseData, null, 2))
  console.log('Done modifying courseDataRaw.json')
}
main().catch(console.error)
