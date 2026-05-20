'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import {
  LayoutDashboard, BookOpen, TrendingUp, Award, LogOut,
  Menu, X, Brain, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard, color: '#00ffff' },
  { href: '/dashboard', label: 'My Courses',  icon: BookOpen,         color: '#a855f7' },
  { href: '/dashboard', label: 'Progress',    icon: TrendingUp,       color: '#22c55e' },
  { href: '/dashboard', label: 'Certificate', icon: Award,            color: '#f59e0b' },
]

const EXPANDED_W = 240
const COLLAPSED_W = 64

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [studentName, setStudentName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('students').select('name').eq('id', data.user.id).single()
        .then(({ data: s }) => { if (s) setStudentName(s.name) })
    })
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
    <div style={{ display: 'flex', height: '100vh', background: '#060a12', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', overflow: 'hidden' }}>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 20, backdropFilter: 'blur(4px)' }} />
        )}
      </AnimatePresence>

      {/* ── Sidebar wrapper — overflow visible so toggle button peeks out ── */}
      <div style={{ position: 'relative', flexShrink: 0, zIndex: 30 }}>
      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sideW }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          height: '100vh',
          background: 'rgba(6,10,18,0.97)', borderRight: '1px solid rgba(0,255,255,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* ── Logo row ── */}
        <div style={{ padding: collapsed ? '20px 0' : '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, transition: 'padding 0.2s' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,rgba(0,255,255,0.25),rgba(120,0,255,0.25))', border: '1px solid rgba(0,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(0,255,255,0.15)' }}>
            <Brain size={18} color="#00ffff" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>UK Accounting</p>
                <p style={{ fontSize: 10, color: '#00ffff', margin: 0, fontFamily: 'monospace', letterSpacing: '0.1em' }}>PRO</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* toggle button rendered in wrapper, not here */}

        {/* ── AI status pill ── */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ margin: '14px 14px 0', padding: '10px 14px', background: 'rgba(0,255,255,0.05)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                </motion.div>
                <Sparkles size={13} color="rgba(0,255,255,0.6)" />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>ALEX ONLINE</span>
              </div>
            </motion.div>
          )}
          {collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ margin: '14px auto 0', width: 36, display: 'flex', justifyContent: 'center' }}>
              <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nav links ── */}
        <nav style={{ flex: 1, padding: collapsed ? '16px 10px' : '16px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', overflowX: 'hidden' }}>
          {navLinks.map(({ href, label, icon: Icon, color }) => {
            const active = pathname === href
            return (
              <Link key={label} href={href} style={{ textDecoration: 'none' }} title={collapsed ? label : undefined}>
                <motion.div whileHover={{ x: collapsed ? 0 : 3, scale: collapsed ? 1.08 : 1 }} whileTap={{ scale: 0.95 }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 11,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '11px 0' : '10px 14px',
                    borderRadius: 11,
                    background: active ? `${color}14` : 'transparent',
                    border: active ? `1px solid ${color}35` : '1px solid transparent',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}>
                  <Icon size={18} color={active ? color : 'rgba(255,255,255,0.35)'} style={{ flexShrink: 0 }} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.16 }}
                        style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? color : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {active && !collapsed && (
                    <div style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                  )}
                  {active && collapsed && (
                    <div style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}` }} />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* ── User + sign out ── */}
        <div style={{ padding: collapsed ? '14px 10px' : '14px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(0,255,255,0.3),rgba(120,0,255,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00ffff', flexShrink: 0 }}>
                  {initials || '?'}
                </div>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, margin: 0 }}>{studentName}</p>
              </div>
              <motion.button whileHover={{ x: 2 }} onClick={handleSignOut}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                <LogOut size={15} color="rgba(255,255,255,0.3)" />
                Sign out
              </motion.button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(0,255,255,0.3),rgba(120,0,255,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00ffff', cursor: 'default' }} title={studentName}>
                {initials || '?'}
              </div>
              <motion.button whileHover={{ scale: 1.12 }} onClick={handleSignOut} title="Sign out"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer' }}>
                <LogOut size={15} color="rgba(255,255,255,0.3)" />
              </motion.button>
            </div>
          )}
        </div>
      </motion.aside>

        {/* ── Collapse toggle — lives in wrapper so it's not clipped ── */}
        <motion.button
          animate={{ left: sideW - 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute', top: 26, zIndex: 40,
            width: 24, height: 24, borderRadius: '50%',
            background: '#060a12', border: '1px solid rgba(0,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 0 12px rgba(0,255,255,0.2)',
          }}
        >
          {collapsed
            ? <ChevronRight size={12} color="rgba(0,255,255,0.8)" />
            : <ChevronLeft  size={12} color="rgba(0,255,255,0.8)" />}
        </motion.button>

      </div>{/* end sidebar wrapper */}

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'rgba(6,10,18,0.8)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden"
            style={{ padding: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer' }}>
            {mobileOpen ? <X size={18} color="rgba(255,255,255,0.6)" /> : <Menu size={18} color="rgba(255,255,255,0.6)" />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{studentName}</span>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(0,255,255,0.25),rgba(120,0,255,0.25))', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00ffff' }}>
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
