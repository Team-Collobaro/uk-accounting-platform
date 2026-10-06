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

interface MobileIncident {
  message: string
  severity: string
}

import { motion, AnimatePresence } from 'framer-motion'
import DOMPurify from 'dompurify'
import AiZone from '@/components/AiZone'
import AntiCheatWrapper from '@/components/AntiCheatWrapper'
import ProctoringCamera from '@/components/ProctoringCamera'
import MobileDeviceStatus from '@/components/MobileDeviceStatus'
import VoiceAssistantSidebar from '@/components/VoiceAssistantSidebar'
import DevProctoringToolbar from '@/components/DevProctoringToolbar'
import SecureQuiz from '@/components/SecureQuiz'
import { useProctoringConfig } from '@/lib/proctoringConfig'
import { initAnimFactory } from '@/lib/animFactory'
import { mobileAppDownload } from '@/lib/mobileAppDownload'

export default function CourseLessonPage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = (params.moduleId as string) || 'm01'

  const [loading, setLoading] = useState(true)
  const [moduleData, setModuleData] = useState<ModuleData | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const currentSection = moduleData?.sections[currentIdx]
  const [contentHtml, setContentHtml] = useState('')
  const [quizPassed, setQuizPassed] = useState(false)
  const [lockedByModule, setLockedByModule] = useState<string | null>(null)

  const [isViolatingProctoring, setIsViolatingProctoring] = useState(false)
  const [proctoringWarning, setProctoringWarning] = useState('')
  const [mobileIncidents, setMobileIncidents] = useState<Record<string, MobileIncident>>({})
  const [isProctoringAgreed, setIsProctoringAgreed] = useState(false)
  const [proctorSessionId, setProctorSessionId] = useState<string | null>(null)
  const [proctorQrValue, setProctorQrValue] = useState<string | null>(null)
  const [proctorExpiresAt, setProctorExpiresAt] = useState<string | null>(null)
  const [mobileStatus, setMobileStatus] = useState<string>('not_linked')
  const [showResumeNotice, setShowResumeNotice] = useState(false)
  const [sessionNoticeKind, setSessionNoticeKind] = useState<'restored' | 'replaced'>('restored')
  const sessionRecoveryRef = React.useRef(false)

  const sessionKey = `proctor-session:${moduleId}`
  const sectionKey = `exam-section:${moduleId}`

  const { config } = useProctoringConfig()

  const handleProctoringViolation = React.useCallback((isViolating: boolean, message: string) => {
    setIsViolatingProctoring(isViolating)
    setProctoringWarning(isViolating ? message : '')
  }, [])

  const handleMobileProctoringViolation = React.useCallback((
    isViolating: boolean,
    message: string,
    incidentType: string,
    severity: string,
  ) => {
    setMobileIncidents((current) => {
      if (!isViolating && incidentType === '*') return {}
      const next = { ...current }
      if (isViolating) next[incidentType] = { message, severity }
      else delete next[incidentType]
      return next
    })
  }, [])

  const activeMobileIncidents = Object.entries(mobileIncidents)
  const hardMobileIncidents = activeMobileIncidents.filter(([, incident]) => incident.severity === 'hard' || incident.severity === 'technical')
  const warningMobileIncidents = activeMobileIncidents.filter(([, incident]) => incident.severity === 'warning' || incident.severity === 'soft')
  const hardMobileIncident = hardMobileIncidents[0]

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
          if (data.expiresAt) setProctorExpiresAt(data.expiresAt)
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
    sessionStorage.setItem(`proctor-agreed:${moduleId}`, 'true')
  }

  const handleRegenerateQr = async () => {
    try {
      const res = await fetch('/api/proctor-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, forceNew: true })
      })
      const data = await res.json()
      if (data.sessionId) {
        setProctorSessionId(data.sessionId)
        setProctorQrValue(data.qrPayload || `lms://proctor/${data.sessionId}`)
        if (data.expiresAt) setProctorExpiresAt(data.expiresAt)
        setMobileStatus('not_linked')
      }
    } catch (e) {
      console.error('Failed to regenerate proctor session', e)
    }
  }

  const handleInvalidProctorSession = React.useCallback(async (message: string) => {
    if (sessionRecoveryRef.current) return
    sessionRecoveryRef.current = true

    sessionStorage.removeItem(sessionKey)
    localStorage.removeItem(sessionKey)
    setProctorSessionId(null)
    setProctorQrValue(null)
    setProctorExpiresAt(null)
    setMobileStatus('not_linked')
    setMobileIncidents({})

    try {
      const res = await fetch('/api/proctor-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.sessionId) {
        throw new Error(data.error || 'Could not create a replacement monitoring session.')
      }

      setProctorSessionId(data.sessionId)
      setProctorQrValue(data.qrPayload || `lms://proctor/${data.sessionId}`)
      setProctorExpiresAt(data.expiresAt || null)
      setSessionNoticeKind('replaced')
      setShowResumeNotice(true)
    } catch (error) {
      console.error('Failed to recover proctor session:', error)
      setProctoringWarning(error instanceof Error ? error.message : 'Could not recover the monitoring session.')
    } finally {
      sessionRecoveryRef.current = false
    }
  }, [moduleId, sessionKey])

  // BUG 1 FIX: Only reset proctoring state when moduleId changes, NOT on section navigation.
  // Also persist the active session across component re-renders so the link survives
  // a route refresh or a temporary state reset.
  useEffect(() => {
    const storedSessionId = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey)
    if (storedSessionId) {
      let cancelled = false
      let retryTimer: ReturnType<typeof setTimeout> | undefined
      setProctorSessionId(storedSessionId)
      setMobileStatus('not_linked')

      const clearStoredSession = () => {
        sessionStorage.removeItem(sessionKey)
        localStorage.removeItem(sessionKey)
        setProctorSessionId(null)
        setProctorQrValue(null)
        setProctorExpiresAt(null)
        setMobileStatus('not_linked')
      }

      const retryRestore = () => {
        if (cancelled) return
        setMobileStatus('reconnecting')
        retryTimer = setTimeout(restoreStoredSession, 5_000)
      }

      // Restore the pending QR payload or the paired/active state. Previously
      // only the UUID was restored, leaving the QR blank after a refresh.
      const restoreStoredSession = async () => {
        try {
          const res = await fetch(`/api/proctor-session?sessionId=${storedSessionId}`)
          if (cancelled) return
          if (!res.ok) {
            if ([400, 403, 404, 410].includes(res.status)) clearStoredSession()
            else retryRestore()
            return
          }
          const data = await res.json()
          if (cancelled) return
          if (data.qrPayload) setProctorQrValue(data.qrPayload)
          if (data.expiresAt) setProctorExpiresAt(data.expiresAt)
          if (['paired', 'active', 'paused'].includes(data.status)) {
            setMobileStatus(data.status === 'active' ? 'reconnecting' : 'paired')
            setIsProctoringAgreed(true)
            sessionStorage.setItem(`proctor-agreed:${moduleId}`, 'true')
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
            if (navigation?.type === 'reload') {
              setSessionNoticeKind('restored')
              setShowResumeNotice(true)
            }
          }
        } catch (_) {
          retryRestore()
        }
      }

      void restoreStoredSession()
      return () => {
        cancelled = true
        if (retryTimer) clearTimeout(retryTimer)
      }
    }

    setIsProctoringAgreed(false)
    setProctorSessionId(null)
    setProctorQrValue(null)
    setProctorExpiresAt(null)
    setMobileStatus('not_linked')
  }, [moduleId, sessionKey])

  useEffect(() => {
    if (currentSection?.section_id) {
      sessionStorage.setItem(sectionKey, currentSection.section_id)
    }
  }, [currentSection?.section_id, sectionKey])

  useEffect(() => {
    const shouldWarn = Boolean(
      proctorSessionId &&
      isProctoringAgreed &&
      currentSection?.section_title === 'Knowledge Check'
    )
    if (!shouldWarn) return

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [proctorSessionId, isProctoringAgreed, currentSection?.section_title])

  useEffect(() => {
    if (proctorSessionId) {
      sessionStorage.setItem(sessionKey, proctorSessionId)
      localStorage.setItem(sessionKey, proctorSessionId)
    }
  }, [proctorSessionId, sessionKey])

  useEffect(() => {
    if (currentSection?.section_title === 'Knowledge Check' && !proctorSessionId && !sessionRecoveryRef.current) {
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
            if (data.expiresAt) setProctorExpiresAt(data.expiresAt)
            // If reused session is already paired, advance immediately
            if (data.status === 'paired') {
              setMobileStatus('paired')
            }
          }
        })
        .catch(err => console.error('Failed to auto-init proctor session:', err))
    }
  }, [currentSection?.section_title, moduleId, proctorSessionId])

  useEffect(() => {
    let cancelled = false
    setQuizPassed(false)
    fetch('/api/progress')
      .then((response) => response.ok ? response.json() : null)
      .then((progress) => {
        if (!cancelled && progress?.completedModules?.includes(moduleId)) setQuizPassed(true)
      })
      .catch(() => {/* The assessment remains available if progress cannot be loaded. */})
    return () => { cancelled = true }
  }, [moduleId])

  useEffect(() => {
    setLoading(true)
    setModuleData(null)
    setLockedByModule(null)
    fetch(`/api/sections?moduleId=${moduleId}`)
      .then(async (res) => ({ ok: res.ok, status: res.status, data: await res.json() }))
      .then(({ ok, status, data }) => {
        if (!ok) {
          if (status === 403) setLockedByModule(data.prerequisite ?? 'the previous module')
          setLoading(false)
          return
        }
        if (data.sections && data.sections.length > 0) {
          setModuleData(data)
          const storedSectionId = sessionStorage.getItem(sectionKey)
          const restoredIndex = Math.max(0, data.sections.findIndex((section: SectionMeta) => section.section_id === storedSectionId))
          setCurrentIdx(restoredIndex)
          loadSectionContent(moduleId, data.sections[restoredIndex].section_id)
        } else {
          setLoading(false)
        }
      })
      .catch(console.error)
  }, [moduleId, sectionKey])

  const loadSectionContent = async (mId: string, sId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/section-content?moduleId=${mId}&sectionId=${sId}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) setLockedByModule(data.prerequisite ?? 'the previous module')
        throw new Error(data.error || 'Unable to load section')
      }
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
      if (currentSection.section_title === 'Knowledge Check' && !quizPassed) return
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          sectionId: currentSection.section_id,
          sectionTitle: currentSection.section_title,
          status: 'completed',
        }),
      })
      if (!response.ok) throw new Error('Unable to save section progress')
      window.dispatchEvent(new Event('progress-updated'))
      handleNext()
    } catch (err) {
      console.error('Failed to mark done', err)
    }
  }

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

  if (lockedByModule) {
    return (
      <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, textAlign: 'center', padding: 32, border: '1px solid var(--line-soft)', borderRadius: 14, background: 'var(--bg-alt)' }}>
          <div style={{ fontSize: 34, marginBottom: 12 }} aria-hidden="true">🔒</div>
          <h1 style={{ margin: '0 0 10px', color: 'var(--ink)' }}>Module locked</h1>
          <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            Pass the {lockedByModule.toUpperCase()} knowledge check with 70% or more before opening this module.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/course/${lockedByModule}`)}
            style={{ marginTop: 14, border: 0, borderRadius: 8, padding: '11px 18px', background: 'var(--accent-2)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
          >
            Go to {lockedByModule.toUpperCase()}
          </button>
        </div>
      </div>
    )
  }

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
      {showResumeNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-exam-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
            background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ maxWidth: 460, borderRadius: 14, padding: 24, background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,.3)', fontFamily: 'Montserrat, sans-serif' }}>
            <h2 id="resume-exam-title" style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>
              {sessionNoticeKind === 'replaced' ? 'New camera link required' : 'Exam session restored'}
            </h2>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.55, margin: '12px 0 8px' }}>
              {sessionNoticeKind === 'replaced'
                ? 'Your previous monitoring session expired. A fresh QR code is now available in the Exam Integrity panel.'
                : 'Your browser was reloaded, but you remain in the same proctoring session. A new QR code or exam session was not created.'}
            </p>
            <p style={{ color: '#b45309', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px' }}>
              {sessionNoticeKind === 'replaced'
                ? 'Open LMS Mobile and scan the new QR code before continuing the assessment.'
                : 'Keep the LMS Mobile app open. The assessment will unlock automatically after the phone heartbeat reconnects.'}
            </p>
            <button
              type="button"
              onClick={() => setShowResumeNotice(false)}
              style={{ width: '100%', border: 0, borderRadius: 9, padding: '11px 14px', background: '#1d4ed8', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              {sessionNoticeKind === 'replaced' ? 'Show New QR Code' : 'Continue Same Session'}
            </button>
          </div>
        </div>
      )}
      
      {/* ─ Top bar ─ */}
      <div id="lesson-topbar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 40px', borderBottom: '1px solid var(--line-soft)',
        background: 'var(--bg-alt)', zIndex: 10, flexShrink: 0,
      }}>
        <div id="topbar-breadcrumb" style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 12.5, color: 'var(--ink-faint)', letterSpacing: '0.02em' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginRight: 8 }}>{partName}</span>
          <span style={{ color: 'var(--line)' }}>›</span>
          <strong style={{ color: 'var(--ink)', marginLeft: 8 }}>M{moduleNumber} · {moduleData?.module_title || 'Module'}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Section {currentIdx + 1} / {moduleData?.sections.length || 0}
          </div>
          <button
            onClick={handleMarkDone}
            disabled={currentSection?.section_title === 'Knowledge Check' && !quizPassed}
            style={{
              background: 'var(--accent-3)', color: '#fff', border: 'none',
              padding: '7px 16px', borderRadius: 4, fontSize: 12.5, fontWeight: 700,
              cursor: currentSection?.section_title === 'Knowledge Check' && !quizPassed ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: '"Montserrat", sans-serif', letterSpacing: '0.02em', transition: '0.15s',
              opacity: currentSection?.section_title === 'Knowledge Check' && !quizPassed ? 0.5 : 1,
            }}
            onMouseOver={e => e.currentTarget.style.background = '#166534'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--accent-3)'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            {currentSection?.section_title === 'Knowledge Check' && !quizPassed ? 'Assessment required' : 'Mark Done'}
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
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40, fontFamily: '"Montserrat", sans-serif' }}>Loading content...</div>
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
                      fontFamily: 'Montserrat, sans-serif'
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
                  ) : (!config.gates.bypassMobileCameraRequired && mobileStatus !== 'live') ? (
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
                      <a
                        href={mobileAppDownload.url}
                        download={mobileAppDownload.fileName}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          marginTop: 20, padding: '11px 18px', borderRadius: 8,
                          background: '#0f766e', color: '#fff', fontWeight: 800,
                          fontSize: 13, textDecoration: 'none',
                        }}
                      >
                        ↓ Download LMS Mobile Android Beta
                      </a>
                    </div>
                  ) : (
                    <AntiCheatWrapper 
                      isViolatingProctoring={isViolatingProctoring || Boolean(hardMobileIncident)}
                      proctoringWarning={hardMobileIncident ? `📱 Mobile Camera: ${hardMobileIncident[1].message}` : proctoringWarning}
                      sessionId={proctorSessionId || undefined}
                    >
                      <SecureQuiz
                        moduleId={moduleId}
                        moduleTitle={moduleData?.module_title || `Module ${moduleNumber}`}
                        alreadyPassed={quizPassed}
                        onPassed={() => setQuizPassed(true)}
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
            cursor: 'pointer', fontFamily: '"Montserrat", sans-serif', transition: '0.15s',
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
          disabled={currentSection?.section_title === 'Knowledge Check' && !quizPassed}
          style={{
            background: 'var(--accent-2)', color: '#fff', border: 'none',
            padding: '9px 24px', borderRadius: 4, fontSize: 14, fontWeight: 700,
            cursor: currentSection?.section_title === 'Knowledge Check' && !quizPassed ? 'not-allowed' : 'pointer', fontFamily: '"Montserrat", sans-serif', letterSpacing: '0.02em', transition: '0.15s',
            opacity: currentSection?.section_title === 'Knowledge Check' && !quizPassed ? 0.5 : 1,
          }}
          onMouseOver={e => e.currentTarget.style.background = '#1e3a8a'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--accent-2)'}
        >
          {currentSection?.section_title === 'Knowledge Check' && !quizPassed
            ? 'Pass assessment to continue'
            : currentIdx === (moduleData?.sections.length || 0) - 1 ? 'Finish Module →' : 'Continue →'}
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
        <h3 style={{ fontFamily: 'Montserrat', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Exam Integrity</h3>
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
                  onViolation={handleMobileProctoringViolation}
                  onSessionInvalid={handleInvalidProctorSession}
                />
              </div>
            )}
            {hardMobileIncidents.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid rgba(239, 68, 68, 0.55)', background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444', fontFamily: 'Montserrat, sans-serif',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>🛑</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                    Monitoring Incident (Exam Locked)
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink)' }}>
                    {hardMobileIncidents.map(([type, incident]) => (
                      <div key={type} style={{ marginBottom: 4 }}>{incident.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {warningMobileIncidents.length > 0 && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid rgba(245, 158, 11, 0.55)', background: 'rgba(245, 158, 11, 0.12)',
                  color: '#d97706', fontFamily: 'Montserrat, sans-serif',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                    Provisional Warning
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink)' }}>
                    {warningMobileIncidents.map(([type, incident]) => (
                      <div key={type} style={{ marginBottom: 4 }}>{incident.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <ProctoringCamera 
              onViolation={handleProctoringViolation} 
              sessionId={proctorSessionId || undefined} 
              qrValue={proctorQrValue || undefined} 
              expiresAt={proctorExpiresAt || undefined}
              onRegenerateQr={mobileStatus === 'not_linked' ? handleRegenerateQr : undefined}
            />
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
