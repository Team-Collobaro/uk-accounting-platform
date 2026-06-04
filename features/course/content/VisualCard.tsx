import React from 'react'

export function VisualCard({ svg }: { svg: string }) {
  return (
    <div
      className="visual-card-enter"
      style={{
        marginTop: 8, borderRadius: 14, overflow: 'hidden',
        border: '1px solid rgba(78,205,196,0.18)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(78,205,196,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
        width: '100%', maxWidth: 520,
      }}
    >
      <div style={{ lineHeight: 0, display: 'block' }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
