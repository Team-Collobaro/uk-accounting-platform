'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Award,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard', label: 'My Courses', icon: BookOpen },
  { href: '/dashboard', label: 'Progress', icon: TrendingUp },
  { href: '/dashboard', label: 'Certificate', icon: Award },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [studentName, setStudentName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('students')
        .select('name')
        .eq('id', data.user.id)
        .single()
        .then(({ data: s }) => {
          if (s) setStudentName(s.name)
        })
    })
  }, [supabase])

  const initials = studentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isCourse = pathname.startsWith('/course/')

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && !isCourse && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on course pages */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-brand-900 text-white flex flex-col transition-transform duration-200
          ${isCourse ? 'hidden' : sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-brand-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <span className="text-brand-700 font-bold text-sm">UK</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">Accounting Pro</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                  }`}
              >
                <Icon size={18} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-4 py-5 border-t border-brand-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-brand-200 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — hidden on course pages */}
        {!isCourse && (
          <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-4 flex items-center justify-between shrink-0">
            <button
              className="lg:hidden p-1 rounded-lg text-slate-500 hover:text-slate-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-sm text-slate-600 hidden sm:block">{studentName}</span>
              <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">
                {initials || '?'}
              </div>
            </div>
          </header>
        )}

        {/* Page content */}
        <main className={`flex-1 overflow-hidden ${isCourse ? 'p-0' : 'overflow-y-auto p-4 lg:p-8'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
