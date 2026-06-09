'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import {
  LayoutDashboard, BookOpen, TrendingUp, Award,
  Search, Settings, ChevronDown,
} from 'lucide-react'

const navLinks = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dashboard',  label: 'Courses',      icon: BookOpen },
  { href: '/dashboard',  label: 'Progress',     icon: TrendingUp },
  { href: '/dashboard',  label: 'Certificate',  icon: Award },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClientComponentClient()
  const [studentName, setStudentName] = useState('')
  const [showSignOut, setShowSignOut] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('students').select('name').eq('id', data.user.id).single()
        .then(({ data: s }) => { if (s) setStudentName(s.name) })
    })
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isCourse = pathname.startsWith('/course/')
  if (isCourse) return <>{children}</>

  const initials  = studentName
    ? studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const firstName = studentName.split(' ')[0] || studentName

  const now      = new Date()
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const day      = now.getDate()
  const month    = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const year     = now.getFullYear()
  const dateStr  = `${dayName} · ${day} ${month} ${year}`

  return (
    <div style={{
      display: 'flex', height: '100vh',
      background: '#0c0c0c', color: '#e8e8e8',
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 168, flexShrink: 0,
        borderRight: '1px solid #333',
        display: 'flex', flexDirection: 'column',
        height: '100vh',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 16px', borderBottom: '1px solid #333',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            background: '#1e1e1e', border: '1px solid #333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#e8e8e8',
          }}>
            A
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#e8e8e8' }}>Accounting Pro</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {navLinks.map(({ href, label, icon: Icon }, i) => {
            const active = i === 0 && pathname === '/dashboard'
            return (
              <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 7,
                    background: active ? '#333' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#141414' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Icon size={15} color={active ? '#e8e8e8' : '#888'} />
                  <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? '#e8e8e8' : '#888' }}>
                    {label}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '10px 8px 14px', borderTop: '1px solid #333', position: 'relative' }}>
          {showSignOut && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 8, right: 8,
              background: '#161616', border: '1px solid #252525',
              borderRadius: 8, padding: '4px', marginBottom: 2, zIndex: 10,
            }}>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%', padding: '8px 10px', background: 'none',
                  border: 'none', color: '#aaa', fontSize: 12,
                  cursor: 'pointer', textAlign: 'left', borderRadius: 5,
                }}
              >
                Sign out
              </button>
            </div>
          )}
          <button
            onClick={() => setShowSignOut(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: 7,
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: '#1e1e1e', border: '1px solid #333',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: '#e8e8e8',
            }}>
              {initials}
            </div>
            <span style={{
              fontSize: 12, color: '#aaa', flex: 1, textAlign: 'left',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {firstName || '…'}
            </span>
            <ChevronDown size={11} color="#777" />
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid #333', padding: '12px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#999', letterSpacing: '0.06em', fontWeight: 500 }}>
            {dateStr}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <Search size={15} color="#777" />
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <Settings size={15} color="#777" />
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
