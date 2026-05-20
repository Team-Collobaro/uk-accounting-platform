'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import {
  BookOpen, Award, TrendingUp, Clock,
  CheckCircle2, Circle, Lock, ChevronRight,
  AlertCircle, Brain, Sparkles, Zap, ChevronDown, ChevronUp,
} from 'lucide-react'

function mods(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => `m${String(i + from).padStart(2, '0')}`)
}

const PARTS = [
  { number: 1,  title: 'Foundations',             modules: mods(1,  7),  color: '#00ffff' },
  { number: 2,  title: 'Cloud Software Platforms', modules: mods(8,  12), color: '#a855f7' },
  { number: 3,  title: 'VAT',                      modules: mods(13, 20), color: '#f59e0b' },
  { number: 4,  title: 'Payroll PAYE & CIS',        modules: mods(21, 26), color: '#22c55e' },
  { number: 5,  title: 'Year-End Accounts',         modules: mods(27, 34), color: '#f43f5e' },
  { number: 6,  title: 'Corporation Tax',           modules: mods(35, 40), color: '#3b82f6' },
  { number: 7,  title: 'Self Assessment',           modules: mods(41, 48), color: '#ec4899' },
  { number: 8,  title: 'Incorporation',             modules: mods(49, 57), color: '#06b6d4' },
  { number: 9,  title: 'Cessation',                 modules: mods(58, 66), color: '#84cc16' },
  { number: 10, title: 'Structure Changes',         modules: mods(67, 74), color: '#f97316' },
  { number: 11, title: 'Specialist Tax',            modules: mods(75, 82), color: '#8b5cf6' },
  { number: 12, title: 'Practice & Ethics',         modules: mods(83, 87), color: '#14b8a6' },
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

// ─── Animated neon progress ring ─────────────────────────────────────────────
function ProgressRing({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, delay }: { icon: React.ElementType; label: string; value: string; color: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileHover={{ y: -4, boxShadow: `0 16px 48px ${color}1a` }}
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}28`, borderRadius: 18, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${color}12 0%,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ width: 46, height: 46, borderRadius: 14, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.06em', marginBottom: 4 }}>{label.toUpperCase()}</p>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</p>
      </div>
    </motion.div>
  )
}

// ─── Module card ──────────────────────────────────────────────────────────────
function ModuleCard({ moduleId, status, color, onClick }: { moduleId: string; status: 'completed' | 'available' | 'locked'; color: string; onClick: () => void }) {
  const isDone = status === 'completed'
  const isAvail = status === 'available'
  return (
    <motion.div
      whileHover={status !== 'locked' ? { scale: 1.02, y: -2 } : {}}
      whileTap={status !== 'locked' ? { scale: 0.98 } : {}}
      onClick={onClick}
      style={{
        padding: '12px 14px', borderRadius: 12, cursor: status !== 'locked' ? 'pointer' : 'default',
        background: isDone ? `${color}0c` : isAvail ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: isDone ? `1px solid ${color}35` : isAvail ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.04)',
        opacity: status === 'locked' ? 0.4 : 1,
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        {isDone
          ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}20`, border: `1px solid ${color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={12} color={color} /></div>
          : isAvail
            ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Circle size={10} color="rgba(255,255,255,0.4)" /></div>
            : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={10} color="rgba(255,255,255,0.2)" /></div>
        }
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', marginBottom: 2 }}>{moduleId.toUpperCase()}</p>
        <p style={{ fontSize: 12, fontWeight: 500, color: isDone ? color : isAvail ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {MODULE_TITLES[moduleId] ?? moduleId.toUpperCase()}
        </p>
      </div>
      {isAvail && <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />}
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
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [studentRes, progressRes] = await Promise.all([
        supabase.from('students').select('name').eq('id', user.id).single(),
        fetch('/api/progress'),
      ])
      if (studentRes.data) setStudentName(studentRes.data.name)
      if (progressRes.ok) setProgress(await progressRes.json() as ProgressData)
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
    if (!progress) return 'locked'
    if (progress.completedModules.includes(moduleId)) return 'completed'
    // Check if the part containing this module is unlocked
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
          style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(0,255,255,0.15)', borderTop: '2px solid #00ffff' }} />
        <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(0,255,255,0.5)', letterSpacing: '0.15em' }}>LOADING DASHBOARD</p>
      </div>
    )
  }

  const completed = progress?.completedModules.length ?? 0
  const pct = progress?.overallPercentage ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#060a12', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', padding: '0 0 80px' }}>

      {/* ── Header banner ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ padding: '32px 32px 24px', borderBottom: '1px solid rgba(0,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,255,255,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(0,255,255,0.12)', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color="#00ffff" />
              </div>
              <div>
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(0,255,255,0.5)', letterSpacing: '0.15em' }}>WELCOME BACK</p>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
                  {studentName.split(' ')[0]} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontSize: 16 }}>/ {completed} of 87 modules</span>
                </h1>
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,255,255,0.05)', border: '1px solid rgba(0,255,255,0.12)', borderRadius: 12, padding: '10px 16px' }}>
            <Brain size={16} color="rgba(0,255,255,0.6)" />
            <div>
              <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(0,255,255,0.45)', letterSpacing: '0.15em' }}>AI TUTOR</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Alex is ready</p>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          </motion.div>
        </div>
      </motion.div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard icon={BookOpen}   label="Modules done"  value={`${completed}/87`} color="#00ffff" delay={0.1} />
          <StatCard icon={TrendingUp} label="Avg quiz score" value={`${progress?.avgQuizScore ?? 0}%`} color="#22c55e" delay={0.15} />
          <StatCard icon={Clock}      label="Est. hours"     value={`${Math.round(completed * 1.72)}h`} color="#f59e0b" delay={0.2} />
          <StatCard icon={Award}      label="Certificates"   value={String(progress?.certificates.length ?? 0)} color="#a855f7" delay={0.25} />
        </div>

        {/* ── Progress bar + ring ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: 20, padding: '24px 28px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ProgressRing pct={pct} color="#00ffff" size={88} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#00ffff' }}>{pct}%</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Overall course progress</h2>
              {progress?.nextRecommendedModule && (
                <Link href={`/course/${progress.nextRecommendedModule}`} style={{ textDecoration: 'none' }}>
                  <motion.div whileHover={{ scale: 1.03 }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.25)', borderRadius: 8, padding: '5px 12px' }}>
                    <Zap size={12} color="#00ffff" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#00ffff', fontFamily: 'monospace' }}>
                      NEXT: {progress.nextRecommendedModule.toUpperCase()}
                    </span>
                  </motion.div>
                </Link>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
                style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,#00ffff,#a855f7)', boxShadow: '0 0 12px rgba(0,255,255,0.4)' }}
              />
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>{completed} of 87 modules · {87 - completed} remaining</p>
          </div>
        </motion.div>

        {/* ── Part sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PARTS.map((part, pi) => {
            const doneInPart = part.modules.filter(m => progress?.completedModules.includes(m)).length
            const partPct = Math.round(doneInPart / part.modules.length * 100)
            const isExpanded = expandedParts.has(part.number)
            const partLocked = !isPartUnlocked(part.number)
            return (
              <motion.div key={part.number}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + pi * 0.04 }}
                style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${partLocked ? 'rgba(255,255,255,0.06)' : part.color + '22'}`, borderRadius: 18, overflow: 'hidden', opacity: partLocked ? 0.6 : 1 }}>

                {/* Part header */}
                <button onClick={() => !partLocked && togglePart(part.number)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  background: 'none', border: 'none', cursor: partLocked ? 'default' : 'pointer', textAlign: 'left',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: partLocked ? 'rgba(255,255,255,0.05)' : `${part.color}18`, border: `1px solid ${partLocked ? 'rgba(255,255,255,0.12)' : part.color + '40'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: partLocked ? 'rgba(255,255,255,0.3)' : part.color, fontFamily: 'monospace' }}>
                    {partLocked ? <Lock size={14} /> : part.number}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <p style={{ fontSize: 9, fontFamily: 'monospace', color: partLocked ? 'rgba(255,255,255,0.2)' : `${part.color}99`, letterSpacing: '0.15em', margin: 0 }}>PART {part.number}</p>
                      {partLocked
                        ? <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,100,100,0.6)', letterSpacing: '0.1em' }}>LOCKED</span>
                        : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{doneInPart}/{part.modules.length}</span>
                      }
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: partLocked ? 'rgba(255,255,255,0.4)' : '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{part.title}</p>
                  </div>
                  {/* mini progress bar */}
                  {!partLocked && (
                    <div style={{ width: 80, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', flexShrink: 0, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${partPct}%` }}
                        transition={{ duration: 1, delay: 0.5 + pi * 0.04 }}
                        style={{ height: '100%', borderRadius: 4, background: part.color, boxShadow: `0 0 6px ${part.color}` }}
                      />
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                    {partLocked ? <Lock size={14} color="rgba(255,255,255,0.2)" /> : isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Module grid */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8, padding: '4px 16px 16px' }}>
                        {part.modules.map(moduleId => (
                          <ModuleCard
                            key={moduleId}
                            moduleId={moduleId}
                            status={getModuleStatus(moduleId)}
                            color={part.color}
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          style={{ marginTop: 24, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Award size={20} color="#f59e0b" />
            <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0, color: '#fff' }}>Your Certificate</h2>
          </div>
          {progress?.certificates && progress.certificates.length > 0 ? (
            progress.certificates.map(cert => (
              <motion.div key={cert.id} whileHover={{ scale: 1.01 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#f59e0b', fontSize: 15, margin: 0 }}>UK Bookkeeping, Accounting & Taxation</p>
                  <p style={{ fontSize: 12, color: 'rgba(245,158,11,0.6)', marginTop: 4 }}>Score: {cert.final_score}% · Issued {new Date(cert.completion_date).toLocaleDateString('en-GB')}</p>
                </div>
                <Link href={`/verify/${cert.verification_code}`} style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '10px 20px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: 10, color: '#f59e0b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    View Certificate
                  </motion.button>
                </Link>
              </motion.div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
              <AlertCircle size={18} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)', fontSize: 14, margin: '0 0 6px' }}>Certificate not yet earned</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, margin: 0 }}>
                  Complete all 87 modules and pass the final exam with 70%+ to receive your verifiable certificate.{' '}
                  <span style={{ color: 'rgba(0,255,255,0.6)' }}>{completed}/87 modules complete.</span>
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
