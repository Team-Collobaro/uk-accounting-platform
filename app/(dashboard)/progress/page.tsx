'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import {
  TrendingUp, CheckCircle2, Brain, Flame, Target,
  Zap, AlertTriangle, BookOpen, Clock
} from 'lucide-react'

// Basic duplicated constants
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
  weakTopics: string[]
  quizResults: Array<{ id: string; module_id: string; score: number; percentage: number; passed: boolean; completed_at: string }>
}

function ProgressRing({ pct, color, size = 120 }: { pct: number; color: string; size?: number }) {
  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
      />
    </svg>
  )
}

export default function ProgressPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const res = await fetch('/api/progress')
      if (res.ok) {
        setProgress(await res.json() as ProgressData)
      }
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--ac-mint)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const completedCount = progress?.completedModules.length ?? 0
  const totalCount = 87
  const percentage = progress?.overallPercentage ?? 0
  const avgScore = progress?.avgQuizScore ?? 0

  return (
    <div style={{ minHeight: '100vh', padding: '40px 28px', maxWidth: 1400, margin: '0 auto', color: 'var(--text-primary)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>

        <div>
          <h1 style={{ fontWeight: 800, margin: '0 0 4px' }} className="text-2xl">Progress & Analytics</h1>
          <p style={{ color: 'var(--text-tertiary)', margin: 0 }} className="text-small">Track your performance across the curriculum</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 30 }}>
        
        {/* Overall Completion */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '24px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative' }}>
            <ProgressRing pct={percentage} color="var(--ac-cyan)" size={100} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--ac-cyan)' }} className="text-xl">{percentage}%</span>
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }} className="text-tiny">OVERALL COMPLETION</p>
            <h2 style={{ fontWeight: 800, margin: '0 0 6px' }} className="text-3xl">{completedCount} <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }} className="text-base">/ {totalCount}</span></h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }} className="text-small">modules completed</p>
          </div>
        </motion.div>

        {/* Avg Quiz Score */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '24px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative' }}>
            <ProgressRing pct={avgScore} color="var(--ac-mint)" size={100} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--ac-mint)' }} className="text-xl">{Math.round(avgScore)}%</span>
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }} className="text-tiny">AVG QUIZ SCORE</p>
            <h2 style={{ fontWeight: 800, margin: '0 0 6px', color: 'var(--ac-mint)' }} className="text-3xl">{Math.round(avgScore)}%</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }} className="text-small">across all taken quizzes</p>
          </div>
        </motion.div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        
        {/* Weak Topics / Focus Areas */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Target size={18} color="var(--ac-rose)" />
            <h2 style={{ fontWeight: 700, margin: 0 }} className="text-base">Focus Areas</h2>
          </div>
          
          {progress?.weakTopics && progress.weakTopics.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {progress.weakTopics.map((topic, i) => (
                <div key={i} style={{ padding: '12px 16px', background: 'rgba(232,80,122,0.08)', border: '1px solid rgba(232,80,122,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AlertTriangle size={14} color="var(--ac-rose)" />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }} className="text-small">{topic}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <CheckCircle2 size={30} color="var(--ac-mint)" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ margin: 0 }} className="text-small">No weak areas identified yet. Great job!</p>
            </div>
          )}
        </motion.div>

        {/* Recent Quiz Results */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Zap size={18} color="var(--ac-gold)" />
            <h2 style={{ fontWeight: 700, margin: 0 }} className="text-base">Recent Quizzes</h2>
          </div>

          {progress?.quizResults && progress.quizResults.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {progress.quizResults.slice(0, 5).map(quiz => {
                const isPass = quiz.passed
                const color = isPass ? 'var(--ac-mint)' : 'var(--ac-rose)'
                return (
                  <div key={quiz.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                      <div>
                        <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', marginBottom: 2 }} className="text-tiny">{quiz.module_id.toUpperCase()}</p>
                        <p style={{ fontWeight: 600, margin: 0 }} className="text-small">{MODULE_TITLES[quiz.module_id] ?? 'Module Quiz'}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 800, color: color, margin: '0 0 2px' }} className="text-base">{quiz.percentage}%</p>
                      <p style={{ color: 'var(--text-tertiary)' }} className="text-micro">{new Date(quiz.completed_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Brain size={30} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ margin: 0 }} className="text-small">You haven't taken any quizzes yet.</p>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  )
}
