import React from 'react'
import type { MCQData } from '@/types/course'

const COLORS: Record<string, string> = { A: '#4ECDC4', B: '#9B6FD0', C: '#52D98B', D: '#E8B84B' }

export function MCQBlock({ data, onAnswer, answered }: {
  data: MCQData
  onAnswer: (letter: string, text: string) => void
  answered: string | null
}) {
  return (
    <div className="visual-card-enter" style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(78,205,196,0.18)', background: 'rgba(5,8,16,0.75)' }}>
      <div style={{ padding: '10px 14px 9px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#4ECDC4', fontFamily: 'monospace' }}>?</span>
        </div>
        <p style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{data.question}</p>
      </div>

      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.options.map((opt) => {
          const isSelected = answered === opt.letter
          const isCorrect  = answered !== null && opt.letter === data.correct
          const isWrong    = answered === opt.letter && opt.letter !== data.correct
          const color = COLORS[opt.letter] ?? '#4ECDC4'

          let bg = 'rgba(255,255,255,0.02)'
          let border = 'rgba(255,255,255,0.08)'
          let textColor = '#8EA8CC'
          if (isCorrect && answered !== null) { bg = 'rgba(82,217,139,0.1)'; border = 'rgba(82,217,139,0.35)'; textColor = '#52D98B' }
          else if (isWrong)                   { bg = 'rgba(232,123,111,0.1)'; border = 'rgba(232,123,111,0.35)'; textColor = '#E87B6F' }
          else if (isSelected)                { bg = `${color}12`; border = `${color}40`; textColor = color }

          return (
            <button
              key={opt.letter}
              disabled={answered !== null}
              onClick={() => onAnswer(opt.letter, `${opt.letter}. ${opt.text}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: bg, border: `1px solid ${border}`, cursor: answered !== null ? 'default' : 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.18s' }}
              onMouseEnter={(e) => { if (answered === null) (e.currentTarget as HTMLElement).style.background = `${color}10` }}
              onMouseLeave={(e) => { if (answered === null) (e.currentTarget as HTMLElement).style.background = bg }}
            >
              <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: 'monospace', background: `${color}18`, border: `1px solid ${color}35`, color }}>
                {opt.letter}
              </div>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: textColor, flex: 1 }}>{opt.text}</span>
              {isCorrect && answered !== null && <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>}
              {isWrong                          && <span style={{ fontSize: 14, flexShrink: 0 }}>✗</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
