'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import { PARTS, MODULE_TITLES } from '@/lib/courseData'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Award, BookOpen, Check, ChevronDown, LayoutDashboard, LogOut, Menu, TrendingUp, X,
} from 'lucide-react'
import './dashboard-shell.css'

const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/courses', label: 'Course home', Icon: BookOpen },
  { href: '/progress', label: 'My progress', Icon: TrendingUp },
  { href: '/certificate', label: 'Certificate', Icon: Award },
] as const

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [completedModules, setCompletedModules] = useState<string[]>([])
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]))
  const [readingPct, setReadingPct] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    const fetchProgress = () => {
      fetch('/api/progress')
        .then(r => r.json() as Promise<{ nextRecommendedModule: string; completedModules: string[] }>)
        .then(d => {
          setCompletedModules(d.completedModules || [])
          if (d.nextRecommendedModule) {
            const part = PARTS.find(p => p.modules.includes(d.nextRecommendedModule))
            if (part) setExpandedParts(prev => new Set(prev).add(part.number))
          }
        })
        .catch(() => {})
    }

    fetchProgress()
    window.addEventListener('progress-updated', fetchProgress)
    const handleReadingProgress = (event: Event) => setReadingPct((event as CustomEvent).detail)
    window.addEventListener('reading-progress', handleReadingProgress)
    return () => {
      window.removeEventListener('progress-updated', fetchProgress)
      window.removeEventListener('reading-progress', handleReadingProgress)
    }
  }, [])

  const activeModule = pathname.match(/\/course\/(m\d+)/)?.[1] ?? null

  useEffect(() => {
    setIsSidebarOpen(false)
    if (!activeModule) return
    const part = PARTS.find(p => p.modules.includes(activeModule))
    if (part) setExpandedParts(prev => new Set(prev).add(part.number))
    const timer = window.setTimeout(() => {
      document.getElementById(`sidebar-mod-${activeModule}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [activeModule, pathname])

  const togglePart = (partNumber: number) => {
    setExpandedParts(prev => {
      const next = new Set(prev)
      next.has(partNumber) ? next.delete(partNumber) : next.add(partNumber)
      return next
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const completedCount = completedModules.length
  const progressPct = Math.round((completedCount / 87) * 100)

  return (
    <div className="student-shell">
      <header className="student-topbar">
        <Link href="/dashboard" className="student-brand" aria-label="UKATI student dashboard">
          <Image src="/logo-no-background.png" width={56} height={56} alt="UKATI" priority />
          <span className="student-brand-copy"><strong>UKATI</strong><small>Student learning portal</small></span>
        </Link>

        <nav className="student-topnav" aria-label="Student navigation">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={pathname === href ? 'active' : ''}>{label}</Link>
          ))}
        </nav>

        <div className="student-topbar-actions">
          <ThemeToggle collapsed />
          <button className="student-signout-compact" onClick={handleSignOut} type="button"><LogOut size={16} /><span>Sign out</span></button>
          <button
            className="student-menu-button"
            onClick={() => setIsSidebarOpen(open => !open)}
            type="button"
            aria-label={isSidebarOpen ? 'Close course navigation' : 'Open course navigation'}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <div className="student-workspace">
        {isSidebarOpen && <button className="student-sidebar-scrim" aria-label="Close course navigation" onClick={() => setIsSidebarOpen(false)} type="button" />}

        <aside className={`student-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="student-course-summary">
            <span className="student-eyebrow">Your qualification</span>
            <h2>UK Accounting &amp; Tax</h2>
            <p>12 parts · 87 guided modules</p>
          </div>

          <div className="student-progress-panel">
            <div className="student-progress-heading"><span>Course progress</span><strong>{progressPct}%</strong></div>
            <div className="student-progress-track" aria-label={`${progressPct}% course progress`}><i style={{ width: `${progressPct}%` }} /></div>
            <p>{completedCount} of 87 modules complete</p>
            {activeModule && (
              <>
                <div className="student-progress-heading reading"><span>Current lesson</span><strong>{readingPct}%</strong></div>
                <div className="student-progress-track reading" aria-label={`${readingPct}% lesson progress`}><i style={{ width: `${readingPct}%` }} /></div>
              </>
            )}
          </div>

          <nav className="student-sidebar-scroll" aria-label="Course curriculum">
            <div className="student-sidebar-primary">
              {PRIMARY_NAV.map(({ href, label, Icon }) => {
                const active = pathname === href
                return <Link key={href} href={href} className={active ? 'active' : ''}><Icon size={16} /><span>{label}</span></Link>
              })}
            </div>

            <div className="student-sidebar-label">Curriculum</div>
            <button className={`student-part-button ${expandedParts.has(0) ? 'open' : ''}`} onClick={() => togglePart(0)} type="button" aria-expanded={expandedParts.has(0)}>
              <ChevronDown size={14} /><span>Front matter</span>
            </button>
            {expandedParts.has(0) && (
              <div className="student-module-list">
                {[
                  { href: '/front-matter#welcome', label: 'Welcome & how to use' },
                  { href: '/front-matter#contents', label: 'Contents' },
                  { href: '/front-matter#visuals', label: 'Visual companions' },
                ].map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}
              </div>
            )}

            {PARTS.map(part => {
              const open = expandedParts.has(part.number)
              const completedInPart = part.modules.filter(module => completedModules.includes(module)).length
              return (
                <div className="student-part" key={part.number}>
                  <button className={`student-part-button ${open ? 'open' : ''}`} onClick={() => togglePart(part.number)} type="button" aria-expanded={open}>
                    <ChevronDown size={14} /><span><small>Part {part.number}</small>{part.title}</span><em>{completedInPart}/{part.modules.length}</em>
                  </button>
                  {open && (
                    <div className="student-module-list">
                      {part.modules.map(module => {
                        const completed = completedModules.includes(module)
                        const active = module === activeModule
                        return (
                          <button key={module} id={`sidebar-mod-${module}`} className={`${active ? 'active' : ''} ${completed ? 'completed' : ''}`} onClick={() => router.push(`/course/${module}`)} type="button">
                            <span className="student-module-code">{module.toUpperCase()}</span><span>{MODULE_TITLES[module]}</span>{completed && <Check size={12} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="student-sidebar-footer"><button onClick={handleSignOut} type="button"><LogOut size={15} /> Sign out</button></div>
        </aside>

        <main className="student-main" id="main">{children}</main>
      </div>
    </div>
  )
}
