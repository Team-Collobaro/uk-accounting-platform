import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { supabaseAdmin } from '@/lib/supabase-server'
import '@/components/landing/landing.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Joined Employers & Partner Practices | UKATI',
  description: 'Explore verified employers and accountancy practices that have joined the UKATI network to discover and recruit top accounting talent.',
}

export default async function EmployersPage() {
  const { data: dbEmployers, error } = await supabaseAdmin
    .from('employers')
    .select('id, company_name, plan, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching employers:', error)
  }

  // Strictly real employers from database — no dummy data
  const employers = dbEmployers ?? []

  return (
    <div className="lp">
      {/* ── Top Header ── */}
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-brand" aria-label="UKATI home">
            <Image src="/logo-no-background.png" alt="UKATI logo" width={68} height={68} priority />
            <span className="lp-brand-text">
              <span className="lp-brand-l1">UK</span>
              <span className="lp-brand-l2">Accounting &amp; Taxation</span>
              <span className="lp-brand-l3">Institute</span>
            </span>
          </Link>

          <nav className="lp-nav" aria-label="Primary">
            <Link href="/">Home</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#credentials">Credentials</Link>
            <Link href="/employers" style={{ color: 'var(--lp-teal)', fontWeight: 700 }}>Employers</Link>
          </nav>

          <div className="lp-header-actions">
            <ThemeToggle collapsed />
            <Link href="/login?role=employer" className="lp-btn lp-btn-text lp-hide-sm" id="header-employer-login">
              Employer Sign in
            </Link>
            <Link href="/register?role=employer" className="lp-btn lp-btn-gold lp-hide-sm" id="header-employer-register">
              Register Practice
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Page Hero ── */}
        <section className="lp-section" style={{ paddingTop: 'clamp(40px, 6vh, 68px)', paddingBottom: '48px' }}>
          <div className="lp-container">
            <div className="lp-section-head center" style={{ maxWidth: 840, marginInline: 'auto', marginBottom: 44 }}>
              <span className="lp-eyebrow">Accredited Hiring Directory</span>
              <h1 className="lp-h2" style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginTop: 16 }}>
                Employers &amp; Practices <span className="lp-gold-text">Joined With UKATI</span>
              </h1>
              <p className="lp-lead" style={{ fontSize: 18, marginTop: 16 }}>
                Accountancy firms, practices, and corporate finance teams that have joined the UKATI network to discover top proctored exam performers, inspect live candidate transcripts, and recruit qualified accounting talent.
              </p>

              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
                <Link href="/employer" className="lp-btn lp-btn-gold lp-btn-lg" id="hero-employer-portal-btn">
                  Access Employer Portal <ArrowRight size={18} />
                </Link>
                <Link href="/register?role=employer" className="lp-btn lp-btn-ghost lp-btn-lg" id="hero-register-practice-btn">
                  <Building2 size={18} /> Register Your Practice
                </Link>
              </div>
            </div>

            {/* ── Stats Bar ── */}
            <div className="lp-employers-stats" style={{ maxWidth: 980, marginInline: 'auto' }}>
              <div className="lp-employers-stat">
                <strong>{employers.length}</strong>
                <span>{employers.length === 1 ? 'Practice Joined' : 'Practices Joined'}</span>
              </div>
              <div className="lp-employers-stat">
                <strong>100%</strong>
                <span>Proctored Exam Verification</span>
              </div>
              <div className="lp-employers-stat">
                <strong>Direct</strong>
                <span>Candidate Transcript Access</span>
              </div>
              <div className="lp-employers-stat">
                <strong>0%</strong>
                <span>Recruiter Placement Fee</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Joined Employers List ── */}
        <section className="lp-section lp-section-alt" style={{ paddingTop: '56px', paddingBottom: '72px' }}>
          <div className="lp-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800 }}>All Joined Employers</h2>
                <p style={{ color: 'var(--lp-ink-soft)', fontSize: 14.5, marginTop: 4 }}>
                  Verified companies and firms actively registered on the UKATI platform.
                </p>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'var(--lp-surface-solid)', border: '1px solid var(--lp-border)', fontSize: 13 }}>
                <ShieldCheck size={16} style={{ color: 'var(--lp-teal)' }} />
                <span>Real-time Verified Directory</span>
              </div>
            </div>

            {employers.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '64px 24px',
                  background: 'var(--lp-surface-solid)',
                  border: '1px solid var(--lp-border)',
                  borderRadius: 'var(--lp-radius)',
                }}
              >
                <Building2 size={44} style={{ color: 'var(--lp-teal)', margin: '0 auto 16px', opacity: 0.8 }} />
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No employers registered yet</h3>
                <p style={{ color: 'var(--lp-ink-soft)', maxWidth: 480, margin: '0 auto 24px', fontSize: 15 }}>
                  Be the first practice to join UKATI and connect directly with high-performing accounting candidates.
                </p>
                <Link href="/register?role=employer" className="lp-btn lp-btn-gold">
                  Register Your Practice <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="lp-employers-grid">
                {employers.map(emp => {
                  const initials = emp.company_name
                    ? emp.company_name
                        .split(' ')
                        .slice(0, 2)
                        .map((w: string) => w[0])
                        .join('')
                        .toUpperCase()
                    : 'UK'

                  const joinedDate = emp.created_at
                    ? new Date(emp.created_at).toLocaleDateString('en-GB', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Recent'

                  return (
                    <div key={emp.id} className="lp-employer-card">
                      <div className="lp-employer-card-top">
                        <div className="lp-employer-avatar">{initials}</div>
                        <span className="lp-employer-tier">
                          <Sparkles size={11} />
                          {emp.plan === 'enterprise'
                            ? 'Enterprise Partner'
                            : emp.plan === 'growth'
                            ? 'Growth Practice'
                            : 'Accredited Employer'}
                        </span>
                      </div>

                      <h3 className="lp-employer-name">
                        {emp.company_name}
                        <BadgeCheck size={18} style={{ color: 'var(--lp-teal)', flexShrink: 0 }} />
                      </h3>

                      <p className="lp-employer-specialty">
                        Accredited employer hiring examined UK accounting and tax graduates from UKATI.
                      </p>

                      <div className="lp-employer-card-footer">
                        <span className="lp-employer-status">
                          <span className="lp-employer-status-dot" />
                          Actively Hiring
                        </span>
                        <span style={{ color: 'var(--lp-ink-faint)', fontSize: 11.5 }}>
                          Joined {joinedDate}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Practice Recruitment Callout ── */}
            <div className="lp-employer-banner" style={{ marginTop: 40 }}>
              <div>
                <h3 className="lp-employer-banner-title">Looking to hire qualified UK accounting talent?</h3>
                <p className="lp-employer-banner-desc">
                  Join our verified employer directory. Inspect proctored scores across Statutory Accounts, Corporation Tax (CT600), and VAT compliance before scheduling an interview.
                </p>
              </div>
              <div className="lp-employer-banner-actions">
                <Link href="/employer" className="lp-btn lp-btn-gold" id="employers-page-portal-btn">
                  Access Employer Portal <ArrowRight size={17} />
                </Link>
                <Link href="/register?role=employer" className="lp-btn lp-btn-ghost" id="employers-page-register-btn">
                  <Building2 size={16} /> Register Practice
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div>
              <div className="lp-footer-brand">
                <Image src="/logo-no-background.png" alt="UKATI logo" width={48} height={48} />
                <strong>UKATI</strong>
              </div>
              <p>
                UK Accounting &amp; Taxation Institute, a wholly owned training institute of{' '}
                <a
                  href="https://www.teamcollaboro.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline', color: 'inherit', textDecoration: 'underline' }}
                >
                  Team Collaboro Pvt Ltd
                </a>
                , Sri Lanka.
              </p>
            </div>
            <div>
              <h4>Programme</h4>
              <Link href="/#how-it-works">How it works</Link>
              <Link href="/courses">Courses</Link>
              <Link href="/#credentials">Credentials</Link>
              <Link href="/employers">Employers Directory</Link>
            </div>
            <div>
              <h4>Account</h4>
              <Link href="/login">Student Sign in</Link>
              <Link href="/login?role=employer">Employer Sign in</Link>
              <Link href="/register?role=employer">Register Practice</Link>
              <Link href="/employer">Employer Portal</Link>
            </div>
            <div>
              <h4>Contact</h4>
              <a href="mailto:info@ukati.lk">info@ukati.lk</a>
              <p style={{ fontSize: 14.5, padding: '5px 0' }}>Sri Lanka</p>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>
              © {new Date().getFullYear()}{' '}
              <a
                href="https://www.teamcollaboro.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline', color: 'inherit', textDecoration: 'underline' }}
              >
                Team Collaboro Pvt Ltd
              </a>
              . All rights reserved.
            </span>
            <span>Built for UK accounting &amp; tax professionals</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
