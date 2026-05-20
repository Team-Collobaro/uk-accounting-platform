'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientComponentClient } from '@/lib/supabase'
import {
  BookOpen, Award, TrendingUp, Clock,
  CheckCircle2, Circle, Lock, ChevronRight,
  AlertCircle
} from 'lucide-react'

// ── Module metadata (87 modules across 12 parts) ─────────────────────────────

function mods(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => `m${String(i + from).padStart(2, '0')}`)
}

const PARTS = [
  { number: 1,  title: 'Foundations',             modules: mods(1,  7)  },
  { number: 2,  title: 'Cloud Software Platforms', modules: mods(8,  12) },
  { number: 3,  title: 'VAT',                      modules: mods(13, 20) },
  { number: 4,  title: 'Payroll PAYE & CIS',       modules: mods(21, 26) },
  { number: 5,  title: 'Year-End Accounts',        modules: mods(27, 34) },
  { number: 6,  title: 'Corporation Tax',          modules: mods(35, 40) },
  { number: 7,  title: 'Self Assessment',          modules: mods(41, 48) },
  { number: 8,  title: 'Incorporation',            modules: mods(49, 57) },
  { number: 9,  title: 'Cessation',                modules: mods(58, 66) },
  { number: 10, title: 'Structure Changes',        modules: mods(67, 74) },
  { number: 11, title: 'Specialist Tax',           modules: mods(75, 82) },
  { number: 12, title: 'Practice & Ethics',        modules: mods(83, 87) },
]

const MODULE_TITLES: Record<string, string> = {
  m01: 'UK Compliance Landscape',       m02: 'UK Business Structures',
  m03: 'Double-Entry Bookkeeping',      m04: 'Chart of Accounts',
  m05: 'Bookkeeping Cycle',             m06: 'Source Documents',
  m07: 'Cash vs Accruals Basis',        m08: 'Dext',
  m09: 'Xero',                          m10: 'QuickBooks Online',
  m11: 'Sage Business Cloud',           m12: 'FreeAgent',
  m13: 'VAT Fundamentals',             m14: 'VAT Schemes',
  m15: 'VAT on Goods',                  m16: 'VAT on Services',
  m17: 'VAT on Land & Property',        m18: 'Partial Exemption',
  m19: 'VAT Errors & Penalties',        m20: 'Making Tax Digital (VAT)',
  m21: 'PAYE Fundamentals',            m22: 'Statutory Payments',
  m23: 'Auto-Enrolment Pensions',       m24: 'Benefits in Kind & P11D',
  m25: 'Year-End Payroll',              m26: 'CIS',
  m27: 'Year-End Process',              m28: 'Adjusting Journals',
  m29: 'FRS 105 Micro-Entity',          m30: 'FRS 102 Section 1A',
  m31: 'FRS 102 Full',                  m32: 'Disclosure Reasoning',
  m33: 'iXBRL Tagging',                 m34: 'Companies House Filing',
  m35: 'Corporation Tax Fundamentals', m36: 'Adjusting to Taxable Profit',
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
  m61: 'Members\' Voluntary Liquidation',m62: 'Creditors\' Voluntary Liquidation',
  m63: 'Compulsory Liquidation',        m64: 'Administration & CVA',
  m65: 'Final Accounts on Cessation',   m66: 'Capital Distributions & BADR',
  m67: 'Ltd → Sole Trader',            m68: 'Sole Trader → Partnership',
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

// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'completed' | 'available' | 'locked' }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 size={11} /> Done
    </span>
  )
  if (status === 'available') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
      <Circle size={11} /> Start
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
      <Lock size={11} /> Locked
    </span>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [studentName, setStudentName] = useState('Student')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

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
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  function getModuleStatus(moduleId: string, index: number): 'completed' | 'available' | 'locked' {
    if (!progress) return 'locked'
    if (progress.completedModules.includes(moduleId)) return 'completed'
    // Available if previous completed or it's the first
    if (index === 0) return 'available'
    const allModules = PARTS.flatMap(p => p.modules)
    const pos = allModules.indexOf(moduleId)
    if (pos === 0) return 'available'
    const prevId = allModules[pos - 1]
    return progress.completedModules.includes(prevId) ? 'available' : 'locked'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome back, {studentName.split(' ')[0]}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {progress?.completedModules.length ?? 0} of 87 modules completed
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BookOpen,   label: 'Modules done', value: `${progress?.completedModules.length ?? 0}/87`, color: 'text-brand-600', bg: 'bg-brand-50' },
          { icon: TrendingUp, label: 'Avg quiz score', value: `${progress?.avgQuizScore ?? 0}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: Clock,      label: 'Est. hours', value: `${Math.round((progress?.completedModules.length ?? 0) * 1.72)}h`, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: Award,      label: 'Certificates', value: String(progress?.certificates.length ?? 0), color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Overall course progress</h2>
          <span className="text-sm font-semibold text-brand-600">{progress?.overallPercentage ?? 0}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-brand-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress?.overallPercentage ?? 0}%` }}
          />
        </div>
        {progress?.nextRecommendedModule && (
          <p className="text-sm text-slate-500 mt-3">
            Next up: <Link href={`/course/${progress.nextRecommendedModule}`} className="text-brand-600 font-medium hover:underline">
              {progress.nextRecommendedModule.toUpperCase()}
            </Link>
          </p>
        )}
      </div>

      {/* 12 Part sections */}
      <div className="space-y-6">
        {PARTS.map((part) => {
          const doneInPart = part.modules.filter(m => progress?.completedModules.includes(m)).length
          return (
            <div key={part.number} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Part {part.number}</span>
                  <h3 className="font-semibold text-slate-800 mt-0.5">{part.title}</h3>
                </div>
                <span className="text-sm text-slate-500">{doneInPart}/{part.modules.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-slate-100">
                {part.modules.map((moduleId, idx) => {
                  const status = getModuleStatus(moduleId, idx)
                  const canClick = status !== 'locked'
                  return (
                    <div key={moduleId}
                      className={`bg-white p-4 flex items-center justify-between gap-2 ${canClick ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60'} transition-colors`}
                      onClick={() => canClick && router.push(`/course/${moduleId}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-slate-400 uppercase">{moduleId}</p>
                        <p className="text-sm font-medium text-slate-700 truncate">{MODULE_TITLES[moduleId] ?? moduleId.toUpperCase()}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <StatusBadge status={status} />
                        {canClick && <ChevronRight size={14} className="text-slate-400" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Certificate section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Award size={20} className="text-amber-500" /> Your Certificate
        </h2>
        {progress?.certificates && progress.certificates.length > 0 ? (
          progress.certificates.map((cert) => (
            <div key={cert.id} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div>
                <p className="font-semibold text-amber-800">UK Bookkeeping, Accounting & Taxation</p>
                <p className="text-sm text-amber-600 mt-0.5">
                  Score: {cert.final_score}% · Issued {new Date(cert.completion_date).toLocaleDateString('en-GB')}
                </p>
              </div>
              <Link
                href={`/verify/${cert.verification_code}`}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
              >
                View
              </Link>
            </div>
          ))
        ) : (
          <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            <AlertCircle size={18} className="text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Certificate not yet earned</p>
              <p className="text-slate-500 mt-0.5">
                Complete all 87 modules and pass the final exam with 70% or above to receive your certificate.
                ({progress?.completedModules.length ?? 0}/87 modules complete)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
