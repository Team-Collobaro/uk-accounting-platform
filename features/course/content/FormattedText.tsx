import React from 'react'

// Converts **bold** markers and plain text into React nodes
export function renderInline(text: string): React.ReactNode {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export function BulletItem({ text, index }: { text: string; color?: string; index?: number }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] font-semibold text-muted-foreground">
        {index !== undefined
          ? index
          : <span className="block h-1 w-1 rounded-full bg-muted-foreground" />}
      </div>
      <span className="flex-1 pt-0.5 text-sm leading-relaxed text-muted-foreground">
        {renderInline(text)}
      </span>
    </div>
  )
}

export function FormattedText({ text }: { text: string }) {
  if (!text.trim()) return null
  const rawParas = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  return (
    <div className="flex flex-col gap-2">
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
              {intro && <p className="mb-1.5 text-sm leading-relaxed text-foreground/90">{renderInline(intro)}</p>}
              <div className="flex flex-col gap-1 pl-1">
                {items.map((item, ii) => <BulletItem key={ii} text={item} />)}
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
          if (numbered.length >= 1) {
            return (
              <div key={pi}>
                {intro && <p className="mb-2 text-sm leading-relaxed text-foreground/90">{renderInline(intro)}</p>}
                <div className="flex flex-col gap-1 pl-1">
                  {numbered.map((item, ii) => {
                    const clean = item.replace(/^Number\s+\w+\s*:\s*/i, '').replace(/^\w+[,.:]\s*/i, '').trim()
                    return <BulletItem key={ii} text={clean} index={ii + 1} />
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
              {preText && <p className="mb-2 text-sm leading-relaxed text-foreground/90">{renderInline(preText)}</p>}
              <div className="flex flex-col gap-1">
                {dashItems.map((item, ii) => {
                  const dashIdx = item.indexOf(' — ')
                  const label = dashIdx >= 0 ? item.slice(0, dashIdx).trim() : item
                  const def   = dashIdx >= 0 ? item.slice(dashIdx + 3).replace(/[.!?]$/, '').trim() : ''
                  return (
                    <div key={ii} className="flex items-stretch overflow-hidden rounded-md border">
                      <div className="min-w-[110px] shrink-0 border-r bg-muted px-2.5 py-1.5">
                        <span className="text-xs font-semibold leading-snug text-foreground">{label}</span>
                      </div>
                      {def && (
                        <div className="px-2.5 py-1.5">
                          <span className="text-sm leading-snug text-muted-foreground">{def}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
        if (lines.length === 1) {
          return <p key={pi} className="text-sm leading-relaxed text-foreground/90">{renderInline(para)}</p>
        }
        return (
          <div key={pi} className="flex flex-col gap-1">
            {lines.map((line, li) => (
              <p key={li} className="text-sm leading-relaxed text-foreground/90">{renderInline(line)}</p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
