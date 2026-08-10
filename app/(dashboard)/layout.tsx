'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import { PARTS, MODULE_TITLES } from '@/lib/courseData'
import { LogOut, LayoutDashboard, TrendingUp, Award, BookOpen } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [completedModules, setCompletedModules] = useState<string[]>([])
  const [nextModule, setNextModule] = useState<string | null>(null)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]))
  const [readingPct, setReadingPct] = useState(0)

  useEffect(() => {
    const fetchProgress = () => {
      fetch('/api/progress')
        .then(r => r.json() as Promise<{ nextRecommendedModule: string; completedModules: string[] }>)
        .then(d => {
          setNextModule(d.nextRecommendedModule)
          setCompletedModules(d.completedModules || [])
          if (d.nextRecommendedModule) {
            const part = PARTS.find(p => p.modules.includes(d.nextRecommendedModule))
            if (part) {
              setExpandedParts(prev => {
                const next = new Set(prev)
                next.add(part.number)
                return next
              })
            }
          }
        })
        .catch(() => {})
    }

    fetchProgress()
    window.addEventListener('progress-updated', fetchProgress)

    const handleReadingProgress = (e: Event) => {
      setReadingPct((e as CustomEvent).detail)
    }
    window.addEventListener('reading-progress', handleReadingProgress)

    return () => {
      window.removeEventListener('progress-updated', fetchProgress)
      window.removeEventListener('reading-progress', handleReadingProgress)
    }
  }, [])

  const togglePart = (n: number) => {
    setExpandedParts(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const completedCount = completedModules.length
  const progressPct = Math.round((completedCount / 87) * 100)

  const currentModuleMatch = pathname.match(/\/course\/(m\d+)/)
  const activeModule = currentModuleMatch ? currentModuleMatch[1] : null

  useEffect(() => {
    if (activeModule) {
      const part = PARTS.find(p => p.modules.includes(activeModule))
      if (part) {
        setExpandedParts(prev => {
          const next = new Set(prev)
          next.add(part.number)
          return next
        })
        setTimeout(() => {
          const el = document.getElementById(`sidebar-mod-${activeModule}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 100)
      }
    }
  }, [activeModule])

  return (
    <div id="app" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <nav id="sidebar" style={{
        width: 300, minWidth: 300, background: 'var(--bg-dark)', color: '#e8e4d6',
        display: 'flex', flexDirection: 'column', height: '100vh',
        borderRight: '1px solid #000',
        fontFamily: '"Inter", "Helvetica Neue", sans-serif', fontSize: 14,
      }}>

        {/* ─ Header ─ */}
        <div style={{ padding: '22px 20px 14px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <h2 style={{
            margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#fff',
            fontFamily: '"Charter", "Georgia", serif', lineHeight: 1.3, letterSpacing: '-0.01em',
          }}>
            UK Bookkeeping,<br />Accounting &amp; Tax
          </h2>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#475569', marginTop: 2 }}>
            Master Course · 150 hrs · 87 Modules
          </div>
        </div>

        {/* ─ Progress bar ─ */}
        <div style={{ padding: '11px 20px 13px', background: '#0f172a', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#475569' }}>Course Progress</div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{progressPct}%</div>
          </div>
          <div style={{ height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), var(--gold))',
              width: `${progressPct}%`,
              transition: 'width 0.5s ease',
              borderRadius: 3,
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 5, marginBottom: 10 }}>
            {completedCount} of 87 modules completed
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#475569' }}>Reading Progress</div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{readingPct}%</div>
          </div>
          <div style={{ height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #059669)',
              width: `${readingPct}%`,
              transition: 'width 0.2s ease-out',
              borderRadius: 3,
            }} />
          </div>
        </div>

        {/* ─ Nav ─ */}
        <div id="sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '12px 0 16px' }}>

          {/* Main app links */}
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
            {([
              { href: '/courses',     label: 'Course Home', Icon: BookOpen },
              { href: '/dashboard',   label: 'Dashboard',   Icon: LayoutDashboard },
              { href: '/progress',    label: 'My Progress', Icon: TrendingUp },
              { href: '/certificate', label: 'Certificate', Icon: Award },
            ] as const).map(({ href, label, Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '8px 20px',
                  color: active ? '#fff' : '#64748b',
                  fontSize: 12.5, fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(185,28,28,0.14)' : 'transparent',
                  borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  textDecoration: 'none', transition: 'all 0.15s',
                }}>
                  <Icon size={14} />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Curriculum label */}
          <div style={{ padding: '0 20px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#334155', fontWeight: 700 }}>
            Curriculum
          </div>

          {/* Front matter accordion */}
          <details
            className="part-group"
            open={expandedParts.has(0)}
            style={{ marginBottom: 1 }}
            onClick={(e) => { e.preventDefault(); togglePart(0) }}
          >
            <summary className="part-summary" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 20px', cursor: 'pointer',
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: expandedParts.has(0) ? '#f1f5f9' : '#475569',
              borderLeft: `2px solid ${expandedParts.has(0) ? 'var(--accent)' : 'transparent'}`,
              userSelect: 'none', listStyle: 'none', transition: 'all 0.15s',
            }}>
              <span style={{
                fontSize: 9, marginRight: 2, display: 'inline-block',
                transform: expandedParts.has(0) ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s',
              }}>▸</span>
              Front Matter
            </summary>
            {expandedParts.has(0) && (
              <ul style={{ listStyle: 'none', margin: 0, padding: '2px 0 8px 0' }}>
                {[
                  { href: '/front-matter#welcome',  label: 'Welcome & How to Use' },
                  { href: '/front-matter#contents', label: 'Contents' },
                  { href: '/front-matter#visuals',  label: 'Visual Companions ▸' },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} style={{
                      display: 'block', padding: '5px 20px 5px 30px',
                      color: '#475569', fontSize: 12, lineHeight: 1.35,
                      textDecoration: 'none', transition: 'color 0.15s',
                    }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </details>

          {/* Parts & Modules */}
          {PARTS.map(part => {
            const isOpen = expandedParts.has(part.number)
            return (
              <details
                key={part.number}
                className="part-group"
                open={isOpen}
                style={{ marginBottom: 1 }}
                onClick={(e) => { e.preventDefault(); togglePart(part.number) }}
              >
                <summary className="part-summary" style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 20px', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: isOpen ? '#f1f5f9' : '#475569',
                  borderLeft: `2px solid ${isOpen ? 'var(--accent)' : 'transparent'}`,
                  userSelect: 'none', listStyle: 'none', transition: 'all 0.15s',
                }}>
                  <span style={{
                    fontSize: 9, marginRight: 2, display: 'inline-block', flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s',
                  }}>▸</span>
                  <span style={{ flex: 1 }}>Part {part.number}: {part.title}</span>
                </summary>

                {isOpen && (
                  <ul className="module-list" style={{ listStyle: 'none', margin: 0, padding: '2px 0 8px 0' }}>
                    {part.modules.map(mod => {
                      const isCompleted = completedModules.includes(mod)
                      const isActive = activeModule === mod
                      return (
                        <li key={mod}>
                          <button
                            id={`sidebar-mod-${mod}`}
                            onClick={(e) => { e.stopPropagation(); router.push(`/course/${mod}`) }}
                            className={`module-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7,
                              width: '100%', textAlign: 'left',
                              background: isActive ? 'rgba(30,58,138,0.35)' : 'none',
                              borderLeft: `3px solid ${isActive ? 'var(--accent-2)' : 'transparent'}`,
                              border: 'none', borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                              padding: '5px 14px 5px 24px',
                              cursor: 'pointer',
                              color: isActive ? '#fff' : isCompleted ? '#4ade80' : '#475569',
                              fontSize: 12, fontFamily: '"Inter", sans-serif', lineHeight: 1.35,
                              transition: 'all 0.15s',
                            }}
                          >
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0, minWidth: 26,
                              color: isActive ? '#93c5fd' : 'var(--accent)',
                            }}>
                              {mod.toUpperCase()}
                            </span>
                            <span style={{ flex: 1, paddingRight: 6 }}>{MODULE_TITLES[mod]}</span>
                            {isCompleted && <span style={{ fontSize: 10, color: '#4ade80', flexShrink: 0 }}>✓</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </details>
            )
          })}
        </div>

        {/* ─ Sign out ─ */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '9px 14px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4,
              cursor: 'pointer', color: '#475569', fontSize: 12.5, fontWeight: 500,
              fontFamily: '"Inter", sans-serif', transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            onMouseOut={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </nav>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div id="main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {children}
      </div>
    </div>
  )
}
