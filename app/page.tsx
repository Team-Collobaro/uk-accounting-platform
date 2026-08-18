'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientComponentClient } from '@/lib/supabase'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  Brain, BookOpen, Award, TrendingUp, CheckCircle2,
  ArrowRight, Sparkles, Zap, Shield, Clock, Users,
  ChevronRight, Play,
} from 'lucide-react'

// ─── Particle canvas (site palette) ──────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    window.addEventListener('resize', onResize)
    const N = 70
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; hue: number }
    const hues = [178, 260, 210] // cyan, violet, indigo
    const pts: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.4 + 0.5, a: Math.random() * 0.6 + 0.2,
      hue: hues[Math.floor(Math.random() * hues.length)],
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue},70%,65%,${p.a * 0.5})`
        ctx.fill()
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y)
          ctx.strokeStyle = `rgba(78,205,196,${(1 - d / 120) * 0.08})`
          ctx.lineWidth = 0.5; ctx.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.8 }} />
}

// ─── Aurora AI orb (matches site theme) ──────────────────────────────────────
function AiOrb() {
  const orbRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame: number
    const tick = () => {
      const t = performance.now() / 1000
      if (orbRef.current) orbRef.current.style.transform = `scale(${1 + 0.05 * Math.sin(t * 0.8)})`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          animate={{ scale: [1, 1.1, 1], opacity: [0.18 - i * 0.04, 0.06, 0.18 - i * 0.04] }}
          transition={{ duration: 3.5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          style={{
            position: 'absolute', inset: -(i * 26), borderRadius: '50%',
            border: `1px solid rgba(78,205,196,${0.3 - i * 0.07})`,
            background: `radial-gradient(circle, rgba(78,205,196,${0.05 - i * 0.01}) 0%, transparent 70%)`,
          }}
        />
      ))}
      <div ref={orbRef} style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 35%, rgba(78,205,196,0.28) 0%, rgba(155,111,208,0.20) 50%, rgba(5,8,16,0.7) 100%)',
        boxShadow: '0 0 50px rgba(78,205,196,0.3), 0 0 100px rgba(155,111,208,0.18), inset 0 0 40px rgba(78,205,196,0.1)',
        border: '1px solid rgba(78,205,196,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Brain size={64} color="rgba(78,205,196,0.92)" strokeWidth={1.1} />
      </div>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -16, borderRadius: '50%' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '-5px', marginTop: '-5px',
          width: 10, height: 10, borderRadius: '50%',
          background: '#4ECDC4', boxShadow: '0 0 14px #4ECDC4, 0 0 28px rgba(78,205,196,0.4)',
        }} />
      </motion.div>
      <motion.div animate={{ rotate: -360 }} transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -32, borderRadius: '50%' }}>
        <div style={{
          position: 'absolute', top: '50%', right: '-4px', marginTop: '-4px',
          width: 8, height: 8, borderRadius: '50%',
          background: '#9B6FD0', boxShadow: '0 0 10px #9B6FD0',
        }} />
      </motion.div>
      <motion.div animate={{ y: [-3, 3, -3] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)',
          borderRadius: 20, padding: '4px 14px', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#4ECDC4', letterSpacing: '0.18em',
        }} className="text-micro">
        ALEX · AI TUTOR
      </motion.div>
    </div>
  )
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
function Typewriter({ texts }: { texts: string[] }) {
  const [idx, setIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const target = texts[idx]
    if (!deleting && displayed.length < target.length) {
      const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 52)
      return () => clearTimeout(t)
    }
    if (!deleting && displayed.length === target.length) {
      const t = setTimeout(() => setDeleting(true), 2000)
      return () => clearTimeout(t)
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 28)
      return () => clearTimeout(t)
    }
    if (deleting && displayed.length === 0) { setDeleting(false); setIdx((idx + 1) % texts.length) }
  }, [displayed, deleting, idx, texts])
  return (
    <span style={{ color: '#4ECDC4', fontWeight: 800 }}>
      {displayed}
      <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.55, repeat: Infinity }}>|</motion.span>
    </span>
  )
}

// ─── Live chat demo ───────────────────────────────────────────────────────────
const demoMsgs = [
  { role: 'ai',   text: "Before I explain FRS 102, tell me — what do you think 'true and fair view' means?" },
  { role: 'user', text: "The accounts should accurately represent the business?" },
  { role: 'ai',   text: "Exactly right. It means the financial statements give a realistic picture — not just technically correct, but economically meaningful. Now, why might that matter more than just following rules?" },
]
function ChatDemo() {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    if (visible >= demoMsgs.length) return
    const t = setTimeout(() => setVisible(v => v + 1), visible === 0 ? 700 : 1600)
    return () => clearTimeout(t)
  }, [visible])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AnimatePresence>
        {demoMsgs.slice(0, visible).map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {m.role === 'ai' && (
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={12} color="#4ECDC4" />
              </div>
            )}
            <div style={{
              maxWidth: '78%', padding: '9px 13px', lineHeight: 1.6,
              borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
              background: m.role === 'user'
                ? 'linear-gradient(135deg,rgba(78,205,196,0.15),rgba(155,111,208,0.15))'
                : 'rgba(14,21,37,0.8)',
              border: m.role === 'user' ? '1px solid rgba(78,205,196,0.25)' : '1px solid rgba(78,205,196,0.1)',
              borderLeft: m.role === 'ai' ? '2px solid rgba(78,205,196,0.4)' : undefined,
              color: 'rgba(232,240,252,0.9)',
              backdropFilter: 'blur(12px)',
            }} className="text-xs">{m.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
      {visible < demoMsgs.length && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: 4, paddingLeft: 34 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(78,205,196,0.5)' }} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color, delay }: { icon: React.ElementType; title: string; desc: string; color: string; delay: number }) {
  const [hov, setHov] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '24px',
        borderRadius: 6,
        background: '#fff',
        border: `1px solid var(--line)`,
        borderTop: `4px solid rgb(${color})`,
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'all 0.22s ease', cursor: 'default',
        transform: hov ? 'translateY(-3px)' : 'none',
      }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: `rgba(${color},0.1)`, border: `1px solid rgba(${color},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon size={22} color={`rgb(${color})`} />
      </div>
      <p style={{ fontWeight: 700, color: 'var(--accent-2)', marginBottom: 8, fontSize: 16, fontFamily: '"Charter", Georgia, serif' }}>{title}</p>
      <p style={{ color: 'var(--ink-soft)', lineHeight: 1.65, fontSize: 14.5, fontFamily: '"Charter", Georgia, serif' }}>{desc}</p>
    </motion.div>
  )
}


// ─── Curriculum part row ──────────────────────────────────────────────────────
const PARTS = [
  { n: 1,  t: 'UK Compliance Landscape',   m: 7  },
  { n: 2,  t: 'Double-Entry Bookkeeping',  m: 5  },
  { n: 3,  t: 'VAT & Indirect Taxes',      m: 8  },
  { n: 4,  t: 'Payroll & PAYE',            m: 6  },
  { n: 5,  t: 'Year-End Accounts',         m: 8  },
  { n: 6,  t: 'Corporation Tax',           m: 6  },
  { n: 7,  t: 'Self Assessment',           m: 8  },
  { n: 8,  t: 'Incorporation',             m: 9  },
  { n: 9,  t: 'Cessation & Winding Up',    m: 9  },
  { n: 10, t: 'Business Structure Changes',m: 8  },
  { n: 11, t: 'Specialist Tax Topics',     m: 8  },
  { n: 12, t: 'Professional Ethics',       m: 5  },
]

const FEATURES = [
  { icon: Brain,       title: 'Socratic AI Tutor',       desc: 'Alex asks questions instead of lecturing. You think, you answer, you retain — proven to double knowledge retention.',         color: '78,205,196' },
  { icon: BookOpen,    title: '87 Expert Modules',        desc: 'ACCA/ACA-grade depth from sole trader setup to group restructuring. Everything a UK practitioner needs.',                   color: '155,111,208' },
  { icon: TrendingUp,  title: 'Adaptive Quizzes',         desc: 'Every quiz zeroes in on your weak spots. The system tracks topics and adjusts difficulty as you improve.',                  color: '82,217,139'  },
  { icon: Shield,      title: 'Course-Grounded Accuracy',    desc: 'Everything you read is grounded in your actual course content — no hallucinations, no invented tax rates.',                      color: '91,120,216'  },
  { icon: Award,       title: 'Verifiable Certificate',   desc: 'Publicly verifiable with a unique QR code. Employers can confirm authenticity instantly via the verification URL.',          color: '232,184,75'  },
  { icon: Users,       title: 'Employer Dashboard',       desc: 'Track your whole team\'s progress, scores, and certificates in one clean dashboard. Built for practices.',                  color: '232,80,122'  },
]

const TESTIMONIALS = [
  { name: 'Sarah M.', role: 'Bookkeeper → Practice Manager', quote: 'The AI tutor actually makes you think. I retained so much more than from any online course I\'ve tried.' },
  { name: 'James K.', role: 'Sole Trader Accountant', quote: 'Finished all 87 modules in 6 weeks alongside full-time work. The structure is excellent and the content is genuinely ACCA-level.' },
  { name: 'Priya T.', role: 'Payroll Specialist', quote: 'The certificate is publicly verifiable — my new employer actually scanned the QR code before my interview!' },
]

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router  = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/dashboard')
    })
  }, [router, supabase])

  const { scrollY } = useScroll()
  const heroY       = useTransform(scrollY, [0, 400], [0, -50])
  const heroOpacity = useTransform(scrollY, [0, 280], [1, 0])
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn); return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#050810', color: '#E8F0FC', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden',
      ['--bg-base' as string]: '#050810',
      ['--text-primary' as string]: '#E8F0FC',
      ['--shadow-lg' as string]: '0 16px 40px rgba(0,0,0,0.6)',
      ['--shadow-md' as string]: '0 6px 20px rgba(0,0,0,0.4)',
    }}>

      {/* ── Nav ── */}
      <motion.nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: navScrolled ? '1px solid rgba(78,205,196,0.12)' : '1px solid transparent',
        background: navScrolled ? 'rgba(5,8,16,0.88)' : 'transparent',
        backdropFilter: navScrolled ? 'blur(24px) saturate(160%)' : 'none',
        transition: 'all 0.3s', padding: '0 28px',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,rgba(78,205,196,0.25),rgba(155,111,208,0.25))', border: '1px solid rgba(78,205,196,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(78,205,196,0.2)' }}>
              <Brain size={17} color="#4ECDC4" />
            </div>
            <span style={{ fontWeight: 700, letterSpacing: '-0.01em', color: '#E8F0FC' }} className="text-[15px]">
              UK Accounting <span style={{ color: '#4ECDC4' }}>Pro</span>
            </span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" style={{ color: '#8EA8CC', fontWeight: 500, textDecoration: 'none', padding: '6px 13px', borderRadius: 8, transition: 'color 0.2s' }} className="text-small">
              Sign in
            </Link>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(78,205,196,0.2),rgba(155,111,208,0.2))', border: '1px solid rgba(78,205,196,0.38)', color: '#4ECDC4', boxShadow: '0 0 18px rgba(78,205,196,0.12)', cursor: 'pointer' }} className="text-small">
                Get started free <ArrowRight size={13} />
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <ParticleField />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(78,205,196,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(78,205,196,0.02) 1px,transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 700, background: 'radial-gradient(circle, rgba(78,205,196,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(155,111,208,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 2, maxWidth: 1160, margin: '0 auto', padding: '110px 28px 60px', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.22)', borderRadius: 30, padding: '5px 14px', marginBottom: 26 }}>
                  <Zap size={11} color="#4ECDC4" fill="#4ECDC4" />
                  <span style={{ fontFamily: 'monospace', color: '#4ECDC4', letterSpacing: '0.16em' }} className="text-micro">AI-POWERED · UK FOCUSED · 150 HOURS</span>
                </div>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65 }}
                style={{ fontSize: 'clamp(34px,4.2vw,54px)', fontWeight: 800, lineHeight: 1.13, marginBottom: 18, letterSpacing: '-0.025em', color: '#E8F0FC' }}>
                Master{' '}
                <Typewriter texts={['UK Accounting', 'VAT & Tax', 'Payroll & PAYE', 'FRS 102 & 105', 'Corporation Tax']} />
                <br />
                <span style={{ color: '#8EA8CC', fontWeight: 400, letterSpacing: '-0.01em' }} className="text-[0px]">with an AI that teaches, not just tells</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                style={{ color: '#8EA8CC', lineHeight: 1.8, marginBottom: 34, maxWidth: 460 }} className="text-[15px]">
                87 modules. 12 subject areas. An AI tutor that uses the Socratic method
                — asking the right questions so you build real understanding, not just pass scores.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
                style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 44 }}>
                <Link href="/register" style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.03, boxShadow: '0 0 36px rgba(78,205,196,0.28)' }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '13px 28px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(78,205,196,0.22),rgba(155,111,208,0.22))', border: '1px solid rgba(78,205,196,0.42)', color: '#4ECDC4', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} className="text-sm">
                    <Sparkles size={15} /> Start learning free
                  </motion.button>
                </Link>
                <Link href="#demo" style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '13px 22px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#8EA8CC', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }} className="text-sm">
                    <Play size={13} fill="currentColor" /> See how it works
                  </motion.button>
                </Link>
              </motion.div>

              {/* Social proof strip */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {[
                  { v: '87', l: 'Modules', color: '#4ECDC4' },
                  { v: '150h', l: 'Curriculum', color: '#9B6FD0' },
                  { v: '12', l: 'Subject Areas', color: '#52D98B' },
                  { v: 'ACCA', l: 'Grade Depth', color: '#E8B84B' },
                ].map(({ v, l, color }) => (
                  <motion.div key={l} whileHover={{ scale: 1.05 }} style={{ textAlign: 'center', cursor: 'default' }}>
                    <p style={{ fontWeight: 800, color, lineHeight: 1, textShadow: `0 0 20px ${color}50` }} className="text-lg">{v}</p>
                    <p style={{ fontFamily: 'monospace', color: '#4A6285', letterSpacing: '0.1em', marginTop: 2 }} className="text-[9px]">{l.toUpperCase()}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right — orb + chat demo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44 }}>
              <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.28, duration: 0.9, type: 'spring', stiffness: 110 }}>
                <AiOrb />
              </motion.div>

              <motion.div id="demo" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
                style={{ width: '100%', maxWidth: 420, background: 'rgba(9,13,26,0.75)', border: '1px solid rgba(78,205,196,0.13)', borderRadius: 18, padding: '18px 16px', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 11, borderBottom: '1px solid rgba(78,205,196,0.08)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#52D98B', boxShadow: '0 0 8px #52D98B' }} />
                  <span style={{ fontFamily: 'monospace', color: 'rgba(78,205,196,0.55)', letterSpacing: '0.18em' }} className="text-[9px]">LIVE TUTOR SESSION · ALEX</span>
                </div>
                <ChatDemo />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Trust bar ── */}
      <div style={{ borderTop: '1px solid rgba(78,205,196,0.07)', borderBottom: '1px solid rgba(78,205,196,0.07)', padding: '18px 28px', background: 'rgba(9,13,26,0.6)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          {[
            { icon: Shield,   text: 'Course-grounded content — no hallucinations' },
            { icon: CheckCircle2, text: 'Publicly verifiable certificate' },
            { icon: Clock,    text: '150-hour professional curriculum' },
            { icon: Brain,    text: 'Socratic AI — Haiku-powered, always current' },
          ].map(({ icon: I, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <I size={13} color="rgba(78,205,196,0.55)" />
              <span style={{ color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.04em' }} className="text-xs">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─ Features ─ */}
      <section style={{ padding: '96px 28px', background: 'var(--bg)', borderTop: '1px solid var(--line-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: 'var(--accent)', color: '#fff', padding: '3px 14px', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontFamily: '"Inter", sans-serif', fontWeight: 700, borderRadius: 2, marginBottom: 16 }}>Platform Features</div>
            <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 12, fontFamily: '"Charter", Georgia, serif' }}>
              Everything you need to <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>qualify</em>
            </h2>
            <p style={{ color: 'var(--ink-soft)', maxWidth: 480, margin: '0 auto', fontSize: 16, lineHeight: 1.6 }}>
              Built for working professionals upgrading UK accounting credentials &mdash; at their own pace.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
            {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 0.07} />)}
          </div>
        </div>
      </section>

      {/* ─ Curriculum ─ */}
      <section style={{ padding: '80px 28px', background: 'var(--bg-dark)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: 40 }}>
            <div style={{ display: 'inline-block', background: 'var(--accent)', color: '#fff', padding: '3px 12px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: '"Inter", sans-serif', fontWeight: 700, borderRadius: 2, marginBottom: 14 }}>Full Curriculum</div>
            <h2 style={{ fontSize: 'clamp(24px,2.8vw,38px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', marginBottom: 10, fontFamily: '"Charter", Georgia, serif' }}>
              87 modules across <span style={{ color: '#b8860b' }}>12 subject areas</span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 15 }}>ACCA/ACA-grade depth · practical UK focus · real practitioner scenarios</p>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            {PARTS.map(({ n, t, m }, i) => (
              <motion.div key={n}
                initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                whileHover={{ x: 4 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid var(--accent)', borderRadius: 4, padding: '12px 16px', transition: 'border-color 0.2s' }}>
                <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, color: '#fff', fontFamily: '"Inter", sans-serif', fontSize: 12 }}>
                  {n}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{t}</p>
                  <p style={{ color: '#475569', fontFamily: '"Inter", sans-serif', marginTop: 1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m} modules</p>
                </div>
                <ChevronRight size={13} color="#475569" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '96px 28px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontFamily: 'monospace', color: '#52D98B', letterSpacing: '0.22em', marginBottom: 12 }} className="text-micro">STUDENT OUTCOMES</p>
            <h2 style={{ fontSize: 'clamp(24px,2.8vw,38px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#E8F0FC' }}>
              What professionals are <span style={{ color: '#52D98B' }}>saying</span>
            </h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16 }}>
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: 'rgba(14,21,37,0.7)', border: '1px solid rgba(82,217,139,0.12)', borderRadius: 18, padding: '24px', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {'★★★★★'.split('').map((s, j) => <span key={j} style={{ color: '#E8B84B' }} className="text-small">{s}</span>)}
                </div>
                <p style={{ color: '#8EA8CC', lineHeight: 1.7, marginBottom: 18, fontStyle: 'italic' }} className="text-small">"{t.quote}"</p>
                <div>
                  <p style={{ fontWeight: 700, color: '#E8F0FC' }} className="text-small">{t.name}</p>
                  <p style={{ color: '#4A6285', fontFamily: 'monospace', marginTop: 2 }} className="text-tiny">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '110px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(78,205,196,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '20%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(155,111,208,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ position: 'relative', zIndex: 1, maxWidth: 580, margin: '0 auto' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            style={{ width: 60, height: 60, margin: '0 auto 24px', borderRadius: '50%', border: '1px solid rgba(78,205,196,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={26} color="#4ECDC4" />
          </motion.div>
          <h2 style={{ fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 14, color: '#E8F0FC' }}>
            Ready to start?
          </h2>
          <p style={{ color: '#8EA8CC', marginBottom: 36, lineHeight: 1.75 }} className="text-[15px]">
            Join professionals across the UK upgrading their accounting skills — guided by an AI that genuinely teaches.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(78,205,196,0.3)' }} whileTap={{ scale: 0.97 }}
                style={{ padding: '15px 40px', borderRadius: 13, background: 'linear-gradient(135deg,rgba(78,205,196,0.22),rgba(155,111,208,0.22))', border: '1px solid rgba(78,205,196,0.42)', color: '#4ECDC4', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 9 }} className="text-[15px]">
                Create free account <ArrowRight size={16} />
              </motion.button>
            </Link>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '15px 28px', borderRadius: 13, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8EA8CC', fontWeight: 500, cursor: 'pointer' }} className="text-[15px]">
                Sign in
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '28px', borderTop: '1px solid rgba(78,205,196,0.07)', textAlign: 'center', background: 'rgba(5,8,16,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <Brain size={13} color="rgba(78,205,196,0.35)" />
          <span style={{ color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.1em' }} className="text-xs">UK ACCOUNTING PRO</span>
        </div>
        <p style={{ color: '#4A6285' }} className="text-tiny">© {new Date().getFullYear()} AI-Powered Professional Learning</p>
      </footer>

      {/* ── Sticky mobile CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, type: 'spring', stiffness: 200 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 20px',
          background: 'rgba(5,8,16,0.95)',
          borderTop: '1px solid rgba(78,205,196,0.12)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          zIndex: 90,
          // hide on large screens via inline media — handled below by min-width check
        }}
        className="mobile-sticky-cta"
      >
        <div>
          <p style={{ fontWeight: 700, color: '#E8F0FC', marginBottom: 1 }} className="text-tiny">Start learning free</p>
          <p style={{ color: '#4A6285' }} className="text-micro">87 modules · AI tutor included</p>
        </div>
        <Link href="/register" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 11, background: 'linear-gradient(135deg,rgba(78,205,196,0.25),rgba(155,111,208,0.22))', border: '1px solid rgba(78,205,196,0.42)', color: '#4ECDC4', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 20px rgba(78,205,196,0.2)' }} className="text-small">
            Get started <ArrowRight size={13} />
          </motion.span>
        </Link>
      </motion.div>
    </div>
  )
}
