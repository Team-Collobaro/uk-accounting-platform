import React from 'react'

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  )
}

/** Render tutor text as React elements, never as model-supplied HTML. */
export default function TutorMessage({ content }: { content: string }) {
  const lines = content.replace(/:::VISUAL/g, '').split('\n')
  const blocks: React.ReactNode[] = []
  let paragraph: string[] = []
  let items: string[] = []
  let ordered = false
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length} style={{ margin: 0 }}>{inline(paragraph.join(' '))}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!items.length) return
    const children = items.map((item, index) => (
      <li key={index} style={ordered ? { paddingLeft: 2 } : { display: 'flex', gap: 8 }}>
        {!ordered && <span aria-hidden="true">-</span>}
        <span>{inline(item)}</span>
      </li>
    ))
    blocks.push(ordered
      ? <ol key={blocks.length} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{children}</ol>
      : <ul key={blocks.length} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>{children}</ul>)
    items = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (/^:::(?:PILLARS|STEPS|TERMS|MCQ)?$/.test(line) || /^CORRECT:/.test(line)) {
      flushParagraph(); flushList(); continue
    }
    if (!line) { flushParagraph(); flushList(); continue }
    const bullet = line.match(/^[-*•]\s+(.+)$/)
    const numbered = line.match(/^\d+[.)]\s+(.+)$/)
    if (bullet || numbered) {
      flushParagraph()
      const nextOrdered = Boolean(numbered)
      if (items.length && ordered !== nextOrdered) flushList()
      ordered = nextOrdered
      items.push((bullet ?? numbered)![1])
      continue
    }
    flushList()
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      flushParagraph()
      blocks.push(<p key={blocks.length} style={{ margin: 0, fontWeight: 700 }}>{inline(heading[1])}</p>)
    } else paragraph.push(line)
  }
  flushParagraph(); flushList()
  return <div style={{ display: 'grid', gap: 10, whiteSpace: 'normal' }}>{blocks}</div>
}
