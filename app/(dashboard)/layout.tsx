'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import { PARTS, MODULE_TITLES } from '@/lib/courseData'
import { LogOut, ChevronRight, LayoutDashboard, TrendingUp, Award, BookOpen } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [completedModules, setCompletedModules] = useState<string[]>([])
  const [nextModule, setNextModule] = useState<string | null>(null)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]))

  useEffect(() => {
    const fetchProgress = () => {
      fetch('/api/progress')
        .then(r => r.json() as Promise<{ nextRecommendedModule: string; completedModules: string[] }>)
        .then(d => {
          setNextModule(d.nextRecommendedModule)
          setCompletedModules(d.completedModules || [])
          
          // Auto-expand current part
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
    return () => window.removeEventListener('progress-updated', fetchProgress)
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

  // Current module
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
        
        // Scroll sidebar to the active module
        setTimeout(() => {
          const el = document.getElementById(`sidebar-mod-${activeModule}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        }, 100)
      }
    }
  }, [activeModule])

  return (
    <div id="app" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <nav id="sidebar" style={{ 
        width: 320, minWidth: 320, background: 'var(--bg-dark)', color: '#e8e4d6', 
        display: 'flex', flexDirection: 'column', height: '100vh', borderRight: '1px solid #000',
        fontFamily: '"Inter", "Helvetica Neue", sans-serif'
      }}>
        <div id="sidebar-header" style={{ padding: '24px 20px 16px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <h1 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: '"Charter", "Georgia", serif', lineHeight: 1.3 }}>
            UK Bookkeeping,<br />Accounting & Tax
          </h1>
          <div className="course-sub" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8' }}>
            Master Course · 150 hrs · 87 Modules
          </div>
        </div>

        <div id="progress-bar-wrap" style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div className="pb-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#64748b', marginBottom: 5 }}>Progress</div>
          <div id="progress-bar" style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
            <div id="progress-fill" style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--gold))', width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div id="progress-pct" style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {completedCount} / 87 modules
          </div>
        </div>

        <div id="sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 20px' }}>
          
          {/* Main App Links */}
          <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #334155' }}>
            <Link href="/courses" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', color: pathname === '/courses' ? '#fff' : '#cbd5e1', fontSize: 13, fontWeight: 600, background: pathname === '/courses' ? '#1e3a8a' : 'transparent', textDecoration: 'none' }}>
              <BookOpen size={16} /> Course Home
            </Link>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', color: pathname === '/dashboard' ? '#fff' : '#cbd5e1', fontSize: 13, fontWeight: 600, background: pathname === '/dashboard' ? '#1e3a8a' : 'transparent', textDecoration: 'none' }}>
              <LayoutDashboard size={16} /> Dashboard
            </Link>
            <Link href="/progress" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', color: pathname === '/progress' ? '#fff' : '#cbd5e1', fontSize: 13, fontWeight: 600, background: pathname === '/progress' ? '#1e3a8a' : 'transparent', textDecoration: 'none' }}>
              <TrendingUp size={16} /> My Progress
            </Link>
            <Link href="/certificate" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', color: pathname === '/certificate' ? '#fff' : '#cbd5e1', fontSize: 13, fontWeight: 600, background: pathname === '/certificate' ? '#1e3a8a' : 'transparent', textDecoration: 'none' }}>
              <Award size={16} /> Certificate
            </Link>
          </div>

          <div style={{ padding: '0 20px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', fontWeight: 700 }}>
            Curriculum
          </div>

          <details className="part-group" open={expandedParts.has(0)} style={{ marginBottom: 2 }} onClick={(e) => { e.preventDefault(); togglePart(0) }}>
            <summary className="part-summary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: expandedParts.has(0) ? '#f1f5f9' : '#94a3b8', userSelect: 'none', listStyle: 'none' }}>
              FRONT MATTER
              <div className="chevron" style={{ fontSize: 11, transition: 'transform 0.2s', flexShrink: 0, marginLeft: 'auto', transform: expandedParts.has(0) ? 'rotate(90deg)' : 'none' }}>
                <ChevronRight size={14} />
              </div>
            </summary>
            
            {expandedParts.has(0) && (
              <ul className="module-list" style={{ listStyle: 'none', margin: 0, padding: '4px 0 12px 0' }}>
                <li>
                  <Link
                    href="/front-matter#welcome"
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', 
                      background: 'none', border: 'none', padding: '6px 20px 6px 28px', 
                      cursor: 'pointer', color: '#94a3b8', fontSize: 12.5, fontFamily: '"Inter", sans-serif', 
                      lineHeight: 1.35, transition: 'all 0.15s', textDecoration: 'none'
                    }}
                  >
                    Welcome &amp; How to Use
                  </Link>
                </li>
                <li>
                  <Link
                    href="/front-matter#contents"
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', 
                      background: 'none', border: 'none', padding: '6px 20px 6px 28px', 
                      cursor: 'pointer', color: '#94a3b8', fontSize: 12.5, fontFamily: '"Inter", sans-serif', 
                      lineHeight: 1.35, transition: 'all 0.15s', textDecoration: 'none'
                    }}
                  >
                    Contents
                  </Link>
                </li>
                <li>
                  <Link
                    href="/front-matter#visuals"
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', 
                      background: 'none', border: 'none', padding: '6px 20px 6px 28px', 
                      cursor: 'pointer', color: '#94a3b8', fontSize: 12.5, fontFamily: '"Inter", sans-serif', 
                      lineHeight: 1.35, transition: 'all 0.15s', textDecoration: 'none'
                    }}
                  >
                    Visual Companions ▸
                  </Link>
                </li>
              </ul>
            )}
          </details>

          {/* Parts & Modules Accordion */}
          {PARTS.map(part => {
            const isOpen = expandedParts.has(part.number)
            return (
              <details key={part.number} className="part-group" open={isOpen} style={{ marginBottom: 2 }} onClick={(e) => { e.preventDefault(); togglePart(part.number) }}>
                <summary className="part-summary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: isOpen ? '#f1f5f9' : '#94a3b8', userSelect: 'none', listStyle: 'none' }}>
                  PART {part.number}: {part.title}
                  <div className="chevron" style={{ fontSize: 11, transition: 'transform 0.2s', flexShrink: 0, marginLeft: 'auto', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                    <ChevronRight size={14} />
                  </div>
                </summary>
                
                {isOpen && (
                  <ul className="module-list" style={{ listStyle: 'none', margin: 0, padding: '4px 0 12px 0' }}>
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
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', 
                              background: isActive ? '#1e3a8a' : 'none', border: 'none', padding: '6px 20px 6px 28px', 
                              cursor: 'pointer', color: isActive ? '#fff' : isCompleted ? '#4ade80' : '#94a3b8', 
                              fontSize: 12.5, fontFamily: '"Inter", sans-serif', lineHeight: 1.35, transition: 'all 0.15s'
                            }}
                          >
                            <span className="mod-num" style={{ fontSize: 10, fontWeight: 700, color: isActive ? '#93c5fd' : 'var(--accent)', flexShrink: 0, minWidth: 28 }}>
                              {mod.toUpperCase()}
                            </span>
                            <span style={{ flex: 1, paddingRight: 8 }}>{MODULE_TITLES[mod]}</span>
                            {isCompleted && <span style={{ fontSize: 10, flexShrink: 0 }}>✓</span>}
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

        <div style={{ padding: '16px 20px', borderTop: '1px solid #334155' }}>
          <button
            onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', color: '#cbd5e1', fontSize: 13, fontWeight: 600 }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </nav>

      <div id="main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {children}
      </div>
    </div>
  )
}
