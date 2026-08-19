'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface SectionMeta {
  section_id: string
  section_title: string
  section_order: number
  aiPractice?: any
}

interface ModuleData {
  module_title: string
  meta: string
  learningObjHtml: string
  hookHtml?: string
  hookText?: string
  sections: SectionMeta[]
}

import { motion, AnimatePresence } from 'framer-motion'
import DOMPurify from 'dompurify'
import AiZone from '@/components/AiZone'
import AntiCheatWrapper from '@/components/AntiCheatWrapper'
import ProctoringCamera from '@/components/ProctoringCamera'
import MobileDeviceStatus from '@/components/MobileDeviceStatus'
import VoiceAssistantSidebar from '@/components/VoiceAssistantSidebar'
import DevProctoringToolbar from '@/components/DevProctoringToolbar'
import { useProctoringConfig } from '@/lib/proctoringConfig'
import { initAnimFactory } from '@/lib/animFactory'

export default function CourseLessonPage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = (params.moduleId as string) || 'm01'

  const [loading, setLoading] = useState(true)
  const [moduleData, setModuleData] = useState<ModuleData | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const currentSection = moduleData?.sections[currentIdx]
  const [contentHtml, setContentHtml] = useState('')

  const [isViolatingProctoring, setIsViolatingProctoring] = useState(false)
  const [proctoringWarning, setProctoringWarning] = useState('')
  const [isProctoringAgreed, setIsProctoringAgreed] = useState(false)
  const [proctorSessionId, setProctorSessionId] = useState<string | null>(null)
  const [proctorQrValue, setProctorQrValue] = useState<string | null>(null)
  const [mobileStatus, setMobileStatus] = useState<string>('not_linked')

  const { config } = useProctoringConfig()

  const handleProctoringViolation = React.useCallback((isViolating: boolean, message: string) => {
    setIsViolatingProctoring(isViolating)
    if (isViolating) setProctoringWarning(message)
  }, [])

  const handleAgreeProctoring = async () => {
    // BUG 1 FIX: Skip POST if session already exists (avoid duplicate creation)
    if (!proctorSessionId) {
      try {
        const res = await fetch('/api/proctor-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId })
        })
        const data = await res.json()
        if (data.sessionId) {
          setProctorSessionId(data.sessionId)
          setProctorQrValue(data.qrPayload || `lms://proctor/${data.sessionId}`)
          // If already paired (reused session), advance immediately
          if (data.status === 'paired') {
            setMobileStatus('paired')
          }
        }
      } catch (e) {
        console.error('Failed to get proctor session', e)
      }
    }
    setIsProctoringAgreed(true)
  }

  // BUG 1 FIX: Only reset proctoring state when moduleId changes, NOT on section navigation
  useEffect(() => {
    setIsProctoringAgreed(false)
    setProctorSessionId(null)
    setProctorQrValue(null)
    setMobileStatus('not_linked')
  }, [moduleId])

  useEffect(() => {
    if (currentSection?.section_title === 'Knowledge Check' && !proctorSessionId) {
      fetch('/api/proctor-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId })
      })
        .then(res => res.json())
        .then(data => {
          if (data.sessionId) {
            setProctorSessionId(data.sessionId)
            setProctorQrValue(data.qrPayload || `lms://proctor/${data.sessionId}`)
            // If reused session is already paired, advance immediately
            if (data.status === 'paired') {
              setMobileStatus('paired')
            }
          }
        })
        .catch(err => console.error('Failed to auto-init proctor session:', err))
    }
  }, [currentSection?.section_title, moduleId, proctorSessionId])

  // BUG 3 FIX: Poll session status every 2s to detect pairing
  useEffect(() => {
    if (!proctorSessionId) return
    if (mobileStatus === 'live' || mobileStatus === 'paired') return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/proctor-session?sessionId=${proctorSessionId}`)
        const data = await res.json()
        if (data.status === 'paired' || data.status === 'active') {
          setMobileStatus('paired')
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [proctorSessionId, mobileStatus])

  useEffect(() => {
    fetch(`/api/sections?moduleId=${moduleId}`)
      .then(res => res.json())
      .then(data => {
        if (data.sections && data.sections.length > 0) {
          setModuleData(data)
          loadSectionContent(moduleId, data.sections[0].section_id)
        } else {
          setLoading(false)
        }
      })
      .catch(console.error)
  }, [moduleId])

  const loadSectionContent = async (mId: string, sId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/section-content?moduleId=${mId}&sectionId=${sId}`)
      const data = await res.json()
      setContentHtml(data.content || '<p>No content available.</p>')
    } catch (err) {
      console.error(err)
      setContentHtml('<p>Error loading content.</p>')
    } finally {
      setLoading(false)
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      const newIdx = currentIdx - 1
      setCurrentIdx(newIdx)
      loadSectionContent(moduleId, moduleData!.sections[newIdx].section_id)
      window.scrollTo(0, 0)
    } else {
      router.push('/courses')
    }
  }

  const handleNext = () => {
    if (currentIdx < moduleData!.sections.length - 1) {
      const newIdx = currentIdx + 1
      setCurrentIdx(newIdx)
      loadSectionContent(moduleId, moduleData!.sections[newIdx].section_id)
      window.scrollTo(0, 0)
    } else {
      const currentModuleNum = parseInt(moduleId.replace(/\D/g, ''), 10)
      if (currentModuleNum < 87) {
        const nextModuleId = `m${String(currentModuleNum + 1).padStart(2, '0')}`
        router.push(`/course/${nextModuleId}`)
      } else {
        router.push('/courses')
      }
    }
  }

  const handleMarkDone = async () => {
    try {
      const currentSection = moduleData!.sections[currentIdx]
      if (!currentSection) return
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          sectionId: currentSection.section_id,
          sectionTitle: currentSection.section_title,
          status: 'completed',
        }),
      })
      window.dispatchEvent(new Event('progress-updated'))
      handleNext()
    } catch (err) {
      console.error('Failed to mark done', err)
    }
  }

  // Handle Knowledge Check MCQ clicks via event delegation
  useEffect(() => {
    if (!contentHtml) return
    
    const handleQuizClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.classList.contains('opt')) return
      
      const q = target.closest('.quiz-q') as HTMLElement
      if (!q || q.dataset.answered === 'yes') return
      
      q.dataset.answered = 'yes'
      const isCorrect = target.dataset.correct === 'true'
      target.classList.add(isCorrect ? 'correct' : 'wrong')
      
      if (!isCorrect) {
        const correctOpt = q.querySelector('.opt[data-correct="true"]')
        if (correctOpt) correctOpt.classList.add('correct')
      }
      
      q.querySelectorAll('.opt').forEach(o => o.classList.add('disabled'))
      
      const fb = q.querySelector('.feedback')
      if (fb) fb.classList.add('show')
      
      const block = q.closest('.quiz-block') as HTMLElement
      if (block) {
        const qs = block.querySelectorAll('.quiz-q')
        const total = qs.length
        let answered = 0, correctCount = 0
        qs.forEach((question: any) => {
          if (question.dataset.answered === 'yes') {
            answered++
            if (question.querySelector('.opt.correct') && !question.querySelector('.opt.wrong')) {
              correctCount++
            }
          }
        })
        
        if (answered === total) {
          const res = block.querySelector('.quiz-result')
          if (res) {
            res.classList.add('show')
            res.innerHTML = `You scored <strong>${correctCount} / ${total}</strong>` +
              (correctCount === total ? ' &mdash; perfect, move on to the next module.' :
                correctCount >= total * 0.7 ? ' &mdash; good, but review the items you missed.' :
                  ' &mdash; please re-read this module before progressing.')
          }
        }
      }
    }
    
    const container = document.getElementById('lesson-body')
    if (container) {
      container.addEventListener('click', handleQuizClick)
    }
    return () => {
      if (container) container.removeEventListener('click', handleQuizClick)
    }
  }, [contentHtml])

  // Handle AnimFactory initialization and extraction
  useEffect(() => {
    if (!contentHtml) return;
    initAnimFactory();
    
    // Extract and run AnimFactory scenes from contentHtml (strips scripts, so we parse them out)
    const scriptRegex = /AnimFactory\.create\('([^']+)',\s*(\[\s*\{[\s\S]*?\}\s*\])\s*\);/g;
    let match;
    while ((match = scriptRegex.exec(contentHtml)) !== null) {
      const prefix = match[1];
      let scenes;
      try {
        // Safe alternative to eval: since it's an array of objects, we use JSON.parse.
        // Convert JS single-quote keys/strings to double-quotes if necessary, 
        // though standard JSON requires double-quotes. Assuming the backend sends valid JSON-like structures:
        const jsonStr = match[2]
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"\$2": ')
          .replace(/'/g, '"')
          .replace(/,\s*}/g, '}');
        scenes = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse animation scenes for', prefix, e);
        continue;
      }
      if (scenes && (window as any).AnimFactory) {
        // Run on the next tick so the DOM nodes are painted by dangerouslySetInnerHTML
        setTimeout(() => {
          (window as any).AnimFactory.create(prefix, scenes);
        }, 50);
      }
    }
  }, [contentHtml])

  if (!moduleData && !loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Module content not found.</div>
  }

  const moduleNumberStr = moduleId.replace(/\D/g, '') || '1'
  const moduleNumber = parseInt(moduleNumberStr, 10)

  // Extract Part name from meta or default
  const partNameMatch = moduleData?.meta.match(/Part (\d+) of \d+/)
  const partName = partNameMatch ? `Part ${partNameMatch[1]}` : 'Part'
  const partNumber = partNameMatch ? parseInt(partNameMatch[1], 10) : 1
  const partTitle = moduleData?.meta.match(/Part \d+ · ([^·]+)/)?.[1]?.trim() ?? ''

  return (
    <div id="lesson-screen" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: '"Charter", Georgia, serif' }}>
      
      {/* ─ Top bar ─ */}
      <div id="lesson-topbar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 40px', borderBottom: '1px solid var(--line-soft)',
        background: 'var(--bg-alt)', zIndex: 10, flexShrink: 0,
      }}>
        <div id="topbar-breadcrumb" style={{ fontFamily: '"Inter", sans-serif', fontSize: 12.5, color: 'var(--ink-faint)', letterSpacing: '0.02em' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginRight: 8 }}>{partName}</span>
          <span style={{ color: 'var(--line)' }}>›</span>
          <strong style={{ color: 'var(--ink)', marginLeft: 8 }}>M{moduleNumber} · {moduleData?.module_title || 'Module'}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: '"Inter", sans-serif', fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Section {currentIdx + 1} / {moduleData?.sections.length || 0}
          </div>
          <button
            onClick={handleMarkDone}
            style={{
              background: 'var(--accent-3)', color: '#fff', border: 'none',
              padding: '7px 16px', borderRadius: 4, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: '"Inter", sans-serif', letterSpacing: '0.02em', transition: '0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#166534'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--accent-3)'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Mark Done
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Main Content Area */}
        <div 
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight > el.clientHeight) {
              let pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
              if (pct > 100) pct = 100;
              if (pct < 0) pct = 0;
              window.dispatchEvent(new CustomEvent('reading-progress', { detail: pct }));
            }
          }}
        >
          {/* Lesson Body */}
          <div id="lesson-body" style={{ flex: 1, padding: '40px 60px 80px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
        {loading && !moduleData ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40, fontFamily: '"Inter", sans-serif' }}>Loading content...</div>
        ) : (
          <>
            {currentIdx === 0 && moduleData && (
              <>
                {/* Module header — matching old HTML book style */}
                <div className="lesson-module-badge">Module {moduleNumber}</div>
                <h1 className="lesson-module-title">{moduleData.module_title}</h1>
                <div className="lesson-module-meta">{moduleData.meta}</div>
                {moduleData.hookHtml && (
                  <div
                    className="module-hook"
                    dangerouslySetInnerHTML={{ __html: moduleData.hookHtml }}
                  />
                )}
                {moduleData.learningObjHtml && (
                  <div dangerouslySetInnerHTML={{ __html: moduleData.learningObjHtml }} />
                )}
                <div style={{ marginTop: 28 }} />
              </>
            )}

            <div className="section-card" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <div className="section-card-header">
                <h2>{currentSection?.section_title}</h2>
              </div>
              <div className="section-content-wrapper">
                {currentSection?.section_title === 'Knowledge Check' ? (
                  !(isProctoringAgreed || config.gates.bypassIntegrityAgreement) ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px',
                      background: '#1f2937', // gray-800
                      border: '1px solid #4b5563', // gray-600
                      borderRadius: '12px',
                      maxWidth: '560px',
                      margin: '30px auto',
                      textAlign: 'center',
                      color: '#ffffff', // white
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'rgba(239, 68, 68, 0.1)', // red low opacity
                        color: '#ef4444', // red-500
                        borderRadius: '9999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px'
                      }}>
                        <svg style={{ width: '32px', height: '32px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.025em', color: '#ffffff' }}>Academic Integrity Agreement</h2>
                      <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
                        To ensure the fairness and credibility of this certification, this session uses real-time local proctoring. Please be honest and follow the exam rules.
                      </p>

                      <div style={{
                        width: '100%',
                        textAlign: 'left',
                        background: '#111827', // gray-900
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid #374151', // gray-700
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        fontSize: '12.5px',
                        color: '#d1d5db', // gray-300
                        marginBottom: '32px',
                        lineHeight: 1.5
                      }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>1.</span>
                          <div><strong style={{ color: '#ffffff' }}>Camera & Mic:</strong> Evaluates local AI to confirm only 1 person faces the screen. If flagged locally, specific images are securely sent to our Tier-2 AI (Claude) for secondary review. </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>2.</span>
                          <div><strong style={{ color: '#ffffff' }}>Focus Mode:</strong> Keep this window active. Switching tabs or capturing screenshots will log a violation.</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>3.</span>
                          <div><strong style={{ color: '#ffffff' }}>Privacy & Appeals:</strong> Tier-2 images are retained for 30 days for appeal review and then securely deleted. Only authorized instructors can review flags. If you lack a second device, please contact support for an alternative arrangement.</div>
                        </div>
                      </div>

                      <button 
                        onClick={handleAgreeProctoring}
                        style={{
                          width: '100%',
                          background: '#ef4444', // red-500
                          color: '#ffffff', // white
                          fontWeight: 600,
                          padding: '12px 24px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                        onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
                      >
                        I Agree, Start Knowledge Check
                      </button>
                    </div>
                  ) : (!config.gates.bypassMobileCameraRequired && mobileStatus !== 'live' && mobileStatus !== 'paired') ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#fff', background: '#1f2937', borderRadius: 12, marginTop: 40 }}>
                      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>📱 Link Your Phone to Continue</h2>
                      <p style={{ color: '#9ca3af', marginBottom: 24 }}>Mobile camera monitoring is required for this exam.</p>
                      <div style={{ display: 'inline-block', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 8 }}>
                        <ol style={{ margin: 0, paddingLeft: 20, color: '#d1d5db', lineHeight: 1.6 }}>
                          <li>Open the <strong>LMS Mobile App</strong> on your phone</li>
                          <li>Tap <strong>Scan Desktop QR Code</strong></li>
                          <li>Scan the QR code shown in the sidebar</li>
                          <li>Position your phone behind you, facing your screen</li>
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <AntiCheatWrapper 
                      isViolatingProctoring={isViolatingProctoring}
                      proctoringWarning={proctoringWarning}
                      sessionId={proctorSessionId || undefined}
                    >
                      <div 
                        className="section-content-html"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contentHtml) }} 
                      />
                    </AntiCheatWrapper>
                  )
                ) : (
                  <div 
                    className="section-content-html"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contentHtml) }} 
                  />
                )}
              </div>
            </div>
            
            {/* AI Zone */}
            {currentSection && contentHtml && !loading && currentSection.aiPractice && (
              <AiZone 
                sectionTitle={currentSection.section_title}
                contentHtml={contentHtml}
                preGeneratedData={currentSection.aiPractice}
              />
            )}
          </>
        )}
      </div>

      {/* ─ Navigation bar ─ */}
      <div id="nav-bar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 40px', background: 'var(--bg-alt)', borderTop: '1px solid var(--line-soft)',
        position: 'sticky', bottom: 0, zIndex: 10,
      }}>
        <button
          id="btn-prev"
          onClick={handlePrev}
          disabled={currentIdx === 0 && moduleNumber === 1}
          style={{
            background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-soft)',
            padding: '9px 20px', borderRadius: 4, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: '"Inter", sans-serif', transition: '0.15s',
            opacity: (currentIdx === 0 && moduleNumber === 1) ? 0.3 : 1,
          }}
          onMouseOver={e => { if (!(currentIdx === 0 && moduleNumber === 1)) e.currentTarget.style.borderColor = 'var(--accent-2)' }}
          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--line)'}
        >
          ← Back
        </button>

        {/* Section dots */}
        <div id="nav-dots" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {moduleData?.sections.map((sec, idx) => (
            <div
              key={sec.section_id}
              style={{
                width: idx === currentIdx ? 22 : 7,
                height: 7, borderRadius: 4,
                background: idx === currentIdx ? 'var(--accent)' : idx < currentIdx ? '#94a3b8' : 'var(--line)',
                cursor: 'pointer', transition: 'all 0.25s ease',
              }}
              title={sec.section_title}
              onClick={() => {
                setCurrentIdx(idx)
                loadSectionContent(moduleId, moduleData.sections[idx].section_id)
                window.scrollTo(0, 0)
              }}
            />
          ))}
        </div>

        <button
          id="btn-next"
          onClick={handleMarkDone}
          style={{
            background: 'var(--accent-2)', color: '#fff', border: 'none',
            padding: '9px 24px', borderRadius: 4, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: '"Inter", sans-serif', letterSpacing: '0.02em', transition: '0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#1e3a8a'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--accent-2)'}
        >
          {currentIdx === (moduleData?.sections.length || 0) - 1 ? 'Finish Module →' : 'Continue →'}
        </button>
      </div>
    </div>
    
    {/* Voice Assistant Sidebar or Proctoring */}
    {currentSection?.section_title === 'Knowledge Check' ? (
      <div style={{ 
        width: '320px', 
        borderLeft: '1px solid var(--line-soft)', 
        background: 'var(--bg-alt)',
        display: 'flex', 
        flexDirection: 'column', 
        padding: '24px' 
      }}>
        <h3 style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Exam Integrity</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 24, lineHeight: 1.5 }}>
          Your camera is active to ensure academic integrity. Please face the screen during the entire Knowledge Check.
        </p>
        {(isProctoringAgreed || config.gates.bypassIntegrityAgreement) ? (
          <>
            {proctorSessionId && !config.gates.bypassMobileCameraRequired && (
              <div style={{ marginBottom: 20 }}>
                <MobileDeviceStatus 
                  sessionId={proctorSessionId} 
                  onStatusChange={setMobileStatus} 
                />
              </div>
            )}
            <ProctoringCamera onViolation={handleProctoringViolation} sessionId={proctorSessionId || undefined} qrValue={proctorQrValue || undefined} />
          </>
        ) : (
          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px dashed #334155',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#64748b',
            lineHeight: 1.4
          }}>
            Camera activation pending integrity agreement.
          </div>
        )}
      </div>
    ) : (
      <VoiceAssistantSidebar
        moduleId={moduleId}
        moduleTitle={moduleData?.module_title}
        partNumber={partNumber}
        partTitle={partTitle}
        currentSection={currentSection ? {
          sectionId: currentSection.section_id,
          sectionTitle: currentSection.section_title,
          sectionOrder: currentSection.section_order,
        } : undefined}
      />
    )}
  </div>

  {/* Dev Proctoring Floating Toolbar */}
  <DevProctoringToolbar onSimulateViolation={handleProctoringViolation} />
</div>
  )
}
