import React from 'react'
import { BLOCK_COLORS } from './Blocks'

// Converts **bold** markers and plain text into React nodes
export function renderInline(text: string): React.ReactNode {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ color: '#E8F0FC', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export function BulletItem({ text, color, index }: { text: string; color: string; index?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ width: 20, height: 20, borderRadius: index !== undefined ? 6 : '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, border: `1px solid ${color}30` }}>
        {index !== undefined
          ? <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: 'monospace' }}>{index}</span>
          : <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'block', boxShadow: `0 0 4px ${color}` }} />
        }
      </div>
      <span style={{ fontSize: 12, color: '#8EA8CC', lineHeight: 1.6, paddingTop: 2, flex: 1 }}>
        {renderInline(text)}
      </span>
    </div>
  )
}

export function FormattedText({ text }: { text: string }) {
  if (!text.trim()) return null
  const rawParas = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rawParas.map((para, pi) => {
        const numberedInline =
          para.match(/\bNumber\s+(?:one|two|three|four|five|six)\s*:/i) ||
          para.match(/\b(?:one|two|three|four|five|six)\s*:\s+[A-Z]/i)
        const dashItems = para.match(/[A-Z][^.!?]*\s+—\s+[^.!?]+[.!?]/g)
        const ordinalInline = para.match(/\b(?:First|Second|Third|Fourth|Fifth)[,.:]/i)
        const bulletLines = para.split('\n').filter((l) => /^[•\-]\s/.test(l.trim()))

        if (bulletLines.length >= 2) {
          const intro = para.split('\n').find((l) => !/^[•\-]\s/.test(l.trim()))?.trim()
          const items = para.split('\n').filter((l) => /^[•\-]\s/.test(l.trim())).map((l) => l.replace(/^[•\-]\s*/, '').trim())
          return (
            <div key={pi}>
              {intro && <p style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.7, margin: '0 0 6px' }}>{renderInline(intro)}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                {items.map((item, ii) => <BulletItem key={ii} text={item} color={BLOCK_COLORS[ii % BLOCK_COLORS.length]} />)}
              </div>
            </div>
          )
        }

        if (numberedInline || ordinalInline) {
          const parts = para
            .split(/(?=\bNumber\s+(?:one|two|three|four|five|six)\s*:|\b(?:First|Second|Third|Fourth|Fifth)[,.:]\s)/i)
            .map((p) => p.trim()).filter(Boolean)
          const isIntro = (p: string) => !/^\bNumber\s+|^\b(?:First|Second|Third|Fourth|Fifth)/i.test(p)
          const intro = parts.find(isIntro)
          const numbered = parts.filter((p) => !isIntro(p))
          if (numbered.length >= 2) {
            return (
              <div key={pi}>
                {intro && <p style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.7, margin: '0 0 8px' }}>{renderInline(intro)}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                  {numbered.map((item, ii) => {
                    const clean = item.replace(/^Number\s+\w+\s*:\s*/i, '').replace(/^\w+[,.:]\s*/i, '').trim()
                    return <BulletItem key={ii} text={clean} color={BLOCK_COLORS[ii % BLOCK_COLORS.length]} index={ii + 1} />
                  })}
                </div>
              </div>
            )
          }
        }

        if (dashItems && dashItems.length >= 2) {
          const preText = para.slice(0, para.indexOf(dashItems[0])).trim()
          return (
            <div key={pi}>
              {preText && <p style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.7, margin: '0 0 8px' }}>{renderInline(preText)}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dashItems.map((item, ii) => {
                  const dashIdx = item.indexOf(' — ')
                  const label = dashIdx >= 0 ? item.slice(0, dashIdx).trim() : item
                  const def   = dashIdx >= 0 ? item.slice(dashIdx + 3).replace(/[.!?]$/, '').trim() : ''
                  const color = BLOCK_COLORS[ii % BLOCK_COLORS.length]
                  return (
                    <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${color}18` }}>
                      <div style={{ background: `${color}15`, borderRight: `2px solid ${color}50`, padding: '6px 10px', minWidth: 110, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1.4 }}>{label}</span>
                      </div>
                      {def && <div style={{ padding: '6px 10px', background: `${color}05` }}>
                        <span style={{ fontSize: 12, color: '#8EA8CC', lineHeight: 1.5 }}>{def}</span>
                      </div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
        if (lines.length === 1) {
          return <p key={pi} style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.75, margin: 0 }}>{renderInline(para)}</p>
        }
        return (
          <div key={pi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((line, li) => (
              <p key={li} style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.75, margin: 0 }}>{renderInline(line)}</p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
