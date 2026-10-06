'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, Award, BadgeCheck, BookOpen, Briefcase, Check, Download,
  Globe, GraduationCap, Info, Laptop, Lock, Menu, ShieldCheck, Smartphone,
  UserPlus, X,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { mobileAppDownload } from '@/lib/mobileAppDownload'
import './landing.css'

const NAV = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'About', href: '#about' },
  { label: 'Why UKATI', href: '#why-ukati' },
  { label: 'Credentials', href: '#credentials' },
  { label: 'Employers', href: '/employer' },
]

const STEP_DURATION_MS = 7000

/* ── Step visuals (pure CSS mock-ups of real platform screens) ── */

function EnrolVisual() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-card">
        <div className="lp-mock-row">
          <div className="lp-hv-icon" style={{ background: 'rgba(79,179,196,0.14)', color: 'var(--lp-teal)' }}><UserPlus size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="lp-mock-value">Student account created</div>
            <div className="lp-mock-label">Email verified · Course access granted</div>
          </div>
          <span className="lp-mock-chip lp-chip-ok">Done</span>
        </div>
      </div>
      <div className="lp-mock-card">
        <div className="lp-mock-row">
          <div className="lp-hv-icon" style={{ background: 'var(--lp-gold-soft)', color: 'var(--lp-gold)' }}><BookOpen size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="lp-mock-value">Course orientation</div>
            <div className="lp-mock-label">How the 12 parts fit together</div>
          </div>
          <span className="lp-mock-chip lp-chip-gold">Start</span>
        </div>
      </div>
      <div className="lp-mock-card">
        <div className="lp-mock-row">
          <div className="lp-hv-icon" style={{ background: 'rgba(61,214,140,0.12)', color: 'var(--lp-success)' }}><Smartphone size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="lp-mock-value">Companion app installed</div>
            <div className="lp-mock-label">Android {mobileAppDownload.version} · needed for exams</div>
          </div>
          <span className="lp-mock-chip lp-chip-ok">Ready</span>
        </div>
      </div>
    </div>
  )
}

function TutorVisual() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-card" style={{ display: 'grid', gap: 10 }}>
        <div className="lp-mock-row" style={{ justifyContent: 'space-between' }}>
          <span className="lp-hv-module">Part 3 · UK VAT</span>
          <span className="lp-mock-chip lp-chip-gold">Explain phase</span>
        </div>
        <div className="lp-bubble ai">Input VAT is what you pay on purchases. A VAT-registered business can usually reclaim it. Can you explain that back in your own words?</div>
        <div className="lp-bubble me">So VAT paid on business costs can be offset against VAT we charge?</div>
        <div className="lp-bubble ai">Exactly. Add that to your notes under “Input vs Output VAT”.</div>
      </div>
      <div className="lp-mock-card">
        <div className="lp-mock-row">
          <span className="lp-mock-label" style={{ minWidth: 96 }}>Module progress</span>
          <div className="lp-mock-bar"><i style={{ width: '64%' }} /></div>
          <span className="lp-mock-value">64%</span>
        </div>
        <div className="lp-mock-row">
          <span className="lp-mock-label" style={{ minWidth: 96 }}>Next module</span>
          <span className="lp-mock-chip lp-chip-lock" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Lock size={11} /> Unlocks after knowledge check</span>
        </div>
      </div>
    </div>
  )
}

function ExamVisual() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-card">
        <div className="lp-mock-pair">
          <div className="lp-device">
            <Laptop size={26} style={{ color: 'var(--lp-teal)' }} />
            <small>Exam on laptop</small>
          </div>
          <div className="lp-link-line" />
          <div className="lp-device phone">
            <Smartphone size={22} style={{ color: 'var(--lp-gold)' }} />
            <small>Phone camera</small>
          </div>
        </div>
      </div>
      <div className="lp-mock-card">
        {[
          ['Phone paired via QR', 'Paired'],
          ['Workspace check', 'Passed'],
          ['Monitoring', 'Live'],
        ].map(([label, chip]) => (
          <div className="lp-mock-row" key={label} style={{ justifyContent: 'space-between' }}>
            <span className="lp-mock-label">{label}</span>
            <span className="lp-mock-chip lp-chip-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {chip === 'Live' && <span className="lp-live-dot" />}{chip}
            </span>
          </div>
        ))}
      </div>
      <div className="lp-mock-card">
        <div className="lp-mock-row">
          <ShieldCheck size={18} style={{ color: 'var(--lp-teal)', flexShrink: 0 }} />
          <span className="lp-mock-label">Answers are marked on the server. The answer key never reaches your browser.</span>
        </div>
      </div>
    </div>
  )
}

function CertificateVisual() {
  return (
    <div className="lp-mock">
      <div className="lp-cert">
        <div className="lp-seal"><Award size={24} /></div>
        <small>UKATI · Certificate of Completion</small>
        <h4>Associate UK Accounting Technician</h4>
        <p>Awarded after completing the syllabus and passing the proctored exam.</p>
        <code>UKAT-2026-XXXX</code>
      </div>
      <div className="lp-mock-card">
        <div className="lp-mock-row">
          <BadgeCheck size={20} style={{ color: 'var(--lp-success)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="lp-mock-value">Publicly verifiable</div>
            <div className="lp-mock-label">Employers can check the code on the UKATI verification page</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    key: 'enrol',
    label: 'Enrol',
    sub: 'Create your account and get set up',
    kicker: 'Step 01 · Get started',
    title: 'Enrol and set up your study space',
    desc: 'Register in minutes and get immediate access to the course orientation and the full 87-module syllabus across 12 parts.',
    points: [
      'Create a student account and verify your email',
      'Read the course orientation to see how the 12 parts connect',
      'Install the Android companion app now, as your exams will need it',
    ],
    cta: { label: 'Create your account', href: '/register' },
    Visual: EnrolVisual,
  },
  {
    key: 'learn',
    label: 'Learn with AI tutor',
    sub: 'Guided, module-by-module teaching',
    kicker: 'Step 02 · Learn',
    title: 'Learn with a personal AI tutor',
    desc: 'Each module is taught in short, focused steps. Your tutor explains a concept, asks you to explain it back, prompts you to take notes, then checks your understanding before moving on.',
    points: [
      'Answers are grounded in the UKATI course material, not the open web',
      'Interactive checks, key terms and step-by-step visuals inside every lesson',
      'Modules unlock in order once you pass each knowledge check',
    ],
    cta: { label: 'Browse the courses', href: '/courses' },
    Visual: TutorVisual,
  },
  {
    key: 'exam',
    label: 'Proctored exam',
    sub: 'Laptop + phone, secured end to end',
    kicker: 'Step 03 · Assess',
    title: 'Sit a fair, proctored exam from home',
    desc: 'Take your assessment on your laptop while your phone, paired by QR code, watches your workspace. Most of the checks run on your phone itself, so no human invigilator is needed.',
    points: [
      'Scan a QR code to pair your phone, then complete a guided desk check',
      'Leaving full-screen or switching tabs pauses the exam',
      'Answers are scored on the server, so results can’t be tampered with',
    ],
    cta: { label: `Download Android app (${mobileAppDownload.version})`, href: mobileAppDownload.url, download: true },
    Visual: ExamVisual,
  },
  {
    key: 'certify',
    label: 'Certificate',
    sub: 'Verifiable credential employers trust',
    kicker: 'Step 04 · Certify',
    title: 'Earn a certificate employers can verify',
    desc: 'Pass your proctored exam and receive a certificate with a unique code. Anyone can confirm it on the UKATI verification page, and revoked certificates are clearly flagged.',
    points: [
      'Unique certificate code for every award',
      'Public verification for employers and recruiters',
      'Your first step on the UKATI credential ladder',
    ],
    cta: { label: 'See the credential ladder', href: '#credentials' },
    Visual: CertificateVisual,
  },
] as const

/* ── Small hook: reveal on scroll ── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.lp-reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function HowItWorks() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const autoplay = inView && !paused && !reduceMotion

  useEffect(() => {
    if (!autoplay) return
    const t = setTimeout(() => setActive(a => (a + 1) % STEPS.length), STEP_DURATION_MS)
    return () => clearTimeout(t)
  }, [active, autoplay])

  const step = STEPS[active]
  const Visual = step.Visual

  return (
    <section id="how-it-works" ref={sectionRef} className="lp-section lp-section-alt" aria-labelledby="how-title">
      <div className="lp-container">
        <div className="lp-section-head center lp-reveal">
          <span className="lp-eyebrow">How it works</span>
          <h2 id="how-title" className="lp-h2">From enrolment to a certificate <span className="lp-gold-text">in four steps</span></h2>
          <p className="lp-lead">Every UKATI student follows the same path: guided learning, a fair proctored assessment, and a credential employers can verify.</p>
        </div>

        <div
          className="lp-reveal"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="lp-steps-rail" role="tablist" aria-label="How UKATI works">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                id={`step-tab-${s.key}`}
                role="tab"
                aria-selected={i === active}
                aria-controls="step-panel"
                className={`lp-step-tab${i < active ? ' done' : ''}`}
                onClick={() => setActive(i)}
              >
                <span className="lp-step-num">{i < active ? <Check size={15} /> : `0${i + 1}`}</span>
                <span className="lp-step-label">{s.label}</span>
                <span className="lp-step-sub">{s.sub}</span>
                {i === active && (
                  <motion.span
                    key={`${s.key}-${autoplay}`}
                    className="lp-step-progress"
                    initial={{ width: autoplay ? '0%' : '100%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: autoplay ? STEP_DURATION_MS / 1000 : 0, ease: 'linear' }}
                  />
                )}
              </button>
            ))}
          </div>

          <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${step.key}`} className="lp-step-panel">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.key}
                className="lp-step-copy"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <span className="lp-step-kicker">{step.kicker}</span>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-desc">{step.desc}</p>
                <ul className="lp-step-points">
                  {step.points.map(p => (
                    <li key={p}><Check size={18} />{p}</li>
                  ))}
                </ul>
                <div className="lp-step-cta">
                  {'download' in step.cta ? (
                    <a className="lp-btn lp-btn-ghost" href={step.cta.href} download={mobileAppDownload.fileName}>
                      <Download size={17} /> {step.cta.label}
                    </a>
                  ) : (
                    <Link className="lp-btn lp-btn-ghost" href={step.cta.href}>
                      {step.cta.label} <ArrowRight size={17} />
                    </Link>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="lp-step-visual">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.key}
                  style={{ width: '100%', display: 'grid', placeItems: 'center' }}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                >
                  <Visual />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  useReveal()

  return (
    <div className="lp">
      {/* ── Header ── */}
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-brand" aria-label="UKATI home">
            <Image src="/logo-no-background.png" alt="UKATI logo" width={92} height={52} priority />
            <span className="lp-brand-text">
              <strong>UKATI</strong>
              <span>UK Accounting &amp; Taxation Institute</span>
            </span>
          </Link>

          <nav className="lp-nav" aria-label="Primary">
            {NAV.map(l => <Link key={l.label} href={l.href}>{l.label}</Link>)}
          </nav>

          <div className="lp-header-actions">
            <ThemeToggle collapsed />
            <Link href="/login" className="lp-btn lp-btn-text lp-hide-sm" id="header-sign-in">Sign in</Link>
            <Link href="/register" className="lp-btn lp-btn-gold lp-hide-sm" id="header-enrol">Enrol now</Link>
            <button
              className="lp-menu-btn"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              id="mobile-menu-toggle"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              className="lp-mobile-menu"
              aria-label="Mobile"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              {NAV.map(l => (
                <Link key={l.label} href={l.href} className="lp-mm-link" onClick={() => setMenuOpen(false)}>{l.label}</Link>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <Link href="/login" className="lp-btn lp-btn-ghost" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link href="/register" className="lp-btn lp-btn-gold" onClick={() => setMenuOpen(false)}>Enrol now</Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-bg">
            <div className="lp-orb lp-orb-a" />
            <div className="lp-orb lp-orb-b" />
          </div>

          <div className="lp-container lp-hero-grid">
            <motion.div className="lp-hero-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 id="hero-title" className="lp-h1">
                Your pathway to a career in <span className="lp-gold-text">UK accounting &amp; tax</span>
              </h1>
              <div className="lp-hero-ctas">
                <Link href="/register" className="lp-btn lp-btn-gold lp-btn-lg" id="hero-enrol">
                  Enrol today <ArrowRight size={18} />
                </Link>
                <Link href="#how-it-works" className="lp-btn lp-btn-ghost lp-btn-lg" id="hero-how">
                  See how it works
                </Link>
              </div>
            </motion.div>

            <motion.div
              className="lp-hero-visual lp-students-visual"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <div className="lp-students-halo" aria-hidden="true" />
              <Image
                src="/landing-students.webp"
                alt="Three smiling UKATI students ready to learn accounting and taxation"
                width={1145}
                height={1374}
                className="lp-students-image"
                sizes="(max-width: 960px) 90vw, 46vw"
                priority
              />

            </motion.div>
          </div>
        </section>

        {/* ── How it works ── */}
        <HowItWorks />

        {/* ── About ── */}
        <section id="about" className="lp-section" aria-labelledby="about-title">
          <div className="lp-container lp-about">
            <div className="lp-about-text lp-reveal">
              <span className="lp-eyebrow">About us</span>
              <h2 id="about-title" className="lp-h2" style={{ marginBottom: 22 }}>Team Collaboro &amp; UKATI</h2>
              <p>
                <strong>Team Collaboro Pvt Ltd</strong> is a strategic delegation partner for UK-based accountancy and tax firms,
                providing compliance, advisory, and HMRC tax investigation assistance through our professional team in Sri Lanka.
              </p>
              <p>
                Drawing on this real-world expertise and months of dedicated research, we have developed an industry-focused UK
                accounting and taxation curriculum, delivered through <strong>UKATI</strong>, our wholly owned training institute.
              </p>
            </div>
            <div className="lp-card lp-about-card lp-reveal">
              <Image src="/logo-no-background.png" alt="UKATI logo" width={300} height={170} className="lp-about-logo" />
              <h3>UK Accounting &amp; Taxation Institute</h3>
              <p>A Team Collaboro initiative</p>
              <div className="lp-about-tags">
                <span>Compliance</span><span>Advisory</span><span>HMRC investigations</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Why UKATI ── */}
        <section id="why-ukati" className="lp-section lp-section-alt" aria-labelledby="why-title">
          <div className="lp-container">
            <div className="lp-section-head center lp-reveal">
              <span className="lp-eyebrow">Why UKATI</span>
              <h2 id="why-title" className="lp-h2">Built by practitioners, for future practitioners</h2>
            </div>
            <div className="lp-features">
              {[
                { Icon: Briefcase, title: 'Real-world expertise', desc: 'Learn compliance, advisory and HMRC tax investigation work from practising professionals.' },
                { Icon: BookOpen, title: 'Industry-focused curriculum', desc: 'A specialised curriculum developed through months of research to meet UK market demands.' },
                { Icon: Globe, title: 'Global career opportunities', desc: 'Take your first step towards a rewarding career in the global accounting sector from Sri Lanka.' },
                { Icon: GraduationCap, title: 'Professional standards', desc: 'Develop the skills and rigorous professional standards expected by UK-based accountancy firms.' },
              ].map(({ Icon, title, desc }, i) => (
                <div key={title} className="lp-feature lp-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="lp-feature-icon"><Icon size={24} /></div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Credential ladder ── */}
        <section id="credentials" className="lp-section" aria-labelledby="cred-title">
          <div className="lp-container lp-cred-grid">
            <div className="lp-cred-intro lp-reveal">
              <span className="lp-eyebrow">Credential pathway</span>
              <h2 id="cred-title">The Credential Ladder</h2>
              <p>Progress from foundation accounting skills to supervised practice, then on to advanced advisory specialisation.</p>
              <div className="lp-cred-checks">
                {['Tracked in the platform', 'Proctored assessment', 'One-time awards'].map(t => (
                  <div key={t}><Check size={18} />{t}</div>
                ))}
              </div>
            </div>

            <div className="lp-cred-list">
              {[
                { cls: '', stage: 'Stage 01', initials: 'AUKAT', title: 'Associate UK Accounting Technician', awarded: 'Complete the syllabus and pass the proctored exam.', detail: 'Recommended pass mark: 70%+' },
                { cls: 'gold', stage: 'Stage 02', initials: 'CUKAP', title: 'Certified UK Accounting Practitioner', awarded: 'Complete supervised work at an Approved Training Practice.', detail: 'Evidence: employer service letter plus closing knowledge interview.' },
                { cls: 'deep', stage: 'Advanced', initials: 'SUKTAP', title: 'Senior UK Tax & Advisory Practitioner', awarded: 'Complete the advanced Virtual CFO / Tax Investigations tier.', detail: 'Designed for students moving into advisory-facing work.' },
              ].map((c, i) => (
                <div key={c.initials} className={`lp-cred-row ${c.cls} lp-reveal`} style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="lp-cred-badge">
                    <span>{c.stage}</span>
                    <strong>{c.initials}</strong>
                  </div>
                  <div className="lp-cred-body">
                    <h3>{c.title}</h3>
                    <p>{c.awarded}</p>
                    <p className="muted">{c.detail}</p>
                  </div>
                </div>
              ))}
              <div className="lp-cred-note lp-reveal">
                <Info size={20} />
                <p>There is no ongoing membership or renewal. Each stage is a one-time award, so you can stop at Stage 1 or continue through all three.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lp-section" style={{ paddingTop: 0 }} aria-labelledby="cta-title">
          <div className="lp-container">
            <div className="lp-cta lp-reveal">
              <div>
                <h2 id="cta-title">Start your UK accounting career today</h2>
                <p>Create your account, meet your AI tutor, and work towards your first UKATI credential at your own pace.</p>
              </div>
              <div className="lp-cta-actions">
                <Link href="/register" className="lp-btn lp-btn-gold lp-btn-lg" id="cta-enrol">Enrol now <ArrowRight size={18} /></Link>
                <a
                  href={mobileAppDownload.url}
                  download={mobileAppDownload.fileName}
                  className="lp-btn lp-btn-ghost lp-btn-lg"
                  id="cta-download"
                  aria-label={`Download LMS Mobile ${mobileAppDownload.version} for ${mobileAppDownload.platform}`}
                >
                  <Download size={18} /> Android companion app
                </a>
                <small>v{mobileAppDownload.version} · {mobileAppDownload.platform}</small>
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
                <Image src="/logo-no-background.png" alt="UKATI logo" width={96} height={54} />
                <strong>UKATI</strong>
              </div>
              <p>UK Accounting &amp; Taxation Institute, a wholly owned training institute of Team Collaboro Pvt Ltd, Sri Lanka.</p>
            </div>
            <div>
              <h4>Programme</h4>
              <Link href="#how-it-works">How it works</Link>
              <Link href="/courses">Courses</Link>
              <Link href="#credentials">Credentials</Link>
            </div>
            <div>
              <h4>Account</h4>
              <Link href="/login">Sign in</Link>
              <Link href="/register">Register</Link>
              <Link href="/employer">Employer portal</Link>
            </div>
            <div>
              <h4>Contact</h4>
              <a href="mailto:info@ukati.lk">info@ukati.lk</a>
              <p style={{ fontSize: 14.5, padding: '5px 0' }}>Sri Lanka</p>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} Team Collaboro Pvt Ltd. All rights reserved.</span>
            <span>Built for UK accounting &amp; tax professionals</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
