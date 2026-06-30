import React from 'react'
import Link from 'next/link'
import { PARTS, MODULE_TITLES } from '@/lib/courseData'

export default function FrontMatterPage() {
  return (
    <div id="lesson-screen" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      
      {/* Top Bar */}
      <div id="lesson-topbar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', borderBottom: '1px solid var(--line-soft)',
        background: 'var(--bg-alt)', zIndex: 10, flexShrink: 0
      }}>
        <div className="topbar-breadcrumb" id="topbar-breadcrumb">
          <span style={{ color: '#94a3b8' }}>Course Info &rsaquo; </span>
          <strong>Front Matter</strong>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
          
          <div id="lesson-body" style={{ flex: 1, padding: '40px 60px 80px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
            
            <section id="welcome">
              <h1 className="book-title">UK Bookkeeping, Accounting<br />&amp; <em>Taxation</em> — Master Course</h1>
              <div className="book-sub">A 150-hour, ACCA/ACA-grade programme covering every UK compliance scenario from
                incorporation through cessation, with full FRS 102/105 disclosure reasoning, end-of-section MCQ assessments,
                and step-by-step software walkthroughs.</div>

              <div className="callout info">
                <span className="label">How to use this course</span>
                <p>This is a single, self-contained reference text. Each <strong>Module</strong> follows the same pattern: (1)
                  <em>Learning objectives</em> &mdash; what you will be able to do after the module; (2) <em>Technical
                    content</em> with worked numerical examples, journal entries, legislation references and FRS citations;
                  (3) <em>Module summary</em>; and (4) <em>Knowledge-check MCQs</em> with click-to-reveal feedback. Work
                  top-to-bottom in order &mdash; later modules assume earlier knowledge.</p>
                <p>The interactive quiz tracker (sidebar) updates as you complete sections. Your progress is stored only in
                  the page memory for the session.</p>
              </div>

              <div className="callout warn">
                <span className="label">Tax-year currency</span>
                <p>All numerical examples use <strong>2024/25</strong> rates as the primary teaching year, with
                  <strong>2025/26</strong> uplifts noted where the change is material. Rates revise annually at the Spring
                  &amp; Autumn statements &mdash; always confirm current rates against <code>gov.uk</code> before applying to
                  a live client.</p>
              </div>

              <div className="callout danger">
                <span className="label">Educational use</span>
                <p>This course is a <strong>technical reference for trainee accountants and bookkeepers</strong>. It does not
                  constitute regulated tax or legal advice for any specific person or business. Anyone advising clients
                  commercially must be appropriately qualified and supervised by a recognised body (ICAEW, ACCA, AAT, CIMA,
                  CIOT, ATT or equivalent), or be HMRC-supervised for AML.</p>
              </div>
            </section>

            <section id="visuals">
              <h2 style={{ marginTop: '48px' }}>Visual mockups are embedded throughout</h2>
              <p>This course interleaves <strong>visual mockups</strong> with the technical content. When a module covers a
                software workflow (Xero, QBO, Dext, BrightPay, TaxCalc), you'll find a faithful HTML mockup of the relevant
                screen alongside the explanation. When Part 5 covers year-end accounts, each balance sheet line has a
                working-paper visual showing how to evidence and tie back the figure.</p>
              <p style={{ marginTop: '12px' }}>Look for the <strong>visual block</strong> marker beside each topic:</p>
              <div className="visual-block" style={{ marginTop: '16px' }}>
                <div className="vb-head">
                  <span className="vb-tag">Visual</span>
                  <h4 className="vb-title">Example — every visual block looks like this</h4>
                </div>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink-soft)' }}>Visual blocks pair an explanation with a
                  mockup. Read left-to-right: steps and key checks on the left, the simulated platform screen on the right.
                  The mockups cover what to do AND what the screen looks like when you do it.</p>
              </div>
            </section>

            <hr className="sec thick" />

            <section id="contents">
              <h2 style={{ marginTop: 0 }}>Master Contents</h2>
              <div className="master-toc">
                <h2>The 12 Parts &amp; 87 Modules</h2>
                
                {PARTS.map(part => (
                  <React.Fragment key={part.number}>
                    <h3>Part {part.number} &middot; {part.title}</h3>
                    <ul>
                      {part.modules.map(modId => {
                        const modNumber = parseInt(modId.replace(/\D/g, ''), 10)
                        return (
                          <li key={modId}>
                            <Link href={`/course/${modId}`}>
                              {modNumber}. {MODULE_TITLES[modId]}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </React.Fragment>
                ))}

              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
