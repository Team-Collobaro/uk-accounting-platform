'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Brain, BookOpen, Award, Shield, TrendingUp, Users, CheckCircle2, Zap, ArrowRight, Sparkles, ChevronRight } from 'lucide-react'

// ─── Particle canvas ─────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    window.addEventListener('resize', onResize)

    const N = 90
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number }
    const pts: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.4, a: Math.random(),
    }))

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,255,${p.a * 0.55})`
        ctx.fill()
      }
      // connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 130) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(0,255,255,${(1 - dist / 130) * 0.1})`
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.7 }} />
}

// ─── Neon AI orb ─────────────────────────────────────────────────────────────
function AiOrb() {
  const orbRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame: number
    const tick = () => {
      const t = performance.now() / 1000
      if (orbRef.current) {
        const scale = 1 + 0.06 * Math.sin(t * 0.7)
        orbRef.current.style.transform = `scale(${scale})`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div style={{ position: 'relative', width: 260, height: 260, margin: '0 auto' }}>
      {/* outer glow rings */}
      {[1, 0.65, 0.42].map((opacity, i) => (
        <motion.div key={i}
          animate={{ scale: [1, 1.08, 1], opacity: [opacity * 0.4, opacity * 0.15, opacity * 0.4] }}
          transition={{ duration: 3 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          style={{
            position: 'absolute', inset: -(i * 28),
            borderRadius: '50%',
            border: `1px solid rgba(0,255,255,${opacity * 0.3})`,
            background: `radial-gradient(circle, rgba(0,255,255,${opacity * 0.04}) 0%, transparent 70%)`,
          }}
        />
      ))}
      {/* core orb */}
      <div ref={orbRef} style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 38%, rgba(0,255,255,0.25) 0%, rgba(120,0,255,0.18) 50%, rgba(0,0,0,0.6) 100%)',
        boxShadow: '0 0 60px rgba(0,255,255,0.35), 0 0 120px rgba(120,0,255,0.2), inset 0 0 40px rgba(0,255,255,0.12)',
        border: '1px solid rgba(0,255,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Brain size={72} color="rgba(0,255,255,0.9)" strokeWidth={1.2} />
      </div>
      {/* orbiting dot */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -20, borderRadius: '50%' }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '-4px', marginTop: '-4px',
          width: 8, height: 8, borderRadius: '50%',
          background: '#00ffff', boxShadow: '0 0 12px #00ffff',
        }} />
      </motion.div>
      {/* label tag */}
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.35)',
          borderRadius: 20, padding: '4px 14px', whiteSpace: 'nowrap',
          fontSize: 11, fontFamily: 'monospace', color: '#00ffff', letterSpacing: '0.15em',
        }}
      >
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
      const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 55)
      return () => clearTimeout(t)
    }
    if (!deleting && displayed.length === target.length) {
      const t = setTimeout(() => setDeleting(true), 2200)
      return () => clearTimeout(t)
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30)
      return () => clearTimeout(t)
    }
    if (deleting && displayed.length === 0) {
      setDeleting(false); setIdx((idx + 1) % texts.length)
    }
  }, [displayed, deleting, idx, texts])
  return (
    <span style={{ color: '#00ffff', fontWeight: 700 }}>
      {displayed}
      <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>|</motion.span>
    </span>
  )
}

// ─── Floating stat card ───────────────────────────────────────────────────────
function FloatCard({ icon: Icon, value, label, delay, color }: {
  icon: React.ElementType; value: string; label: string; delay: number; color: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      whileHover={{ scale: 1.04, y: -4 }}
      style={{
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`,
        borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14,
        backdropFilter: 'blur(12px)', cursor: 'default',
        boxShadow: `0 0 20px ${color}14`,
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, fontFamily: 'monospace', letterSpacing: '0.06em' }}>{label}</p>
      </div>
    </motion.div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────
const features = [
  { icon: Brain,      title: 'AI Tutor — Alex',         desc: 'Socratic teaching powered by Claude. Guides you with questions, not lectures. Adapts to your pace and weak areas.', color: '#00ffff' },
  { icon: BookOpen,   title: '87 Structured Modules',   desc: 'Across 12 parts covering every aspect of UK bookkeeping, VAT, payroll, corporation tax, and personal tax.', color: '#a855f7' },
  { icon: Award,      title: 'Verified Certificate',     desc: 'Earn a publicly verifiable certificate employers can check instantly via a unique URL — no central database needed.', color: '#f59e0b' },
  { icon: Shield,     title: 'RAG-Powered Accuracy',    desc: 'Every AI answer is grounded in your actual course content. No hallucinated tax rates or invented legislation.', color: '#22c55e' },
  { icon: TrendingUp, title: 'Adaptive Quizzes',         desc: 'Quizzes zero-in on your weakest areas. The AI tracks performance and suggests what to tackle next.', color: '#f43f5e' },
  { icon: Users,      title: 'Employer Portal',          desc: "Manage your whole team's progress, download reports, and verify certificates in bulk — one dashboard.", color: '#3b82f6' },
]

const parts = [
  { n: 1,  t: 'UK Compliance Landscape' }, { n: 2,  t: 'Double-Entry Bookkeeping' },
  { n: 3,  t: 'VAT & Indirect Taxes' },    { n: 4,  t: 'Payroll & PAYE' },
  { n: 5,  t: 'Management Accounting' },   { n: 6,  t: 'Financial Statements' },
  { n: 7,  t: 'Company Law & Governance' },{ n: 8,  t: 'Corporation Tax' },
  { n: 9,  t: 'Personal Tax' },            { n: 10, t: 'Capital Gains Tax' },
  { n: 11, t: 'Audit & Assurance' },       { n: 12, t: 'Professional Ethics' },
]

// ─── Chat demo ────────────────────────────────────────────────────────────────
const demoMessages = [
  { role: 'user', text: "What's the difference between FRS 102 and FRS 105?" },
  { role: 'ai',   text: "Great question. Before I explain, what do you think 'micro-entity' means in a regulatory context?" },
  { role: 'user', text: "A very small company?" },
  { role: 'ai',   text: "Exactly — one meeting 2 of 3 thresholds: turnover ≤£632k, balance sheet ≤£316k, ≤10 employees. FRS 105 is their simplified standard. What might be missing vs FRS 102?" },
]

function ChatDemo() {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    if (visible >= demoMessages.length) return
    const t = setTimeout(() => setVisible(v => v + 1), visible === 0 ? 600 : 1400)
    return () => clearTimeout(t)
  }, [visible])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AnimatePresence>
        {demoMessages.slice(0, visible).map((m, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35 }}
            style={{
              display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {m.role === 'ai' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,255,255,0.15)', border: '1px solid rgba(0,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                <Sparkles size={13} color="#00ffff" />
              </div>
            )}
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.role === 'user' ? 'linear-gradient(135deg,rgba(0,255,255,0.18),rgba(120,0,255,0.18))' : 'rgba(255,255,255,0.05)',
              border: m.role === 'user' ? '1px solid rgba(0,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
              fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55,
            }}>
              {m.text}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {visible < demoMessages.length && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: 4, paddingLeft: 36, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(0,255,255,0.5)' }} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 400], [0, -60])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0])
  const [navScrolled, setNavScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#060a12', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── Nav ── */}
      <motion.nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          borderBottom: navScrolled ? '1px solid rgba(0,255,255,0.12)' : '1px solid transparent',
          background: navScrolled ? 'rgba(6,10,18,0.85)' : 'transparent',
          backdropFilter: navScrolled ? 'blur(20px)' : 'none',
          transition: 'all 0.3s',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,rgba(0,255,255,0.3),rgba(120,0,255,0.3))', border: '1px solid rgba(0,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(0,255,255,0.2)' }}>
              <Brain size={18} color="#00ffff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>UK Accounting <span style={{ color: '#00ffff' }}>Pro</span></span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/login" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500, textDecoration: 'none', padding: '6px 14px', borderRadius: 8, transition: 'color 0.2s' }}>
              Sign in
            </Link>
            <Link href="/register" style={{ fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(0,255,255,0.2),rgba(120,0,255,0.2))', border: '1px solid rgba(0,255,255,0.4)', color: '#00ffff', boxShadow: '0 0 20px rgba(0,255,255,0.15)', transition: 'all 0.2s' }}>
              Get started free →
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <ParticleField />
        {/* grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,0.025) 1px,transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />
        {/* radial glow */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,255,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 2, maxWidth: 1200, margin: '0 auto', padding: '100px 24px 60px', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

            {/* left */}
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,255,255,0.08)', border: '1px solid rgba(0,255,255,0.25)', borderRadius: 30, padding: '5px 14px', marginBottom: 28 }}>
                  <Zap size={12} color="#00ffff" fill="#00ffff" />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#00ffff', letterSpacing: '0.15em' }}>AI-POWERED · UK FOCUSED · 150 HOURS</span>
                </div>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
                style={{ fontSize: 'clamp(36px,4.5vw,58px)', fontWeight: 800, lineHeight: 1.12, marginBottom: 20, letterSpacing: '-0.02em' }}>
                Master{' '}
                <Typewriter texts={['UK Accounting', 'VAT & Tax', 'Payroll & PAYE', 'FRS 102 & 105']} />
                <br />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500, fontSize: '0.7em' }}>with an AI that teaches like a pro</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
                style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, marginBottom: 36, maxWidth: 480 }}>
                87 modules. 12 subject areas. An AI tutor that asks questions instead of giving answers
                — the Socratic method, scaled to every student.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.6 }}
                style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
                <Link href="/register" style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(0,255,255,0.3)' }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(0,255,255,0.25),rgba(120,0,255,0.25))', border: '1px solid rgba(0,255,255,0.45)', color: '#00ffff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
                    <Sparkles size={16} /> Create free account
                  </motion.button>
                </Link>
                <Link href="/login" style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '14px 28px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                    Sign in
                  </motion.button>
                </Link>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FloatCard icon={BookOpen}   value="87"    label="MODULES" delay={0.6} color="#00ffff" />
                <FloatCard icon={Award}      value="150h"  label="CURRICULUM" delay={0.7} color="#a855f7" />
                <FloatCard icon={TrendingUp} value="12"    label="SUBJECT AREAS" delay={0.8} color="#22c55e" />
                <FloatCard icon={Users}      value="AI"    label="TUTOR · ALEX" delay={0.9} color="#f59e0b" />
              </motion.div>
            </div>

            {/* right — orb + chat demo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}>
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.8, type: 'spring', stiffness: 120 }}>
                <AiOrb />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '20px 18px', backdropFilter: 'blur(20px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ffff', boxShadow: '0 0 8px #00ffff' }} />
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(0,255,255,0.6)', letterSpacing: '0.15em' }}>LIVE TUTOR SESSION</span>
                </div>
                <ChatDemo />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#00ffff', letterSpacing: '0.2em', marginBottom: 16 }}>PLATFORM FEATURES</p>
            <h2 style={{ fontSize: 'clamp(28px,3vw,44px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
              Everything you need to <span style={{ color: '#00ffff' }}>pass</span>
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', maxWidth: 500, margin: '0 auto' }}>
              Built for working professionals upgrading UK accounting credentials.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
            {features.map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6, boxShadow: `0 20px 60px ${color}18` }}
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 20, padding: '28px 26px', cursor: 'default', transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}
                onHoverStart={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40` }}
                onHoverEnd={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
              >
                <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}14`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: '#fff' }}>{title}</h3>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Curriculum ── */}
      <section style={{ padding: '100px 24px', background: 'rgba(0,255,255,0.02)', borderTop: '1px solid rgba(0,255,255,0.06)', borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#a855f7', letterSpacing: '0.2em', marginBottom: 14 }}>FULL CURRICULUM</p>
            <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>
              87 modules across <span style={{ color: '#a855f7' }}>12 subject areas</span>
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>ACCA/ACA-grade depth, practical UK focus</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            {parts.map(({ n, t }, i) => (
              <motion.div key={n}
                initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                whileHover={{ x: 4 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,rgba(0,255,255,0.2),rgba(120,0,255,0.2))', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#00ffff', fontFamily: 'monospace' }}>
                  {n}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.75)', flex: 1 }}>{t}</span>
                <CheckCircle2 size={15} color="rgba(34,197,94,0.6)" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '120px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(0,255,255,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            style={{ width: 64, height: 64, margin: '0 auto 28px', borderRadius: '50%', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={28} color="#00ffff" />
          </motion.div>
          <h2 style={{ fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Ready to start learning?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 40, lineHeight: 1.7 }}>
            Join professionals upgrading their UK accounting skills with the power of AI-guided, Socratic learning.
          </p>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(0,255,255,0.35)' }}
              whileTap={{ scale: 0.97 }}
              style={{ padding: '16px 44px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(0,255,255,0.22),rgba(120,0,255,0.22))', border: '1px solid rgba(0,255,255,0.45)', color: '#00ffff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              Create your free account <ArrowRight size={18} />
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          <Brain size={14} color="rgba(0,255,255,0.4)" />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>UK ACCOUNTING PRO</span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} AI-Powered Professional Learning</p>
      </footer>
    </div>
  )
}
