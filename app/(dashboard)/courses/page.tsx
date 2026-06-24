'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import {
  BookOpen, CheckCircle2, Circle, Lock, ChevronRight,
  ChevronDown, ChevronUp, Play, BookMarked
} from 'lucide-react'

// --- Duplicated minimal data (ideally should be moved to a shared lib/constants.ts later)
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
  nextRecommendedModule: string
}

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

export default function CoursesPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]))
  const [hoveredModule, setHoveredModule] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const res = await fetch('/api/progress')
      if (res.ok) {
        const data = await res.json() as ProgressData
        setProgress(data)
        if (data.nextRecommendedModule) {
          const part = PARTS.find(p => p.modules.includes(data.nextRecommendedModule))
          // Automatically expand all parts up to the current unlocked part
          if (part) {
            const exp = new Set<number>()
            for (let i = 1; i <= part.number; i++) exp.add(i)
            setExpandedParts(exp)
          }
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

  const nextModule = progress?.nextRecommendedModule ?? 'm01'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--ac-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '40px 28px', maxWidth: 1400, margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>

        <div>
          <h1 style={{ fontWeight: 800, margin: '0 0 4px' }} className="text-2xl">My Courses</h1>
          <p style={{ color: 'var(--text-tertiary)', margin: 0 }} className="text-small">Browse the full 87-module curriculum</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PARTS.map((part, pi) => {
          const doneInPart  = part.modules.filter(m => progress?.completedModules.includes(m)).length
          const partPct     = Math.round(doneInPart / part.modules.length * 100)
          const isExpanded  = expandedParts.has(part.number)
          const partLocked  = !isPartUnlocked(part.number)
          const hasNextMod  = part.modules.includes(nextModule)
          const partDone    = doneInPart === part.modules.length

          return (
            <motion.div key={part.number}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + pi * 0.05 }}
              style={{
                background: hasNextMod ? 'var(--bg-elevated)' : partDone ? `${part.color}08` : 'var(--card-bg)',
                border: `1px solid ${partLocked ? 'var(--border-subtle)' : hasNextMod ? 'var(--border-medium)' : partDone ? `${part.color}25` : `${part.color}20`}`,
                borderRadius: 16, overflow: 'hidden',
                opacity: partLocked ? 0.5 : 1,
                transition: 'all 0.2s',
              }}>
              <button
                onClick={() => !partLocked && togglePart(part.number)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'none', border: 'none', cursor: partLocked ? 'default' : 'pointer', textAlign: 'left' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: partLocked ? 'var(--bg-elevated)' : `${part.color}18`, border: `1px solid ${partLocked ? 'var(--border-subtle)' : part.color + '40'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, color: partLocked ? 'var(--text-tertiary)' : part.color, fontFamily: 'monospace' }} className="text-small">
                  {partLocked ? <Lock size={14} /> : partDone ? <CheckCircle2 size={16} color={part.color} /> : part.number}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ display: 'block', fontFamily: 'monospace', color: partLocked ? 'var(--text-tertiary)' : `${part.color}90`, letterSpacing: '0.12em', margin: 0 }} className="text-micro">PART {part.number}</span>
                    {partLocked
                      ? <span style={{ fontFamily: 'monospace', color: 'rgba(232,123,111,0.6)', letterSpacing: '0.1em' }} className="text-micro">LOCKED</span>
                      : <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }} className="text-tiny">{doneInPart}/{part.modules.length}</span>
                    }
                    {hasNextMod && <span style={{ fontFamily: 'monospace', color: 'var(--ac-cyan)', letterSpacing: '0.1em', background: 'rgba(78,205,196,0.12)', padding: '2px 8px', borderRadius: 6 }} className="text-micro">ACTIVE</span>}
                    {partDone && !partLocked && <span style={{ fontFamily: 'monospace', color: `${part.color}`, letterSpacing: '0.1em', background: `${part.color}15`, padding: '2px 8px', borderRadius: 6 }} className="text-micro">COMPLETE</span>}
                  </div>
                  <span style={{ display: 'block', fontWeight: 600, color: partLocked ? 'var(--text-tertiary)' : 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-base">{part.title}</span>
                </div>
                {!partLocked && (
                  <div style={{ width: 100, height: 4, borderRadius: 4, background: 'var(--bg-elevated)', flexShrink: 0, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${partPct}%` }}
                      transition={{ duration: 0.9, delay: 0.2 + pi * 0.05 }}
                      style={{ height: '100%', borderRadius: 4, background: part.color, boxShadow: `0 0 8px ${part.color}60` }} />
                  </div>
                )}
                <div style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 16 }}>
                  {partLocked ? <Lock size={15} color="var(--text-tertiary)" /> : isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                    style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, padding: '4px 20px 20px' }}>
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
  )
}
