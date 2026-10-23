'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import { LogOut, Crown, ShieldCheck, ExternalLink } from 'lucide-react'
import '../(dashboard)/dashboard-shell.css'

const EMPLOYER_NAV = [
  { href: '/employer', label: 'Talent Directory' },
  { href: '/verify', label: 'Verify Certificates', external: true },
  { href: '/courses', label: 'Curriculum (87)', external: true },
]

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [userEmail, setUserEmail] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUserEmail(data.user.email)
        const company = data.user.user_metadata?.company_name
        if (company) setCompanyName(company)
      }
    })
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login?role=employer')
  }

  return (
    <div className="student-shell min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Floating Glassmorphic Topbar — Exact same structure & CSS classes as Student Navbar */}
      <header className="student-topbar">
        {/* Brand */}
        <Link href="/employer" className="student-brand" aria-label="UKATI employer portal">
          <Image src="/logo-no-background.png" width={56} height={56} alt="UKATI" priority />
          <span className="student-brand-copy">
            <strong>UKATI</strong>
            <small>Employer Talent Portal</small>
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="student-topnav" aria-label="Employer navigation">
          {EMPLOYER_NAV.map(({ href, label, external }) => {
            const isActive = pathname === href
            return external ? (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5"
              >
                <span>{label}</span>
                <ExternalLink size={11} className="opacity-60" />
              </a>
            ) : (
              <Link key={href} href={href} className={isActive ? 'active' : ''}>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right Actions */}
        <div className="student-topbar-actions">
          {/* Company Badge */}
          {(companyName || userEmail) && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{
                background: 'rgba(212,165,55,0.12)',
                color: 'var(--gold)',
                border: '1px solid rgba(212,165,55,0.3)',
              }}
            >
              <Crown size={13} />
              <span className="max-w-[140px] truncate">{companyName || userEmail.split('@')[0]}</span>
            </div>
          )}

          {/* Theme Toggle (Exact same compact button as Student Navbar) */}
          <ThemeToggle collapsed />

          {/* Sign Out Button (Exact same compact button as Student Navbar) */}
          <button
            className="student-signout-compact"
            onClick={handleSignOut}
            type="button"
            title="Sign out"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace below floating topbar */}
      <div className="student-workspace" style={{ flexDirection: 'column', padding: '110px 20px 40px' }}>
        <main className="max-w-7xl w-full mx-auto flex-1">
          {children}
        </main>
      </div>

      {/* UKATI Footer */}
      <footer
        className="border-t py-6 px-4 text-center text-xs mt-auto"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="m-0">
            © {new Date().getFullYear()} UK Accounting &amp; Taxation Institute (UKATI) · Team Collaboro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/verify" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
              Public Verification
            </Link>
            <span>•</span>
            <span style={{ color: 'var(--gold)' }}>Exam-Verified Talent Matching</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
