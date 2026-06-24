'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import {
  LayoutDashboard, BookOpen, TrendingUp, Award, LogOut,
  Menu, X, Brain, Sparkles, ChevronLeft, ChevronRight, Play,
} from 'lucide-react'
import LiquidEther from '@/components/LiquidEther'
import ShinyText from '@/components/reactbits/ShinyText'
import ThemeToggle from '@/components/ThemeToggle'

const navLinks = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, color: '#4ECDC4', glow: '78,205,196',  hint: 'Overview & progress' },
  { href: '/courses',     label: 'My Courses',  icon: BookOpen,         color: '#9B6FD0', glow: '155,111,208', hint: 'Browse all 87 modules' },
  { href: '/progress',    label: 'Progress',    icon: TrendingUp,       color: '#52D98B', glow: '82,217,139',  hint: 'Quiz scores & stats' },
  { href: '/certificate', label: 'Certificate', icon: Award,            color: '#E8B84B', glow: '232,184,75',  hint: 'View your certificate' },
]

const EXPANDED_W = 248
const COLLAPSED_W = 66

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [studentName,    setStudentName]    = useState('')
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [collapsed,      setCollapsed]      = useState(false)
  const [nextModule,     setNextModule]     = useState<string | null>(null)
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('students').select('name').eq('id', data.user.id).single()
        .then(({ data: s }) => { if (s) setStudentName(s.name) })
    })
    fetch('/api/progress')
      .then(r => r.json() as Promise<{ nextRecommendedModule: string; completedModules: string[] }>)
      .then(d => { setNextModule(d.nextRecommendedModule); setCompletedCount(d.completedModules?.length ?? 0) })
      .catch(() => {})
  }, [supabase])

  const initials = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const sideW = collapsed ? COLLAPSED_W : EXPANDED_W

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isCourse = pathname.startsWith('/course/')
  if (isCourse) return <>{children}</>

  return (
    <div style={{
      display: 'flex', height: '100vh',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── LiquidEther fluid sim background ── */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
      }}>
        <LiquidEther
          colors={['#4ECDC4', '#5B78D8', '#9B6FD0', '#FF6FD8']}
          mouseForce={0}
          cursorSize={0}
          resolution={0.4}
          autoDemo={true}
          autoSpeed={0.35}
          autoIntensity={1.8}
          autoResumeDelay={2000}
          autoRampDuration={0.8}
          style={{ width: '100%', height: '100%', opacity: 0.55 }}
        />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,10,0.72)', zIndex: 20, backdropFilter: 'blur(6px)' }}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar wrapper ── */}
      <div style={{ position: 'relative', flexShrink: 0, zIndex: 30 }}>

        <motion.aside
          animate={{ width: sideW }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{
            height: '100vh',
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--sidebar-border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            position: 'relative',
          }}
        >


          {/* ── Logo row ── */}
          <div style={{
            padding: collapsed ? '20px 0' : '20px 18px 16px',
            borderBottom: '1px solid rgba(0,220,255,0.07)',
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 12, transition: 'padding 0.2s',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(0,220,255,0.2), rgba(150,50,255,0.3))',
              border: '1px solid rgba(0,220,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(0,220,255,0.25), 0 0 40px rgba(150,50,255,0.15)',
            }}>
              <Brain size={19} color="var(--ac-cyan)" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  <p style={{ fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }} className="text-sm">UK Accounting</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>



          {/* ── Nav links ── */}
          <nav style={{
            flex: 1, padding: collapsed ? '18px 10px' : '18px 12px',
            display: 'flex', flexDirection: 'column', gap: 5,
            overflowY: 'auto', overflowX: 'hidden',
          }}>
            {navLinks.map(({ href, label, icon: Icon, color, glow }) => {
              const active = pathname === href
              return (
                <Link key={label} href={href} style={{ textDecoration: 'none' }} title={collapsed ? label : undefined}>
                  <div
                    className={`nav-item-${glow.replace(/,/g,'')}`}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 12,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '12px 0' : '10px 14px',
                      borderRadius: 12,
                      background: active ? `rgba(${glow},0.1)` : 'transparent',
                      border: active ? `1px solid rgba(${glow},0.32)` : '1px solid transparent',
                      transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                      position: 'relative',
                      cursor: 'pointer',
                      boxShadow: active ? `0 0 20px rgba(${glow},0.12), inset 0 0 12px rgba(${glow},0.06)` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = `rgba(${glow},0.06)`
                        el.style.borderColor = `rgba(${glow},0.18)`
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'transparent'
                        el.style.borderColor = 'transparent'
                      }
                    }}
                  >
                    <Icon size={18} color={active ? color : 'var(--text-tertiary)'} style={{ flexShrink: 0, transition: 'color 0.18s' }} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.16 }}
                          style={{
                            fontWeight: active ? 600 : 400,
                            color: active ? color : 'var(--text-secondary)',
                            whiteSpace: 'nowrap', overflow: 'hidden',
                          }} className="text-small"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {active && !collapsed && (
                      <motion.div
                        layoutId="activeNavDot"
                        style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }}
                      />
                    )}
                    {active && collapsed && (
                      <div style={{
                        position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                        width: 3, height: 18, borderRadius: 2,
                        background: color, boxShadow: `0 0 8px ${color}`,
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* ── Continue Learning quick button ── */}
          {nextModule && (
            <div style={{ padding: collapsed ? '0 10px 10px' : '0 12px 10px' }}>
              <Link href={`/course/${nextModule}`} style={{ textDecoration: 'none' }} title={collapsed ? `Continue: ${nextModule.toUpperCase()}` : undefined}>
                <motion.div
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 10,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '10px 14px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg,rgba(78,205,196,0.14),rgba(82,217,139,0.1))',
                    border: '1px solid rgba(78,205,196,0.3)',
                    boxShadow: '0 0 16px rgba(78,205,196,0.1)',
                    cursor: 'pointer',
                  }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(78,205,196,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Play size={10} color="#4ECDC4" style={{ marginLeft: 1 }} />
                  </div>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.16 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <p style={{ fontFamily: 'monospace', color: 'rgba(78,205,196,0.55)', letterSpacing: '0.1em', marginBottom: 1 }} className="text-[9px]">CONTINUE</p>
                        <p style={{ fontWeight: 700, color: '#4ECDC4' }} className="text-tiny">{nextModule.toUpperCase()}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
              {!collapsed && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <span style={{ color: '#4A6285', fontFamily: 'monospace' }} className="text-[9px]">{completedCount}/87 DONE</span>
                  <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.05)', margin: '0 8px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(completedCount / 87 * 100)}%`, height: '100%', background: '#4ECDC4', borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ color: '#4ECDC4', fontFamily: 'monospace' }} className="text-[9px]">{Math.round(completedCount / 87 * 100)}%</span>
                </div>
              )}
            </div>
          )}

          {/* ── User + sign out ── */}
          <div style={{
            padding: collapsed ? '14px 10px' : '14px 12px',
            borderTop: '1px solid var(--sidebar-border)',
          }}>
            {!collapsed ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', marginBottom: 6,
                  background: 'rgba(0,220,255,0.03)',
                  border: '1px solid rgba(0,220,255,0.08)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(0,220,255,0.3), rgba(150,50,255,0.35))',
                    border: '1px solid rgba(0,220,255,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ac-cyan)',
                    boxShadow: '0 0 12px rgba(0,220,255,0.2)',
                  }} className="text-xs">
                    {initials || '?'}
                  </div>
                  <p style={{ fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, margin: 0 }} className="text-xs">
                    {studentName}
                  </p>
                </div>
                {/* Theme toggle — expanded */}
                <div style={{ marginBottom: 6 }}>
                  <ThemeToggle collapsed={false} />
                </div>
                <motion.button
                  whileHover={{ x: 3 }} onClick={handleSignOut}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 14px', background: 'none', border: 'none', borderRadius: 10,
                    cursor: 'pointer', color: 'var(--text-tertiary)'
                  }} className="text-small"
                >
                  <LogOut size={15} color="var(--text-tertiary)" />
                  Sign out
                </motion.button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0,220,255,0.28), rgba(150,50,255,0.32))',
                  border: '1px solid rgba(0,220,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ac-cyan)', cursor: 'default',
                }} title={studentName} className="text-xs">
                  {initials || '?'}
                </div>
                {/* Theme toggle — collapsed (icon only, cycles through) */}
                <ThemeToggle collapsed={true} />
                <motion.button
                  whileHover={{ scale: 1.14 }} onClick={handleSignOut} title="Sign out"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, cursor: 'pointer',
                  }}
                >
                  <LogOut size={15} color="var(--text-tertiary)" />
                </motion.button>
              </div>
            )}
          </div>
        </motion.aside>

        {/* ── Collapse toggle ── */}
        <motion.button
          animate={{ left: sideW - 13 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute', top: 26, zIndex: 40,
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--bg-base)',
            border: '1px solid rgba(0,220,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 0 14px rgba(0,220,255,0.3), 0 0 28px rgba(150,50,255,0.15)',
          }}
        >
          {collapsed
            ? <ChevronRight size={13} color="var(--text-secondary)" />
            : <ChevronLeft  size={13} color="var(--text-secondary)" />}
        </motion.button>

      </div>{/* end sidebar wrapper */}

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <header style={{
          borderBottom: '1px solid var(--sidebar-border)',
          padding: '13px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--header-bg)',
          backdropFilter: 'blur(24px) saturate(160%)',
        }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden"
            style={{ padding: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,220,255,0.1)', borderRadius: 9, cursor: 'pointer' }}
          >
            {mobileOpen
              ? <X    size={18} color="var(--text-secondary)" />
              : <Menu size={18} color="var(--text-secondary)" />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            <span style={{ color: 'var(--text-secondary)' }} className="text-small">{studentName}</span>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,220,255,0.24), rgba(150,50,255,0.28))',
              border: '1px solid rgba(0,220,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ac-cyan)',
              boxShadow: '0 0 14px rgba(0,220,255,0.22)',
            }} className="text-xs">
              {initials || '?'}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
