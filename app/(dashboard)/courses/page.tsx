'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

function mods(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => `m${String(i + from).padStart(2, '0')}`)
}

const PARTS = [
  { number: 1,  title: 'Foundations',             modules: mods(1,  7)  },
  { number: 2,  title: 'Cloud Software Platforms', modules: mods(8,  12) },
  { number: 3,  title: 'VAT',                      modules: mods(13, 20) },
  { number: 4,  title: 'Payroll, PAYE & CIS',      modules: mods(21, 26) },
  { number: 5,  title: 'Year-End Accounts',         modules: mods(27, 34) },
  { number: 6,  title: 'Corporation Tax',           modules: mods(35, 40) },
  { number: 7,  title: 'Self Assessment',           modules: mods(41, 48) },
  { number: 8,  title: 'Incorporation',             modules: mods(49, 57) },
  { number: 9,  title: 'Cessation',                 modules: mods(58, 66) },
  { number: 10, title: 'Structure Changes',         modules: mods(67, 74) },
  { number: 11, title: 'Specialist Tax',            modules: mods(75, 82) },
  { number: 12, title: 'Practice & Ethics',         modules: mods(83, 87) },
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
  m61: "Members' Voluntary Liquidation", m62: "Creditors' Voluntary Liquidation",
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

export default function CoursesPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '0 0 80px', fontFamily: '"Charter", "Georgia", serif' }}>

      {/* ── Part header banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-dark) 0%, #0f172a 100%)',
        color: '#fff',
        padding: '48px 64px',
        borderLeft: '6px solid var(--accent)',
        position: 'relative',
      }}>
        <div style={{
          display: 'inline-block', background: 'var(--accent)', color: '#fff',
          padding: '4px 14px', fontSize: 11, letterSpacing: '0.22em',
          textTransform: 'uppercase', fontFamily: '"Inter", sans-serif', fontWeight: 700,
          marginBottom: 14, borderRadius: 2,
        }}>
          ACCA / ACA Grade
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          UK Bookkeeping, Accounting<br />&amp; Taxation
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 17, color: '#94a3b8', fontStyle: 'italic', maxWidth: 660, lineHeight: 1.6 }}>
          A 150-hour, ACCA/ACA-grade master course covering every UK business scenario —
          from incorporation through cessation, with full FRS 102/105 disclosure reasoning.
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { num: '87', label: 'Modules' },
            { num: '12', label: 'Parts' },
            { num: '870+', label: 'MCQs' },
            { num: '150', label: 'Hours' },
          ].map(({ num, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '12px 20px', textAlign: 'center', minWidth: 88,
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#64748b', marginTop: 4, fontFamily: '"Inter", sans-serif' }}>{label}</div>
            </div>
          ))}
        </div>

        <button
          id="begin-course-btn"
          onClick={() => router.push('/course/m01')}
          style={{
            display: 'inline-block', marginTop: 28,
            background: 'var(--accent)', color: '#fff',
            border: 'none', padding: '13px 32px', borderRadius: 4,
            fontSize: 15, fontFamily: '"Inter", sans-serif', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.02em', transition: '0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#991b1b'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--accent)'}
        >
          Begin with Module 1 →
        </button>
      </div>

      {/* ── Master Table of Contents ── */}
      <div style={{ padding: '40px 64px 0' }}>
        <div className="master-toc">
          <h2 style={{ margin: '0 0 24px', fontSize: 22, color: 'var(--accent-2)', borderBottom: '2px solid var(--line-soft)', paddingBottom: 14 }}>
            Full Curriculum
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 48px' }}>
            {PARTS.map(part => (
              <div key={part.number} style={{ breakInside: 'avoid', marginBottom: 20 }}>
                <div className="toc-part-label">
                  Part {part.number} — {part.title}
                </div>
                <ul style={{ listStyle: 'none', padding: '0 0 0 12px', margin: 0 }}>
                  {part.modules.map(mod => (
                    <li key={mod} style={{ padding: '2px 0', fontSize: 13 }}>
                      <Link
                        href={`/course/${mod}`}
                        style={{ color: 'var(--ink)', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--ink)'}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', fontFamily: '"Inter", sans-serif', letterSpacing: '0.04em', marginRight: 6 }}>
                          {mod.toUpperCase()}
                        </span>
                        {MODULE_TITLES[mod]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* How this course works */}
        <div style={{
          background: 'var(--bg-dark)', color: '#e8e4d6',
          padding: '28px 36px', borderRadius: 6, marginBottom: 40,
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 18, color: '#fff', fontFamily: '"Charter", serif', borderBottom: '2px solid var(--accent)', paddingBottom: 8 }}>
            How this course works
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {[
              { label: 'Work through Parts in order', desc: 'Each Part builds on the last — start at Part 1 unless you are revisiting a topic.' },
              { label: 'Read each Module section', desc: 'Every module contains 4–8 sections of in-depth explanatory text with worked examples.' },
              { label: 'Complete the Knowledge Check', desc: 'Each module ends with 10 MCQs. Score 70%+ to unlock the next module.' },
              { label: 'Ask Alex for help', desc: 'The AI tutor is available in every section — ask a question or request an example.' },
            ].map(({ label, desc }) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
