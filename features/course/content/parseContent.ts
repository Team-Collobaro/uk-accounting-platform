import type { LabeledItem, ContentSegment } from '@/types/course'

// Splits "Label — Description", "Label :: Description", or plain text
function splitLabelDesc(line: string): LabeledItem {
  const stripped = line.replace(/^[-*\d.]+\s*/, '').trim()
  const m = stripped.match(/^(.+?)\s+(?:—|–|::)\s+(.+)$/)
  if (m) return { label: m[1].trim(), desc: m[2].trim() }
  return { label: stripped, desc: '' }
}

// Splits raw AI response into plain text + structured blocks (PILLARS / STEPS / TERMS / MCQ)
export function parseContent(raw: string): ContentSegment[] {
  const cleaned = raw.replace(/:::VISUAL\r?\n?/g, '')
  const segments: ContentSegment[] = []
  const blockRe =
    /[ \t]*:::(PILLARS|STEPS|TERMS|MCQ)\r?\n([\s\S]*?)(?:[ \t]*:::[ \t]*(?:\r?\n|$)|$)/g
  raw = cleaned
  let last = 0
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(raw)) !== null) {
    if (m.index > last) {
      const txt = raw.slice(last, m.index).trim()
      if (txt) segments.push({ kind: 'text', text: txt })
    }
    const type = m[1] as 'PILLARS' | 'STEPS' | 'TERMS' | 'MCQ'
    const body = m[2].trim()
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    if (type === 'MCQ') {
      const question = lines[0] ?? ''
      const options: Array<{ letter: string; text: string }> = []
      let correct = ''
      for (const l of lines.slice(1)) {
        const optM = l.match(/^([A-D])\.\s+(.+)/)
        if (optM) { options.push({ letter: optM[1], text: optM[2] }); continue }
        const corM = l.match(/^CORRECT:\s*([A-D])/)
        if (corM) correct = corM[1]
      }
      segments.push({ kind: 'mcq', data: { question, options, correct } })
    } else {
      const title = lines[0] ?? ''
      const items = lines.slice(1).map(splitLabelDesc).filter((it) => it.label)
      const kind = type === 'PILLARS' ? 'pillars' : type === 'STEPS' ? 'steps' : 'terms'
      segments.push({ kind, title, items } as ContentSegment)
    }
    last = m.index + m[0].length
  }
  const tail = raw.slice(last).trim()
  if (tail) segments.push({ kind: 'text', text: tail })
  return segments
}
