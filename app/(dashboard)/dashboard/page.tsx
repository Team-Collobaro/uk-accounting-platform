'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import BlurText from '@/components/reactbits/BlurText'
import CountUp from '@/components/reactbits/CountUp'
import {
  BookOpen, Award, TrendingUp, Clock,
  CheckCircle2, Circle, Lock, ChevronRight,
  AlertCircle, Brain, Sparkles, Zap, ChevronDown, ChevronUp,
  Flame, Target, Play, ArrowRight, Star, Trophy, Rocket,
  BookMarked, Coffee, Lightbulb,
} from 'lucide-react'

function mods(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => `m${String(i + from).padStart(2, '0')}`)
}

const PARTS = [
  { number: 1,  title: 'Foundations',             modules: mods(1,  7),  color: '#4ECDC4' },
  { number: 2,  title: 'Cloud Software Platforms', modules: mods(8,  12), color: '#9B6FD0' },
  { number: 3,  title: 'VAT',                      modules: mods(13, 20), color: '#E8B84B' },
  { number: 4,  title: 'Payroll PAYE & CIS',        modules: mods(21, 26), color: '#52D98B' },
  { number: 5,  title: 'Year-End Accounts',         modules: mods(27, 34), color: '#E87B6F' },
  { number: 6,  title: 'Corporation Tax',           modules: mods(35, 40), color: '#6FA8E8' },
  { number: 7,  title: 'Self Assessment',           modules: mods(41, 48), color: '#E87BB8' },
  { number: 8,  title: 'Incorporation',             modules: mods(49, 57), color: '#4ECDC4' },
  { number: 9,  title: 'Cessation',                 modules: mods(58, 66), color: '#52D98B' },
  { number: 10, title: 'Structure Changes',         modules: mods(67, 74), color: '#E8B84B' },
  { number: 11, title: 'Specialist Tax',            modules: mods(75, 82), color: '#9B6FD0' },
  { number: 12, title: 'Practice & Ethics',         modules: mods(83, 87), color: '#4ECDC4' },
]

const MODULE_TITLES: Record<string, string> = {
  m01: 'UK Compliance Landscape',       m02: 'UK Business Structures',
  m03: 'Double-Entry Bookkeeping',      m04: 'Chart of Accounts',
  m05: 'Bookkeeping Cycle',             m06: 'Source Documents',
  m07: 'Cash vs Accruals Basis',        m08: 'Dext',
  m09: 'Xero',                          m10: 'QuickBooks Online',
  m11: 'Sage Business Cloud',           m12: 'FreeAgent',
  m13: 'VAT Fundamentals',              m14: 'VAT Schemes',
  m15: 'VAT on Goods',                  m16: 'VAT on Services',
  m17: 'VAT on Land & Property',        m18: 'Partial Exemption',
  m19: 'VAT Errors & Penalties',        m20: 'Making Tax Digital (VAT)',
  m21: 'PAYE Fundamentals',             m22: 'Statutory Payments',
  m23: 'Auto-Enrolment Pensions',       m24: 'Benefits in Kind & P11D',
  m25: 'Year-End Payroll',              m26: 'CIS',
  m27: 'Year-End Process',              m28: 'Adjusting Journals',
  m29: 'FRS 105 Micro-Entity',          m30: 'FRS 102 Section 1A',
  m31: 'FRS 102 Full',                  m32: 'Disclosure Reasoning',
  m33: 'iXBRL Tagging',                 m34: 'Companies House Filing',
  m35: 'Corporation Tax Fundamentals',  m36: 'Adjusting to Taxable Profit',
  m37: 'Capital Allowances',            m38: 'R&D Tax Relief',
  m39: 'Loss & Group Relief',           m40: 'CT600 Walkthrough',
  m41: 'SA100 Main Return',             m42: 'SA103 Self-Employment',
  m43: 'SA105 Property Income',         m44: 'SA108 Capital Gains',
  m45: 'SA104 Partnership Income',      m46: 'SA109 Residence & Domicile',
  m47: 'Tax Calculation & PoA',         m48: 'SA Reliefs',
  m49: 'Choosing a Structure',          m50: 'Sole Trader Setup',
  m51: 'Partnership Setup',             m52: 'Ltd Company Setup',
  m53: 'LLP Setup',                     m54: 'Charity Registration',
  m55: 'Sole Trader → Ltd',             m56: 'Partnership → LLP / Ltd',
  m57: 'First-Year Filings',            m58: 'Sole Trader Cessation',
  m59: 'Partnership Cessation',         m60: 'Ltd Strike-Off (DS01)',
  m61: "Members' Voluntary Liquidation",m62: "Creditors' Voluntary Liquidation",
  m63: 'Compulsory Liquidation',        m64: 'Administration & CVA',
  m65: 'Final Accounts on Cessation',   m66: 'Capital Distributions & BADR',
  m67: 'Ltd → Sole Trader',             m68: 'Sole Trader → Partnership',
  m69: 'Partnership → Ltd',             m70: 'Group Restructuring',
  m71: 'Ltd → Charity / CIO',           m72: 'Asset Sale vs Share Sale',
  m73: 'Demergers',                     m74: 'Reconstructions',
  m75: 'IR35 / Off-Payroll',            m76: 'Inheritance Tax',
  m77: 'Stamp Duty Land Tax',           m78: 'CGT Reliefs',
  m79: 'Trusts',                        m80: 'Non-Domiciled Status',
  m81: 'HMRC Enquiries',                m82: 'Penalty Regimes',
  m83: 'AML & MLR 2017',                m84: 'Professional Ethics',
  m85: 'Engagement Letters',            m86: 'GDPR for Accountants',
  m87: 'Professional Indemnity Insurance',
}

const MOTIVATIONAL = [
  { icon: Coffee,    text: 'One module a day keeps the confusion away.' },
  { icon: Lightbulb, text: 'Alex is ready to guide you through any topic.' },
  { icon: Rocket,   text: 'The UK\'s best accounting minds started exactly here.' },
  { icon: Star,     text: 'Consistency beats intensity — keep your streak going.' },
]

interface ProgressData {
  completedModules: string[]
  overallPercentage: number
  avgQuizScore: number
  nextRecommendedModule: string
  certificates: Array<{ id: string; verification_code: string; final_score: number; completion_date: string }>
}

// ─── Celebration particle burst ──────────────────────────────────────────────
function CelebrationBurst({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200 }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * 360
        const dist = 80 + Math.random() * 120
        const colors = ['#4ECDC4', '#9B6FD0', '#52D98B', '#E8B84B', '#E87B6F']
        return (
          <motion.div key={i}
            initial={{ x: '50vw', y: '50vh', scale: 0, opacity: 1 }}
            animate={{
              x: `calc(50vw + ${Math.cos(angle * Math.PI / 180) * dist}px)`,
              y: `calc(50vh + ${Math.sin(angle * Math.PI / 180) * dist}px)`,
              scale: [0, 1.2, 0],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.03 }}
            style={{
              position: 'absolute', width: 8, height: 8, borderRadius: '50%',
              background: colors[i % colors.length],
              boxShadow: `0 0 8px ${colors[i % colors.length]}`,
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Progress ring ────────────────────────────────────────────────────────────
function ProgressRing({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, countTo, color, delay, suffix }: {
  icon: React.ElementType; label: string; value: string; countTo?: number; color: string; delay: number; suffix?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      style={{
        background: 'var(--card-bg)',
        border: `1px solid ${color}30`,
        borderRadius: 16, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative', overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        cursor: 'default',
        transition: 'box-shadow 0.2s',
      }}
      whileTap={{ scale: 0.98 }}
    >

      <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <p style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }} className="text-micro">{label}</p>
        <p style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }} className="text-3xl">
          {countTo !== undefined
            ? <><CountUp to={countTo} from={0} duration={1.4} delay={delay} />{suffix}</>
            : value}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Quick module card ────────────────────────────────────────────────────────
function QuickModuleCard({ moduleId, status, color, isNext, onClick }: {
  moduleId: string; status: 'completed' | 'available' | 'locked'; color: string; isNext?: boolean; onClick: () => void
}) {
  const isDone  = status === 'completed'
  const isAvail = status === 'available'
  return (
    <motion.div
      whileHover={status !== 'locked' ? { scale: 1.02, y: -2 } : {}}
      whileTap={status !== 'locked' ? { scale: 0.97 } : {}}
      onClick={onClick}
      style={{
        padding: '11px 13px', borderRadius: 11,
        cursor: status !== 'locked' ? 'pointer' : 'default',
        background: isDone ? `${color}12` : isNext ? 'var(--bg-hover)' : isAvail ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: isDone ? `1px solid ${color}35` : isNext ? '1px solid var(--border-medium)' : isAvail ? '1px solid var(--border-subtle)' : '1px solid var(--border-subtle)',
        opacity: status === 'locked' ? 0.35 : 1,
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {isNext && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(78,205,196,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
        {isDone
          ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={12} color={color} />
            </div>
          : isNext
            ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(78,205,196,0.18)', border: '1px solid rgba(78,205,196,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={9} color="var(--ac-cyan)" style={{ marginLeft: 1 }} />
              </div>
            : isAvail
              ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Circle size={9} color="var(--text-tertiary)" />
                </div>
              : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={9} color="var(--text-tertiary)" />
                </div>
        }
      </div>
      <div style={{ minWidth: 0, flex: 1, position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 2 }} className="text-[9px]">{moduleId.toUpperCase()}</p>
        <p style={{ fontWeight: isNext ? 600 : 500, color: isDone ? color : isNext ? 'var(--ac-cyan)' : isAvail ? 'var(--text-secondary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-xs">
          {MODULE_TITLES[moduleId] ?? moduleId.toUpperCase()}
        </p>
      </div>
      {(isAvail || isNext) && <ChevronRight size={12} color={isNext ? 'var(--ac-cyan)' : 'var(--text-tertiary)'} style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} />}
    </motion.div>
  )
}

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
function Shimmer({ w, h, r = 10, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.04, 0.12, 0.04] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay }}
      style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, rgba(78,205,196,0.08) 0%, rgba(155,111,208,0.12) 50%, rgba(78,205,196,0.08) 100%)', flexShrink: 0 }}
    />
  )
}

function DashboardSkeleton() {
  return (
    <div style={{ minHeight: '100vh', color: 'var(--text-primary)', padding: '0 0 100px' }}>
      <div style={{ padding: '28px 28px 24px', borderBottom: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Shimmer w={42} h={42} r={14} delay={0} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Shimmer w={80} h={9} r={5} delay={0.05} />
                <Shimmer w={140} h={22} r={8} delay={0.1} />
                <Shimmer w={110} h={11} r={5} delay={0.15} />
              </div>
            </div>
            <Shimmer w={160} h={46} r={12} delay={0.1} />
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Shimmer w={52} h={52} r={16} delay={0.05} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Shimmer w={160} h={10} r={5} delay={0.1} />
                <Shimmer w={220} h={18} r={7} delay={0.15} />
                <Shimmer w={140} h={11} r={5} delay={0.2} />
              </div>
            </div>
            <Shimmer w={120} h={44} r={13} delay={0.1} />
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 22 }}>
          {[0, 0.06, 0.12, 0.18, 0.24, 0.3].map((d, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d }}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Shimmer w={44} h={44} r={13} delay={d} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Shimmer w={70} h={9} r={4} delay={d + 0.05} />
                <Shimmer w={50} h={20} r={6} delay={d + 0.1} />
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 + i * 0.04 }}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Shimmer w={34} h={34} r={10} delay={i * 0.04} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Shimmer w={60} h={9} r={4} delay={i * 0.04 + 0.05} />
                <Shimmer w={i % 2 === 0 ? 160 : 200} h={14} r={6} delay={i * 0.04 + 0.1} />
              </div>
              <Shimmer w={72} h={3} r={3} delay={i * 0.04 + 0.08} />
              <Shimmer w={15} h={15} r={4} delay={i * 0.04 + 0.12} />
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32 }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--ac-cyan)' : i === 1 ? 'var(--ac-violet)' : 'var(--ac-mint)' }} />
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Milestone toast ──────────────────────────────────────────────────────────
function MilestoneToast({ message, icon: Icon, color, onDismiss }: {
  message: string; icon: React.ElementType; color: string; onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onDismiss}
      style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 300, cursor: 'pointer',
        background: `linear-gradient(135deg, ${color}18, rgba(5,8,16,0.92))`,
        border: `1px solid ${color}45`,
        borderRadius: 16, padding: '14px 22px',
        display: 'flex', alignItems: 'center', gap: 12,
        backdropFilter: 'blur(20px)',
        boxShadow: `var(--shadow-lg), 0 0 30px ${color}20`,
        minWidth: 280,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ color: color, fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 2 }} className="text-tiny">MILESTONE</p>
        <p style={{ fontWeight: 600, color: '#E8F0FC' }} className="text-sm">{message}</p>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [studentName, setStudentName] = useState('Student')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]))
  const [dailyGoal] = useState(3)
  const [todayDone] = useState(0)
  const [motivIdx] = useState(() => Math.floor(Math.random() * MOTIVATIONAL.length))
  const [celebration, setCelebration] = useState(false)
  const [milestone, setMilestone] = useState<{ message: string; icon: React.ElementType; color: string } | null>(null)
  const [hoveredModule, setHoveredModule] = useState<string | null>(null)
  const prevCompletedRef = useRef<number>(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [studentRes, progressRes] = await Promise.all([
        supabase.from('students').select('name').eq('id', user.id).single(),
        fetch('/api/progress'),
      ])
      if (studentRes.data) setStudentName(studentRes.data.name)
      if (progressRes.ok) {
        const data = await progressRes.json() as ProgressData
        const newCount = data.completedModules.length

        // Check for milestones
        if (prevCompletedRef.current > 0 && newCount > prevCompletedRef.current) {
          setCelebration(true)
          setTimeout(() => setCelebration(false), 2000)

          if (newCount === 1) setMilestone({ message: 'First module complete!', icon: Rocket, color: '#4ECDC4' })
          else if (newCount === 5) setMilestone({ message: '5 modules done — keep it up!', icon: Star, color: '#E8B84B' })
          else if (newCount === 10) setMilestone({ message: '10 modules! You\'re on a roll.', icon: Flame, color: '#E87B6F' })
          else if (newCount === 25) setMilestone({ message: '25 modules — nearly a third done!', icon: Trophy, color: '#9B6FD0' })
          else if (newCount === 50) setMilestone({ message: 'Halfway there — 50 modules!', icon: Award, color: '#52D98B' })
          else if (newCount === 87) setMilestone({ message: 'All 87 modules complete!', icon: Trophy, color: '#E8B84B' })
        }
        prevCompletedRef.current = newCount

        setProgress(data)
        if (data.nextRecommendedModule) {
          const part = PARTS.find(p => p.modules.includes(data.nextRecommendedModule))
          if (part) setExpandedParts(new Set([part.number]))
        }
      }
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  function isPartUnlocked(partNumber: number): boolean {
    if (!progress) return partNumber === 1
    if (partNumber === 1) return true
    const prevPart = PARTS.find(p => p.number === partNumber - 1)
    if (!prevPart) return false
    return prevPart.modules.every(m => progress.completedModules.includes(m))
  }

  function getModuleStatus(moduleId: string): 'completed' | 'available' | 'locked' {
    if (!progress) return moduleId === 'm01' ? 'available' : 'locked'
    if (progress.completedModules.includes(moduleId)) return 'completed'
    const ownerPart = PARTS.find(p => p.modules.includes(moduleId))
    if (ownerPart && !isPartUnlocked(ownerPart.number)) return 'locked'
    const allModules = PARTS.flatMap(p => p.modules)
    const pos = allModules.indexOf(moduleId)
    if (pos === 0) return 'available'
    const prevId = allModules[pos - 1]
    return progress.completedModules.includes(prevId) ? 'available' : 'locked'
  }

  const togglePart = (n: number) => setExpandedParts(prev => {
    const next = new Set(prev)
    next.has(n) ? next.delete(n) : next.add(n)
    return next
  })

  if (loading) return <DashboardSkeleton />

  const completed  = progress?.completedModules.length ?? 0
  const pct        = progress?.overallPercentage ?? 0
  const nextModule = progress?.nextRecommendedModule ?? 'm01'
  const nextTitle  = MODULE_TITLES[nextModule] ?? nextModule.toUpperCase()
  const nextPart   = PARTS.find(p => p.modules.includes(nextModule))
  const streak     = Math.max(1, Math.floor(completed / 3) + (completed > 0 ? 1 : 0))
  const goalPct    = Math.min(100, Math.round((todayDone / dailyGoal) * 100))
  const MotivIcon  = MOTIVATIONAL[motivIdx].icon

  // Nearby modules (next 3 available/incomplete after nextModule)
  const allModules  = PARTS.flatMap(p => p.modules)
  const nextIdx     = allModules.indexOf(nextModule)
  const nearbyMods  = allModules.slice(Math.max(0, nextIdx - 1), nextIdx + 4).filter(m => m !== nextModule).slice(0, 3)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: '"Inter", system-ui, sans-serif', padding: '0 0 100px',
      // dashboard CSS overrides — map dark vars to old-HTML warm palette
      ['--card-bg' as string]: '#fff',
      ['--card-border' as string]: 'var(--line)',
      ['--bg-elevated' as string]: 'var(--bg)',
      ['--bg-hover' as string]: 'var(--line-soft)',
      ['--bg-surface' as string]: '#fff',
      ['--text-primary' as string]: 'var(--ink)',
      ['--text-secondary' as string]: 'var(--ink-soft)',
      ['--text-tertiary' as string]: 'var(--ink-faint)',
      ['--border-subtle' as string]: 'var(--line)',
      ['--border-medium' as string]: 'var(--line)',
      ['--ac-cyan' as string]: 'var(--accent-2)',
      ['--ac-violet' as string]: '#6d28d9',
      ['--ac-mint' as string]: 'var(--accent-3)',
      ['--glass-overlay' as string]: 'rgba(255,255,255,0.95)',
    }}>
      <CelebrationBurst active={celebration} />

      <AnimatePresence>
        {milestone && <MilestoneToast {...milestone} onDismiss={() => setMilestone(null)} />}
      </AnimatePresence>

      {/* ─ Hero banner – editorial part-header style ─ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, var(--bg-dark) 0%, #0f172a 100%)',
          color: '#fff', padding: '32px 36px 28px',
          borderLeft: '6px solid var(--accent)',
          position: 'relative', overflow: 'hidden',
        }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* greeting row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'inline-block', background: 'var(--accent)', color: '#fff', padding: '3px 12px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: '"Inter", sans-serif', fontWeight: 700, borderRadius: 2, marginBottom: 12 }}>
                ACCA / ACA Grade
              </div>
              <div style={{ fontWeight: 800, letterSpacing: '-0.015em', color: '#fff', fontSize: 22, fontFamily: '"Charter", "Georgia", serif', marginBottom: 4, lineHeight: 1.2 }}>
                <BlurText text={`Welcome back, ${studentName.split(' ')[0]}!`} className="aurora-text" delay={70} direction="top" stepDuration={0.15} />
              </div>
              <p style={{ color: '#94a3b8', marginTop: 4, fontWeight: 400, fontSize: 14, lineHeight: 1.5, margin: '4px 0 0', fontFamily: '"Inter", sans-serif' }}>Ready to continue your studies? {completed} of 87 modules complete &mdash; {pct}% through the qualification.</p>
            </div>
          </div>

          {/* Continue Learning CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '18px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 16, position: 'relative', overflow: 'hidden',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 48, height: 48, borderRadius: 6, background: 'rgba(185,28,28,0.2)', border: '1px solid rgba(185,28,28,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Play size={20} color="var(--accent)" style={{ marginLeft: 2 }} />
              </motion.div>
              <div>
                <p style={{ fontFamily: '"Inter", sans-serif', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: 4, opacity: 0.9, fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>
                  Continue Learning &middot; {nextPart ? `Part ${nextPart.number}` : ''}
                </p>
                <h2 style={{ fontWeight: 700, color: '#fff', margin: '0 0 2px', lineHeight: 1.2, fontSize: 18, fontFamily: '"Charter", "Georgia", serif' }}>{nextTitle}</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: 12, fontFamily: '"Inter", sans-serif' }}>{nextModule.toUpperCase()} &middot; Alex is ready to guide you</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Link href={`/course/${nextModule}`} style={{ textDecoration: 'none' }}>
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '11px 24px', borderRadius: 4,
                    background: 'var(--accent)',
                    border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fff',
                    fontFamily: '"Inter", sans-serif', fontSize: 14, letterSpacing: '0.02em',
                  }}>
                  Start Now <ArrowRight size={15} />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Stats + Daily Goal row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 22 }}>
          <StatCard icon={BookOpen}   label="Modules done"  value={`${completed}`}    countTo={completed}                       color="#4ECDC4" delay={0.05} />
          <StatCard icon={TrendingUp} label="Avg quiz score" value={`${progress?.avgQuizScore ?? 0}%`} countTo={progress?.avgQuizScore ?? 0} color="#52D98B" delay={0.1}  suffix="%" />
          <StatCard icon={Clock}      label="Est. hours"     value=""                  countTo={Math.round(completed * 1.72)}    color="#E8B84B" delay={0.15} suffix="h" />
          <StatCard icon={Award}      label="Certificates"   value=""                  countTo={progress?.certificates.length ?? 0} color="#9B6FD0" delay={0.2} />

          {/* Streak */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            whileHover={{ y: -4, scale: 1.02 }}
            style={{ background: 'var(--card-bg)', border: '1px solid rgba(232,184,75,0.28)', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, backdropFilter: 'blur(12px)' }}>
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flame size={19} color="#E8B84B" />
            </motion.div>
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }} className="text-micro">Streak</p>
              <p style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }} className="text-3xl">
                <CountUp to={streak} from={0} duration={1.4} delay={0.25} /> <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }} className="text-small">days</span>
              </p>
            </div>
          </motion.div>

          {/* Daily goal */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ y: -4, scale: 1.02 }}
            style={{ background: 'var(--card-bg)', border: '1px solid rgba(82,217,139,0.22)', borderRadius: 16, padding: '18px 20px', backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Target size={15} color="#52D98B" />
              <p style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }} className="text-micro">Daily Goal</p>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#52D98B' }} className="text-tiny">{todayDone}/{dailyGoal}</span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${goalPct}%` }} transition={{ duration: 1, delay: 0.5 }}
                style={{ height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#52D98B,#4ECDC4)', boxShadow: '0 0 8px rgba(82,217,139,0.4)' }} />
            </div>
            <p style={{ color: 'var(--text-tertiary)', marginTop: 7 }} className="text-tiny">
              {todayDone === 0 ? `Start today — ${dailyGoal} modules goal` : `${dailyGoal - todayDone} more to hit your goal`}
            </p>
          </motion.div>
        </div>

        {/* ── Overall progress + AI tutor badge ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 22, alignItems: 'stretch' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ProgressRing pct={pct} color="var(--ac-cyan)" size={80} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 800, color: 'var(--ac-cyan)' }} className="text-[15px]">{pct}%</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }} className="text-sm">Overall course progress</h2>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }} className="text-xs">{completed}/87 modules</span>
              </div>
              <div style={{ height: 5, borderRadius: 5, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.3, ease: 'easeOut', delay: 0.4 }}
                  style={{ height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,var(--ac-cyan),var(--ac-violet))', boxShadow: '0 0 10px rgba(78,205,196,0.3)' }} />
              </div>
              <p style={{ color: 'var(--text-tertiary)', marginTop: 7 }} className="text-tiny">{87 - completed} modules remaining to complete the qualification</p>
            </div>
          </motion.div>


        </div>

        {/* ── Part accordion ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BookMarked size={14} color="var(--ac-cyan)" style={{ opacity: 0.6 }} />
            <h2 style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }} className="text-small">Your Curriculum</h2>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', marginLeft: 'auto' }} className="text-micro">
              {PARTS.filter(p => isPartUnlocked(p.number)).length}/12 parts unlocked
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PARTS.map((part, pi) => {
              const doneInPart  = part.modules.filter(m => progress?.completedModules.includes(m)).length
              const partPct     = Math.round(doneInPart / part.modules.length * 100)
              const isExpanded  = expandedParts.has(part.number)
              const partLocked  = !isPartUnlocked(part.number)
              const hasNextMod  = part.modules.includes(nextModule)
              const partDone    = doneInPart === part.modules.length

              return (
                <motion.div key={part.number}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + pi * 0.03 }}
                  style={{
                    background: hasNextMod ? 'var(--bg-elevated)' : partDone ? `${part.color}08` : 'var(--card-bg)',
                    border: `1px solid ${partLocked ? 'var(--border-subtle)' : hasNextMod ? 'var(--border-medium)' : partDone ? `${part.color}25` : `${part.color}20`}`,
                    borderRadius: 16, overflow: 'hidden',
                    opacity: partLocked ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}>

                  {/* Part header */}
                  <button
                    onClick={() => !partLocked && togglePart(part.number)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: partLocked ? 'default' : 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: partLocked ? 'var(--bg-elevated)' : `${part.color}18`, border: `1px solid ${partLocked ? 'var(--border-subtle)' : part.color + '40'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, color: partLocked ? 'var(--text-tertiary)' : part.color, fontFamily: 'monospace' }} className="text-xs">
                      {partLocked ? <Lock size={13} /> : partDone ? <CheckCircle2 size={14} color={part.color} /> : part.number}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ display: 'block', fontFamily: 'monospace', color: partLocked ? 'var(--text-tertiary)' : `${part.color}90`, letterSpacing: '0.12em', margin: 0 }} className="text-[9px]">PART {part.number}</span>
                        {!partLocked && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }} className="text-micro">{doneInPart}/{part.modules.length}</span>}
                        {hasNextMod && <span style={{ fontFamily: 'monospace', color: 'var(--ac-cyan)', letterSpacing: '0.1em', background: 'rgba(78,205,196,0.12)', padding: '1px 6px', borderRadius: 4 }} className="text-[9px]">ACTIVE</span>}
                        {partDone && !partLocked && <span style={{ fontFamily: 'monospace', color: `${part.color}`, letterSpacing: '0.1em', background: `${part.color}15`, padding: '1px 6px', borderRadius: 4 }} className="text-[9px]">COMPLETE</span>}
                      </div>
                      <span style={{ display: 'block', fontWeight: 600, color: partLocked ? 'var(--text-tertiary)' : 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-sm">{part.title}</span>
                    </div>
                    {!partLocked && (
                      <div style={{ width: 72, height: 3, borderRadius: 3, background: 'var(--bg-elevated)', flexShrink: 0, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${partPct}%` }}
                          transition={{ duration: 0.9, delay: 0.5 + pi * 0.03 }}
                          style={{ height: '100%', borderRadius: 3, background: part.color, boxShadow: `0 0 5px ${part.color}` }} />
                      </div>
                    )}
                    <div style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {partLocked ? <Lock size={13} color="var(--text-tertiary)" /> : isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {/* Module grid */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 7, padding: '4px 14px 14px' }}>
                          {part.modules.map(moduleId => (
                            <div key={moduleId}
                              onMouseEnter={() => setHoveredModule(moduleId)}
                              onMouseLeave={() => setHoveredModule(null)}>
                              <QuickModuleCard
                                moduleId={moduleId}
                                status={getModuleStatus(moduleId)}
                                color={part.color}
                                isNext={moduleId === nextModule}
                                onClick={() => getModuleStatus(moduleId) !== 'locked' && router.push(`/course/${moduleId}`)}
                              />
                              <AnimatePresence>
                                {hoveredModule === moduleId && getModuleStatus(moduleId) !== 'locked' && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                                    style={{ position: 'absolute', zIndex: 50, background: 'var(--glass-overlay)', border: `1px solid ${part.color}30`, borderRadius: 10, padding: '8px 12px', pointerEvents: 'none', marginTop: 4, maxWidth: 200, backdropFilter: 'blur(12px)' }}>
                                    <p style={{ color: 'var(--text-primary)', margin: 0 }} className="text-tiny">{MODULE_TITLES[moduleId]}</p>
                                    <p style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 2 }} className="text-[9px]">
                                      {getModuleStatus(moduleId) === 'completed' ? '✓ Completed' : 'Click to start →'}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* ── Certificate ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ marginTop: 20, background: 'var(--card-bg)', border: '1px solid rgba(232,184,75,0.20)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Award size={18} color="#E8B84B" />
            <h2 style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)' }} className="text-[15px]">Certificate</h2>
          </div>

          {progress?.certificates && progress.certificates.length > 0 ? (
            progress.certificates.map(cert => (
              <motion.div key={cert.id} whileHover={{ scale: 1.01 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.25)', borderRadius: 12, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#E8B84B', margin: 0 }} className="text-sm">UK Bookkeeping, Accounting &amp; Taxation</p>
                  <p style={{ color: 'rgba(232,184,75,0.6)', marginTop: 3 }} className="text-tiny">Score: {cert.final_score}% · Issued {new Date(cert.completion_date).toLocaleDateString('en-GB')}</p>
                </div>
                <Link href={`/verify/${cert.verification_code}`} style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '9px 18px', background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 9, color: '#E8B84B', fontWeight: 700, cursor: 'pointer' }} className="text-small">
                    View Certificate
                  </motion.button>
                </Link>
              </motion.div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
              <AlertCircle size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }} className="text-small">Certificate not yet earned</p>
                <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.6, margin: '0 0 12px' }} className="text-xs">
                  Complete all 87 modules and pass the final exam with 70%+ to receive your verifiable certificate.
                </p>
                {/* Progress toward certificate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.6 }}
                      style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#E8B84B,#9B6FD0)', boxShadow: '0 0 8px rgba(232,184,75,0.3)' }} />
                  </div>
                  <span style={{ color: 'var(--ac-cyan)', fontFamily: 'monospace', flexShrink: 0 }} className="text-tiny">{completed}/87</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Quick actions row ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            { label: 'Continue learning', icon: Play, color: '#4ECDC4', href: `/course/${nextModule}` },
            { label: 'Browse curriculum', icon: BookOpen, color: '#9B6FD0', action: () => togglePart(1) },
            { label: 'View certificate', icon: Award, color: '#E8B84B', href: completed === 87 ? `/verify/${progress?.certificates[0]?.verification_code}` : undefined },
            { label: 'Track progress', icon: TrendingUp, color: '#52D98B', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
          ].map(({ label, icon: Icon, color, href, action }) => (
            <motion.div key={label}
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => { if (action) action(); else if (href) router.push(href) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 13,
                background: 'var(--card-bg)', border: `1px solid ${color}22`, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }} className="text-xs">{label}</span>
              <ChevronRight size={12} color={`${color}60`} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}
