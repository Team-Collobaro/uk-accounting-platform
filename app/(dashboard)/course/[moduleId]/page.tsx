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

import CourseNavigation from '@/components/CourseNavigation'
import AiZone from '@/components/AiZone'
import AntiCheatWrapper from '@/components/AntiCheatWrapper'
import ProctoringCamera from '@/components/ProctoringCamera'
import VoiceAssistantSidebar from '@/components/VoiceAssistantSidebar'

export default function CourseLessonPage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = (params.moduleId as string) || 'm01'

  const [loading, setLoading] = useState(true)
  const [moduleData, setModuleData] = useState<ModuleData | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [contentHtml, setContentHtml] = useState('')

  const [isViolatingProctoring, setIsViolatingProctoring] = useState(false)
  const [proctoringWarning, setProctoringWarning] = useState('')

  const handleProctoringViolation = React.useCallback((isViolating: boolean, message: string) => {
    setIsViolatingProctoring(isViolating)
    if (isViolating) setProctoringWarning(message)
  }, [])

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

  if (!moduleData && !loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Module content not found.</div>
  }

  const currentSection = moduleData?.sections[currentIdx]
  const moduleNumberStr = moduleId.replace(/\D/g, '') || '1'
  const moduleNumber = parseInt(moduleNumberStr, 10)

  // Extract Part name from meta or default
  const partNameMatch = moduleData?.meta.match(/Part (\d+) of \d+/)
  const partName = partNameMatch ? `Part ${partNameMatch[1]}` : 'Part'
  const partNumber = partNameMatch ? parseInt(partNameMatch[1], 10) : 1
  const partTitle = moduleData?.meta.match(/Part \d+ · ([^·]+)/)?.[1]?.trim() ?? ''

  return (
    <div id="lesson-screen" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: '"Charter", Georgia, serif' }}>
      
      {/* Top Bar */}
      <div id="lesson-topbar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', borderBottom: '1px solid var(--line-soft)',
        background: 'var(--bg-alt)', zIndex: 10, flexShrink: 0
      }}>
        <div className="topbar-breadcrumb" id="topbar-breadcrumb" style={{
          fontFamily: '"Inter", sans-serif', fontSize: 13, color: 'var(--ink)', fontWeight: 400,
          letterSpacing: '0.02em'
        }}>
          <span style={{ color: '#94a3b8' }}>{partName} &rsaquo; </span>
          <strong>M{moduleNumber} &middot; {moduleData?.module_title || 'Module'}</strong>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="section-progress" id="section-progress" style={{
            fontFamily: '"Inter", sans-serif', fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            Section {currentIdx + 1} of {moduleData?.sections.length || 0}
          </div>
          
          <button onClick={handleMarkDone} style={{
            background: 'var(--accent-3)', color: '#fff', border: 'none',
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: '0.2s', fontFamily: '"Inter", sans-serif'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Mark Done
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
          {/* Lesson Body */}
          <div id="lesson-body" style={{ flex: 1, padding: '40px 60px 80px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
        {loading && !moduleData ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40, fontFamily: '"Inter", sans-serif' }}>Loading content...</div>
        ) : (
          <>
            {currentIdx === 0 && moduleData && (
              <>
                <div className="lesson-module-badge">Module {moduleNumber}</div>
                <div className="lesson-module-title">{moduleData.module_title}</div>
                <div className="lesson-module-meta">{moduleData.meta}</div>
                {moduleData.hookHtml && (
                  <div 
                    className="module-hook-container" 
                    dangerouslySetInnerHTML={{ __html: moduleData.hookHtml }} 
                    style={{ fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--ink-soft)', marginBottom: '32px', paddingLeft: '16px', borderLeft: '3px solid var(--accent)', lineHeight: 1.6 }} 
                  />
                )}
                {moduleData.learningObjHtml && (
                  <div dangerouslySetInnerHTML={{ __html: moduleData.learningObjHtml }} />
                )}
                <div style={{ marginTop: 32 }}></div>
              </>
            )}

            <div className="section-card" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <div className="section-card-header">
                <h2>{currentSection?.section_title}</h2>
              </div>
              <div className="section-content-wrapper">
                {currentSection?.section_title === 'Knowledge Check' ? (
                  <AntiCheatWrapper 
                    isViolatingProctoring={isViolatingProctoring}
                    proctoringWarning={proctoringWarning}
                  >
                    <div 
                      className="section-content-html"
                      dangerouslySetInnerHTML={{ __html: contentHtml }} 
                    />
                  </AntiCheatWrapper>
                ) : (
                  <div 
                    className="section-content-html"
                    dangerouslySetInnerHTML={{ __html: contentHtml }} 
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

      {/* Navigation Bar */}
      <div id="nav-bar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', background: 'var(--bg-alt)', borderTop: '1px solid var(--line-soft)',
        position: 'sticky', bottom: 0, zIndex: 10
      }}>
        <button 
          className="btn-nav prev" 
          id="btn-prev"
          onClick={handlePrev}
          disabled={currentIdx === 0 && moduleNumber === 1}
          style={{
            background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-soft)',
            padding: '10px 20px', borderRadius: 6, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: '"Inter", sans-serif',
            opacity: (currentIdx === 0 && moduleNumber === 1) ? 0.3 : 1
          }}
        >
          &larr; Back
        </button>
        
        <div className="nav-section-dots" id="nav-dots" style={{ display: 'flex', gap: 6 }}>
          {moduleData?.sections.map((sec, idx) => (
            <div 
              key={sec.section_id} 
              className={`dot ${idx < currentIdx ? 'done' : ''} ${idx === currentIdx ? 'current' : ''}`}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: idx === currentIdx ? 'var(--accent)' : (idx < currentIdx ? 'var(--line-soft)' : 'var(--line)'),
                cursor: 'pointer', transition: 'background 0.2s'
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
          className="btn-nav" 
          id="btn-next"
          onClick={handleMarkDone}
          style={{
            background: 'var(--accent-2)', color: '#fff', border: 'none',
            padding: '10px 24px', borderRadius: 6, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: '"Inter", sans-serif'
          }}
        >
          {currentIdx === (moduleData?.sections.length || 0) - 1 ? 'Finish Module' : 'Continue \u2192'}
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
        <ProctoringCamera onViolation={handleProctoringViolation} />
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
</div>
  )
}
