import React from 'react'

export function TypingIndicator() {
  return (
    <div className="message-enter" style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(78,205,196,0.18), rgba(155,111,208,0.18))',
        border: '1.5px solid rgba(78,205,196,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--ac-cyan)',
        boxShadow: '0 0 12px rgba(78,205,196,0.2)',
      }}>A</div>
      <div style={{
        background: 'rgba(10,14,28,0.82)', border: '1px solid rgba(78,205,196,0.14)',
        borderRadius: '16px 16px 16px 4px', padding: '11px 16px',
        boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {[0, 1, 2].map((i) => <span key={i} className="typing-dot" style={{ display: 'inline-block' }} />)}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginLeft: 4, letterSpacing: '0.06em' }}>
          thinking…
        </span>
      </div>
    </div>
  )
}
