import React from 'react'
import type { LabeledItem } from '@/types/course'

export const BLOCK_COLORS = ['#4ECDC4', '#9B6FD0', '#52D98B', '#E8B84B', '#E87B6F']

function KeyCardsBlock({
  title, items, accentColor, numbered, connector,
}: {
  title: string
  items: LabeledItem[]
  accentColor: string
  numbered: boolean
  connector?: boolean
}) {
  return (
    <div
      className="visual-card-enter"
      style={{
        marginTop: 12, borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${accentColor}22`, background: 'rgba(4,6,14,0.82)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}08`,
      }}
    >
      <div style={{
        padding: '9px 14px 8px', borderBottom: `1px solid ${accentColor}18`,
        background: `linear-gradient(90deg, ${accentColor}0d 0%, transparent 100%)`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
        <p style={{ fontSize: 10, fontWeight: 700, color: accentColor, fontFamily: 'monospace', letterSpacing: '0.13em', textTransform: 'uppercase', margin: 0 }}>
          {title}
        </p>
      </div>

      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: connector ? 0 : 7 }}>
        {items.map((item, i) => {
          const color = BLOCK_COLORS[i % BLOCK_COLORS.length]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 0, position: 'relative' }}>
              {connector && i < items.length - 1 && (
                <div style={{ position: 'absolute', left: 15, top: 30, bottom: -10, width: 1, background: `${color}25`, zIndex: 0 }} />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: connector ? '0 0 14px' : 0, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: numbered ? 9 : '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                  background: `${color}14`, border: `1px solid ${color}38`, color,
                  boxShadow: `0 0 10px ${color}18`,
                }}>
                  {numbered ? i + 1 : '▸'}
                </div>
                <div style={{
                  flex: 1, minWidth: 0, background: `${color}07`,
                  border: `1px solid ${color}18`, borderLeft: `3px solid ${color}70`,
                  borderRadius: '0 10px 10px 0', padding: '8px 12px',
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color, margin: '0 0 3px', lineHeight: 1.3 }}>{item.label}</p>
                  {item.desc && <p style={{ fontSize: 12, color: '#8EA8CC', margin: 0, lineHeight: 1.6 }}>{item.desc}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PillarsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} accentColor="#4ECDC4" numbered={true} />
}

export function StepsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} accentColor="#9B6FD0" numbered={true} connector={true} />
}

export function TermsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} accentColor="#E8B84B" numbered={false} />
}
