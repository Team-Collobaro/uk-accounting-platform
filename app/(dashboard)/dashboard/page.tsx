'use client'

import { useState, useEffect } from 'react'
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
  Flame, Target, Play, ArrowRight,
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

interface ProgressData {
  completedModules: string[]
  overallPercentage: number
  avgQuizScore: number
  nextRecommendedModule: string
  certificates: Array<{ id: string; verification_code: string; final_score: number; completion_date: string }>
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
function StatCard({ icon: Icon, label, value, countTo, color, delay }: {
  icon: React.ElementType; label: string; value: string; countTo?: number; color: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileHover={{ y: -3, scale: 1.02 }}
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, rgba(5,8,16,0.6) 100%)`,
        border: `1px solid ${color}25`,
        borderRadius: 16, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative', overflow: 'hidden',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${color}10 0%,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#E8F0FC', lineHeight: 1 }}>
          {countTo !== undefined ? <CountUp to={countTo} from={0} duration={1.4} delay={delay} /> : value}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Module card ──────────────────────────────────────────────────────────────
function ModuleCard({ moduleId, status, color, isNext, onClick }: {
  moduleId: string; status: 'completed' | 'available' | 'locked'; color: string; isNext?: boolean; onClick: () => void
}) {
  const isDone = status === 'completed'
  const isAvail = status === 'available'
  return (
    <motion.div
      whileHover={status !== 'locked' ? { scale: 1.02, y: -2 } : {}}
      whileTap={status !== 'locked' ? { scale: 0.97 } : {}}
      onClick={onClick}
      style={{
        padding: '11px 13px', borderRadius: 11,
        cursor: status !== 'locked' ? 'pointer' : 'default',
        background: isDone
          ? `${color}0a`
          : isNext
            ? `rgba(78,205,196,0.07)`
            : isAvail
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(255,255,255,0.015)',
        border: isDone
          ? `1px solid ${color}30`
          : isNext
            ? '1px solid rgba(78,205,196,0.3)'
            : isAvail
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(255,255,255,0.03)',
        opacity: status === 'locked' ? 0.35 : 1,
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isNext && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(78,205,196,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
      )}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
        {isDone
          ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={12} color={color} />
            </div>
          : isNext
            ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={9} color="#4ECDC4" style={{ marginLeft: 1 }} />
              </div>
            : isAvail
              ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Circle size={9} color="rgba(255,255,255,0.35)" />
                </div>
              : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={9} color="rgba(255,255,255,0.18)" />
                </div>
        }
      </div>
      <div style={{ minWidth: 0, flex: 1, position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#4A6285', letterSpacing: '0.08em', marginBottom: 2 }}>{moduleId.toUpperCase()}</p>
        <p style={{
          fontSize: 12, fontWeight: isNext ? 600 : 500,
          color: isDone ? color : isNext ? '#4ECDC4' : isAvail ? '#8EA8CC' : 'rgba(255,255,255,0.25)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {MODULE_TITLES[moduleId] ?? moduleId.toUpperCase()}
        </p>
      </div>
      {(isAvail || isNext) && <ChevronRight size={12} color={isNext ? 'rgba(78,205,196,0.5)' : 'rgba(255,255,255,0.2)'} style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} />}
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
        setProgress(data)
        // Auto-expand the part containing next module
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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 20 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(78,205,196,0.12)', borderTop: '2px solid #4ECDC4' }} />
        <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(78,205,196,0.45)', letterSpacing: '0.18em' }}>LOADING</p>
      </div>
    )
  }

  const completed = progress?.completedModules.length ?? 0
  const pct = progress?.overallPercentage ?? 0
  const nextModule = progress?.nextRecommendedModule ?? 'm01'
  const nextTitle = MODULE_TITLES[nextModule] ?? nextModule.toUpperCase()
  const nextPart = PARTS.find(p => p.modules.includes(nextModule))
  const streak = Math.floor(completed / 3) + 1
  const goalPct = Math.min(100, Math.round((todayDone / dailyGoal) * 100))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: '#E8F0FC', fontFamily: 'Inter,system-ui,sans-serif', padding: '0 0 100px' }}>

      {/* ── Hero: Continue Learning ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ padding: '28px 28px 24px', borderBottom: '1px solid rgba(78,205,196,0.07)', position: 'relative', overflow: 'hidden' }}
      >
        {/* ambient glows */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(155,111,208,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, left: '40%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(78,205,196,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* greeting row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color="#4ECDC4" />
              </div>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#4A6285', letterSpacing: '0.15em', marginBottom: 3 }}>WELCOME BACK</p>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em', color: '#E8F0FC' }}>
                  <BlurText text={studentName.split(' ')[0]} className="aurora-text" delay={70} direction="top" stepDuration={0.25} />
                </div>
                <p style={{ fontSize: 12, color: '#4A6285', marginTop: 2 }}>{completed} of 87 modules completed</p>
              </div>
            </div>

            {/* AI tutor badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(78,205,196,0.04)', border: '1px solid rgba(78,205,196,0.12)', borderRadius: 12, padding: '10px 16px' }}>
              <Brain size={15} color="rgba(78,205,196,0.7)" />
              <div>
                <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#4A6285', letterSpacing: '0.15em' }}>AI TUTOR</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#8EA8CC' }}>Alex is ready</p>
              </div>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#52D98B', boxShadow: '0 0 8px #52D98B' }} />
            </div>
          </div>

          {/* Continue Learning CTA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{
              background: 'linear-gradient(135deg, rgba(78,205,196,0.1) 0%, rgba(155,111,208,0.06) 100%)',
              border: '1px solid rgba(78,205,196,0.22)',
              borderRadius: 20, padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 16, position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: -30, right: 80, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(78,205,196,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Play size={20} color="#4ECDC4" style={{ marginLeft: 2 }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(78,205,196,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>
                  CONTINUE LEARNING · {nextPart ? `PART ${nextPart.number}` : ''}
                </p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#E8F0FC', margin: '0 0 2px', lineHeight: 1.2 }}>{nextTitle}</h2>
                <p style={{ fontSize: 12, color: '#4A6285', margin: 0 }}>{nextModule.toUpperCase()} · AI tutor ready to guide you</p>
              </div>
            </div>

            <Link href={`/course/${nextModule}`} style={{ textDecoration: 'none' }}>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(78,205,196,0.3)' }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '13px 26px', borderRadius: 13,
                  background: 'linear-gradient(135deg, #4ECDC4 0%, #52D98B 100%)',
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, color: '#050810',
                  boxShadow: '0 4px 20px rgba(78,205,196,0.2)',
                }}
              >
                Start Now <ArrowRight size={15} />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </motion.div>

      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Stats + Daily Goal row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 22 }}>
          <StatCard icon={BookOpen}   label="Modules done"  value={`${completed}`}  countTo={completed} color="#4ECDC4" delay={0.05} />
          <StatCard icon={TrendingUp} label="Avg quiz score" value={`${progress?.avgQuizScore ?? 0}%`} countTo={progress?.avgQuizScore ?? 0} color="#52D98B" delay={0.1} />
          <StatCard icon={Clock}      label="Est. hours"     value={`${Math.round(completed * 1.72)}h`} countTo={Math.round(completed * 1.72)} color="#E8B84B" delay={0.15} />
          <StatCard icon={Award}      label="Certificates"   value={String(progress?.certificates.length ?? 0)} countTo={progress?.certificates.length ?? 0} color="#9B6FD0" delay={0.2} />

          {/* Streak */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            whileHover={{ y: -3, scale: 1.02 }}
            style={{ background: 'linear-gradient(135deg, rgba(232,184,75,0.08) 0%, rgba(5,8,16,0.6) 100%)', border: '1px solid rgba(232,184,75,0.22)', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, backdropFilter: 'blur(12px)' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flame size={19} color="#E8B84B" />
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }}>Streak</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#E8F0FC', lineHeight: 1 }}>
                <CountUp to={streak} from={0} duration={1.4} delay={0.25} /> days
              </p>
            </div>
          </motion.div>

          {/* Daily goal */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ y: -3, scale: 1.02 }}
            style={{ background: 'linear-gradient(135deg, rgba(82,217,139,0.06) 0%, rgba(5,8,16,0.6) 100%)', border: '1px solid rgba(82,217,139,0.18)', borderRadius: 16, padding: '18px 20px', backdropFilter: 'blur(12px)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Target size={15} color="#52D98B" />
              <p style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Daily Goal</p>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#52D98B' }}>{todayDone}/{dailyGoal}</span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${goalPct}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                style={{ height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#52D98B,#4ECDC4)', boxShadow: '0 0 8px rgba(82,217,139,0.4)' }}
              />
            </div>
            <p style={{ fontSize: 11, color: '#4A6285', marginTop: 7 }}>
              {todayDone === 0 ? `Start today — ${dailyGoal} modules goal` : `${dailyGoal - todayDone} more to hit your goal`}
            </p>
          </motion.div>
        </div>

        {/* ── Overall progress bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(78,205,196,0.1)', borderRadius: 18, padding: '20px 24px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 22 }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ProgressRing pct={pct} color="#4ECDC4" size={80} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#4ECDC4' }}>{pct}%</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontWeight: 600, fontSize: 14, color: '#8EA8CC', margin: 0 }}>Overall course progress</h2>
              <span style={{ fontSize: 12, color: '#4A6285', fontFamily: 'monospace' }}>{completed}/87 modules</span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 1.3, ease: 'easeOut', delay: 0.4 }}
                style={{ height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#4ECDC4,#9B6FD0)', boxShadow: '0 0 10px rgba(78,205,196,0.3)' }}
              />
            </div>
            <p style={{ fontSize: 11, color: '#4A6285', marginTop: 7 }}>{87 - completed} modules remaining to complete the full qualification</p>
          </div>
        </motion.div>

        {/* ── Part accordion ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PARTS.map((part, pi) => {
            const doneInPart = part.modules.filter(m => progress?.completedModules.includes(m)).length
            const partPct = Math.round(doneInPart / part.modules.length * 100)
            const isExpanded = expandedParts.has(part.number)
            const partLocked = !isPartUnlocked(part.number)
            const hasNextModule = part.modules.includes(nextModule)

            return (
              <motion.div key={part.number}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + pi * 0.03 }}
                style={{
                  background: hasNextModule ? `rgba(78,205,196,0.02)` : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${partLocked ? 'rgba(255,255,255,0.05)' : hasNextModule ? 'rgba(78,205,196,0.18)' : part.color + '18'}`,
                  borderRadius: 16, overflow: 'hidden',
                  opacity: partLocked ? 0.5 : 1,
                }}
              >
                {/* Part header */}
                <button
                  onClick={() => !partLocked && togglePart(part.number)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: partLocked ? 'default' : 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: partLocked ? 'rgba(255,255,255,0.04)' : `${part.color}15`, border: `1px solid ${partLocked ? 'rgba(255,255,255,0.1)' : part.color + '35'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: partLocked ? '#4A6285' : part.color, fontFamily: 'monospace' }}>
                    {partLocked ? <Lock size={13} /> : part.number}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 9, fontFamily: 'monospace', color: partLocked ? '#4A6285' : `${part.color}80`, letterSpacing: '0.12em', margin: 0 }}>PART {part.number}</p>
                      {partLocked
                        ? <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(232,123,111,0.5)', letterSpacing: '0.1em' }}>LOCKED</span>
                        : <span style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace' }}>{doneInPart}/{part.modules.length}</span>
                      }
                      {hasNextModule && <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(78,205,196,0.7)', letterSpacing: '0.1em', background: 'rgba(78,205,196,0.1)', padding: '1px 6px', borderRadius: 4 }}>ACTIVE</span>}
                    </div>
                    <p style={{ fontWeight: 600, fontSize: 14, color: partLocked ? '#4A6285' : '#E8F0FC', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{part.title}</p>
                  </div>
                  {!partLocked && (
                    <div style={{ width: 72, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.05)', flexShrink: 0, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${partPct}%` }}
                        transition={{ duration: 0.9, delay: 0.5 + pi * 0.03 }}
                        style={{ height: '100%', borderRadius: 3, background: part.color, boxShadow: `0 0 5px ${part.color}` }}
                      />
                    </div>
                  )}
                  <div style={{ color: '#4A6285', flexShrink: 0 }}>
                    {partLocked ? <Lock size={13} color="#4A6285" /> : isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {/* Module grid */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 7, padding: '4px 14px 14px' }}>
                        {part.modules.map(moduleId => (
                          <ModuleCard
                            key={moduleId}
                            moduleId={moduleId}
                            status={getModuleStatus(moduleId)}
                            color={part.color}
                            isNext={moduleId === nextModule}
                            onClick={() => getModuleStatus(moduleId) !== 'locked' && router.push(`/course/${moduleId}`)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* ── Certificate ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ marginTop: 20, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 18, padding: '20px 22px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Award size={18} color="#E8B84B" />
            <h2 style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#E8F0FC' }}>Certificate</h2>
          </div>

          {progress?.certificates && progress.certificates.length > 0 ? (
            progress.certificates.map(cert => (
              <motion.div key={cert.id} whileHover={{ scale: 1.01 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.22)', borderRadius: 12, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#E8B84B', fontSize: 14, margin: 0 }}>UK Bookkeeping, Accounting & Taxation</p>
                  <p style={{ fontSize: 11, color: 'rgba(232,184,75,0.55)', marginTop: 3 }}>Score: {cert.final_score}% · Issued {new Date(cert.completion_date).toLocaleDateString('en-GB')}</p>
                </div>
                <Link href={`/verify/${cert.verification_code}`} style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '9px 18px', background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 9, color: '#E8B84B', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    View Certificate
                  </motion.button>
                </Link>
              </motion.div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <AlertCircle size={16} color="#4A6285" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 600, color: '#8EA8CC', fontSize: 13, margin: '0 0 4px' }}>Certificate not yet earned</p>
                <p style={{ fontSize: 12, color: '#4A6285', lineHeight: 1.6, margin: 0 }}>
                  Complete all 87 modules and pass the final exam with 70%+ to receive your verifiable certificate.{' '}
                  <span style={{ color: 'rgba(78,205,196,0.7)' }}>{completed}/87 modules complete.</span>
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
