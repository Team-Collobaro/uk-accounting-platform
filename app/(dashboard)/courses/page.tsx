'use client'

import { useRouter } from 'next/navigation'

export default function CoursesPage() {
  const router = useRouter()

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 40px' }}>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-block', background: 'var(--accent)', color: '#fff', 
          padding: '4px 14px', fontSize: 11, letterSpacing: '0.2em', 
          textTransform: 'uppercase', fontFamily: '"Inter", sans-serif', 
          fontWeight: 700, borderRadius: 2, marginBottom: 20 
        }}>
          ACCA / ACA Grade
        </div>
        
        <h2 style={{ fontSize: 38, margin: '0 0 12px', letterSpacing: '-0.01em', lineHeight: 1.15, color: 'var(--accent-2)', fontWeight: 700 }}>
          UK Bookkeeping, Accounting &amp; Tax
        </h2>
        
        <p style={{ color: 'var(--ink-soft)', fontSize: 16, marginBottom: 32, fontFamily: '"Inter", sans-serif', lineHeight: 1.6 }}>
          A 150-hour master course covering every UK business scenario — from incorporation through cessation, with full FRS 102/105 disclosure reasoning.
        </p>
        
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ textAlign: 'center', padding: '16px 20px', background: '#fff', border: '1px solid var(--line)', borderRadius: 6, flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-2)' }}>87</div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', fontFamily: '"Inter", sans-serif' }}>Modules</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 20px', background: '#fff', border: '1px solid var(--line)', borderRadius: 6, flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-2)' }}>12</div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', fontFamily: '"Inter", sans-serif' }}>Parts</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 20px', background: '#fff', border: '1px solid var(--line)', borderRadius: 6, flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-2)' }}>870</div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', fontFamily: '"Inter", sans-serif' }}>MCQs</div>
          </div>
        </div>
        
        <button 
          onClick={() => router.push('/course/m01')}
          style={{ 
            display: 'inline-block', background: 'var(--accent)', color: '#fff', 
            border: 'none', padding: '14px 36px', borderRadius: 6, fontSize: 16, 
            fontFamily: '"Inter", sans-serif', fontWeight: 700, cursor: 'pointer', 
            letterSpacing: '0.02em', textDecoration: 'none', transition: '0.15s' 
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#991b1b'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent)'}
        >
          Begin with Module 1 →
        </button>
      </div>
    </div>
  )
}
