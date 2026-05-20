'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import {
  Send, Loader2, ChevronLeft, ChevronRight, Brain,
  CheckCircle2, XCircle, Mic, MicOff, Volume2, VolumeX,
  Download, PenLine, ChevronDown, ChevronUp, Check, Lock,
} from 'lucide-react'
import type { QuizQuestion } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'assistant'; content: string; timestamp: string }
interface Section { section_id: string; section_title: string; section_order: number }
interface TeachingPoint { title: string; done: boolean }
interface SectionProgress {
  section_id: string; section_title: string; status: string
  notes: string; key_points: string[]
  teaching_point_idx?: number
  teaching_points?: TeachingPoint[]
}

const PART_TITLES: Record<number, string> = {
  0: 'Front Matter', 1: 'Foundations', 2: 'Cloud Software Platforms',
  3: 'VAT', 4: 'Payroll PAYE & CIS', 5: 'Year-End Accounts',
  6: 'Corporation Tax', 7: 'Self Assessment', 8: 'Incorporation',
  9: 'Cessation', 10: 'Structure Changes', 11: 'Specialist Tax',
  12: 'Practice & Ethics', 13: 'Appendices',
}

// ─── Liquid Core Orb (concentric ripple waves, audio-reactive) ───────────────
function AudioOrb({ speaking, analyser }: { speaking: boolean; analyser: AnalyserNode | null }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const midRef   = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const coreRef  = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)
  const freqData = useRef<Uint8Array | null>(null)

  // Drive ring scale + opacity from live frequency data
  useEffect(() => {
    const tick = () => {
      let bass = 0, mid = 0, high = 0
      if (analyser && speaking) {
        if (!freqData.current || freqData.current.length !== analyser.frequencyBinCount) {
          freqData.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
        }
        analyser.getByteFrequencyData(freqData.current)
        const bins = freqData.current
        const len = bins.length
        // Split frequency spectrum into thirds
        for (let i = 0; i < Math.floor(len * 0.15); i++) bass  += bins[i]
        for (let i = Math.floor(len * 0.15); i < Math.floor(len * 0.5); i++) mid  += bins[i]
        for (let i = Math.floor(len * 0.5);  i < Math.floor(len * 0.85); i++) high += bins[i]
        bass  = bass  / (Math.floor(len * 0.15) * 255)
        mid   = mid   / (Math.floor(len * 0.35) * 255)
        high  = high  / (Math.floor(len * 0.35) * 255)
      }

      const t = performance.now() / 1000
      const idle = !speaking

      // Core breathe
      if (coreRef.current) {
        const breathe = idle ? 1 + 0.04 * Math.sin(t * 0.8) : 1 + bass * 0.18
        coreRef.current.style.transform = `scale(${breathe})`
        coreRef.current.style.filter = idle
          ? `brightness(1)`
          : `brightness(${1 + bass * 0.4})`
      }

      // Inner ring — bass driven
      if (innerRef.current) {
        const s = idle ? 0.95 + 0.05 * Math.sin(t * 1.2) : 0.9 + bass * 0.35
        const op = idle ? 0.5 + 0.1 * Math.sin(t) : 0.6 + bass * 0.4
        innerRef.current.style.transform = `scale(${s})`
        innerRef.current.style.opacity = `${Math.min(1, op)}`
      }

      // Mid ring — mid frequencies
      if (midRef.current) {
        const s = idle ? 1 + 0.04 * Math.sin(t * 0.7 + 1) : 0.88 + mid * 0.28
        const op = idle ? 0.35 + 0.1 * Math.sin(t * 0.9) : 0.4 + mid * 0.5
        midRef.current.style.transform = `scale(${s})`
        midRef.current.style.opacity = `${Math.min(1, op)}`
      }

      // Outer ring — high / ambient
      if (outerRef.current) {
        const s = idle ? 1 + 0.03 * Math.sin(t * 0.5 + 2) : 0.92 + high * 0.2
        const op = idle ? 0.2 + 0.08 * Math.sin(t * 0.6) : 0.2 + high * 0.45
        outerRef.current.style.transform = `scale(${s})`
        outerRef.current.style.opacity = `${Math.min(1, op)}`
      }

      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [speaking, analyser])

  return (
    <div className="flex flex-col items-center select-none w-full" style={{ paddingTop: 0, paddingBottom: 0 }}>

      {/* Orb stage */}
      <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Ambient room glow */}
        <div style={{
          position: 'absolute', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(166,0,255,0.18) 0%, rgba(0,255,255,0.06) 55%, transparent 75%)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }} />

        {/* Bloom filter wrapper */}
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: speaking
            ? 'drop-shadow(0 0 22px #00ffff) drop-shadow(0 0 60px #a600ff)'
            : 'drop-shadow(0 0 10px rgba(0,255,255,0.5)) drop-shadow(0 0 30px rgba(166,0,255,0.3))',
          transition: 'filter 0.5s ease',
        }}>

          {/* Outer atmospheric ring */}
          <div ref={outerRef} style={{
            position: 'absolute',
            width: 200, height: 200, borderRadius: '50%',
            border: '1px solid rgba(0,255,255,0.25)',
            background: 'radial-gradient(circle, transparent 60%, rgba(0,85,255,0.04) 100%)',
            boxShadow: '0 0 40px rgba(0,85,255,0.3)',
            animation: 'liquidMorph 9s ease-in-out infinite',
            filter: 'blur(0.5px)',
          }} />

          {/* Mid dashed ring */}
          <div ref={midRef} style={{
            position: 'absolute',
            width: 152, height: 152, borderRadius: '50%',
            border: '2px dashed rgba(166,0,255,0.6)',
            boxShadow: '0 0 24px rgba(166,0,255,0.5)',
            animation: 'liquidMorph 6s ease-in-out infinite reverse',
          }} />

          {/* Inner solid ring */}
          <div ref={innerRef} style={{
            position: 'absolute',
            width: 110, height: 110, borderRadius: '50%',
            border: '2.5px solid #00ffff',
            boxShadow: '0 0 20px #00ffff, inset 0 0 18px rgba(0,255,255,0.15)',
            animation: 'liquidMorph 4s ease-in-out infinite',
          }} />

          {/* Core sphere */}
          <div ref={coreRef} style={{
            position: 'relative',
            width: 76, height: 76, borderRadius: '50%',
            background: 'radial-gradient(circle, #ffffff 0%, #d4ffff 30%, #00ffff 70%)',
            boxShadow: '0 0 30px #fff, 0 0 64px #0055ff, inset 0 0 20px rgba(255,255,255,0.6)',
            zIndex: 6,
            animation: 'coreBreathe 4s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,255,255,0.85)', letterSpacing: '0.2em', textShadow: '0 0 8px #00ffff', fontFamily: 'monospace' }}>
          ALEX · AI TUTOR
        </p>
        <p style={{ fontSize: 9, color: speaking ? 'rgba(0,255,255,0.7)' : 'rgba(255,255,255,0.3)', letterSpacing: '0.18em', marginTop: 3, fontFamily: 'monospace' }}>
          {speaking ? 'VOCAL OUTPUT ACTIVE' : 'SYNAPSE LINK ONLINE'}
        </p>
      </div>

      <style>{`
        @keyframes coreBreathe {
          0%,100% { transform: scale(1); filter: brightness(1); }
          50%      { transform: scale(1.07); filter: brightness(1.25); box-shadow: 0 0 40px #fff, 0 0 80px #00ffff; }
        }
        @keyframes liquidMorph {
          0%,100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
          33%      { border-radius: 45% 55% 48% 52% / 52% 46% 54% 48%; }
          66%      { border-radius: 54% 46% 52% 48% / 44% 53% 47% 56%; }
        }
      `}</style>
    </div>
  )
}

// ─── Section list (dark glassmorphic) ────────────────────────────────────────
function SectionTrail({
  sections, currentIdx, progress, moduleId, onSelect,
}: {
  sections: Section[]
  currentIdx: number
  progress: SectionProgress[]
  moduleId: string
  onSelect: (idx: number) => void
}) {
  // fetched sub-topics keyed by section_id (for sections not yet in progress)
  const [fetchedTopics, setFetchedTopics] = useState<Record<string, string[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Eagerly fetch sub-topics for all sections
  useEffect(() => {
    if (sections.length === 0) return
    sections.forEach(s => {
      // Skip if we already have saved teaching_points in progress
      const saved = progress.find(p => p.section_id === s.section_id)
      if (saved?.teaching_points && saved.teaching_points.length > 0) return
      fetch(`/api/teaching-points?moduleId=${moduleId}&sectionId=${s.section_id}`)
        .then(r => r.json() as Promise<{ points: string[] }>)
        .then(d => {
          if (d.points && d.points.length > 0) {
            setFetchedTopics(prev => ({ ...prev, [s.section_id]: d.points }))
          }
        })
        .catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, moduleId])

  // Auto-expand current section
  useEffect(() => {
    const cur = sections[currentIdx]
    if (cur) setExpanded(prev => new Set(prev).add(cur.section_id))
  }, [currentIdx, sections])

  const toggleExpand = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId)
      return next
    })
  }

  // A section is unlocked if it is the first, or if the previous section is completed
  function isSectionUnlocked(idx: number): boolean {
    if (idx === 0) return true
    const prev = sections[idx - 1]
    const prevProg = progress.find(p => p.section_id === prev.section_id)
    return prevProg?.status === 'completed'
  }

  return (
    <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
      {sections.map((s, i) => {
        const prog = progress.find(p => p.section_id === s.section_id)
        const st = prog?.status ?? 'not_started'
        const isCurrent = i === currentIdx
        const isDone = st === 'completed'
        const isExpanded = expanded.has(s.section_id)
        const isLocked = !isSectionUnlocked(i)

        // Prefer saved teaching_points (with done state), fall back to fetched titles
        const topics: TeachingPoint[] = prog?.teaching_points && prog.teaching_points.length > 0
          ? prog.teaching_points
          : (fetchedTopics[s.section_id] ?? []).map(t => ({ title: t, done: false }))
        const doneCount = topics.filter(t => t.done).length

        return (
          <div key={s.section_id}>
            {/* Section row */}
            <button onClick={() => !isLocked && onSelect(i)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 10, textAlign: 'left', transition: 'all 0.2s',
              cursor: isLocked ? 'default' : 'pointer',
              opacity: isLocked ? 0.4 : 1,
              background: isCurrent
                ? 'linear-gradient(135deg, rgba(0,255,255,0.12), rgba(166,0,255,0.12))'
                : isDone ? 'rgba(0,255,180,0.06)' : 'transparent',
              border: isCurrent
                ? '1px solid rgba(0,255,255,0.3)'
                : isDone ? '1px solid rgba(0,255,180,0.2)' : '1px solid transparent',
            }}>
              {/* Section ID badge */}
              <span style={{
                minWidth: 32, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0, fontFamily: 'monospace', padding: '0 4px',
                background: isCurrent ? '#00ffff22' : isDone ? '#00ffb322' : 'rgba(255,255,255,0.06)',
                border: isCurrent ? '1px solid #00ffff' : isDone ? '1px solid #00ffb3' : '1px solid rgba(255,255,255,0.15)',
                color: isCurrent ? '#00ffff' : isDone ? '#00ffb3' : 'rgba(255,255,255,0.4)',
              }}>
                {isLocked ? <Lock size={8} /> : isDone ? <Check size={9} /> : s.section_id}
              </span>
              {/* Title */}
              <span style={{
                flex: 1, fontSize: 11, lineHeight: 1.3,
                color: isCurrent ? '#e0ffff' : isDone ? 'rgba(0,255,180,0.8)' : 'rgba(255,255,255,0.45)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.section_title}
              </span>
              {/* Expand toggle — only show for unlocked sections */}
              {!isLocked && topics.length > 0 && (
                <span onClick={e => toggleExpand(s.section_id, e)} style={{
                  display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                  cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
                }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: isDone ? 'rgba(0,255,120,0.5)' : 'rgba(255,255,255,0.2)' }}>
                    {doneCount}/{topics.length}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={10} color="rgba(255,255,255,0.25)" />
                    : <ChevronDown size={10} color="rgba(255,255,255,0.25)" />}
                </span>
              )}
            </button>

            {/* Sub-topics list */}
            {!isLocked && isExpanded && topics.length > 0 && (
              <div style={{ marginLeft: 12, marginBottom: 4, borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {topics.map((pt, ti) => {
                  const isCurrentTopic = isCurrent && prog?.teaching_point_idx === ti && !pt.done
                  return (
                    <div key={ti} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '4px 6px', borderRadius: 6,
                      background: isCurrentTopic ? 'rgba(166,0,255,0.08)' : pt.done ? 'rgba(0,255,120,0.04)' : 'transparent',
                      border: isCurrentTopic ? '1px solid rgba(166,0,255,0.2)' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}>
                      {/* Check circle */}
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: pt.done ? 'rgba(0,255,120,0.18)' : isCurrentTopic ? 'rgba(166,0,255,0.2)' : 'rgba(255,255,255,0.05)',
                        border: pt.done ? '1px solid rgba(0,255,120,0.55)' : isCurrentTopic ? '1px solid rgba(166,0,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      }}>
                        {pt.done
                          ? <Check size={8} color="#00ff88" />
                          : <span style={{ fontSize: 6, color: isCurrentTopic ? '#d080ff' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{ti + 1}</span>
                        }
                      </div>
                      {/* Topic title */}
                      <span style={{
                        fontSize: 10, lineHeight: 1.4,
                        color: pt.done ? 'rgba(0,255,120,0.55)' : isCurrentTopic ? '#e0c0ff' : 'rgba(255,255,255,0.35)',
                        textDecoration: pt.done ? 'line-through' : 'none',
                      }}>
                        {pt.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Notes panel (dark glassmorphic) ─────────────────────────────────────────
function NotesPanel({
  section, progress, moduleId, onSave,
}: {
  section: Section | null
  progress: SectionProgress | null
  moduleId: string
  onSave: (notes: string, keyPoints: string[]) => void
}) {
  const [notes, setNotes] = useState(progress?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [kpOpen, setKpOpen] = useState(true)

  useEffect(() => { setNotes(progress?.notes ?? '') }, [progress])

  const save = async () => {
    if (!section) return
    setSaving(true)
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, sectionId: section.section_id, sectionTitle: section.section_title, notes, keyPoints: progress?.key_points ?? [], status: progress?.status ?? 'in_progress' }),
    })
    onSave(notes, progress?.key_points ?? [])
    setSaving(false)
  }

  const downloadNotes = () => {
    if (!section) return
    const text = [`Section ${section.section_id}: ${section.section_title}`, '─'.repeat(50), '', 'KEY POINTS (from Alex):', ...(progress?.key_points ?? []).map(p => `• ${p}`), '', 'MY NOTES:', notes].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `Section_${section.section_id}_notes.txt`; a.click(); URL.revokeObjectURL(url)
  }

  const glassPanel: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    borderRadius: 12,
    padding: '12px 14px',
  }

  if (!section) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: 20, textAlign: 'center' }}>
      Select a section to view notes
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 10px', gap: 10 }}>
      {/* Section header */}
      <div style={glassPanel}>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#00ffff', letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 4 }}>SECTION {section.section_id}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{section.section_title}</p>
      </div>

      {/* Key points */}
      {(progress?.key_points ?? []).length > 0 && (
        <div style={glassPanel}>
          <button onClick={() => setKpOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: kpOpen ? 8 : 0 }}>
            <Brain size={12} color="#a600ff" />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,255,255,0.8)', letterSpacing: '0.1em', flex: 1, textAlign: 'left' }}>KEY INSIGHTS</span>
            {kpOpen ? <ChevronUp size={11} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={11} color="rgba(255,255,255,0.3)" />}
          </button>
          {kpOpen && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(progress?.key_points ?? []).map((pt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(166,0,255,0.3)', border: '1px solid rgba(166,0,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#a600ff', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  {pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Notes textarea */}
      <div style={{ ...glassPanel, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'rgba(0,255,255,0.7)', letterSpacing: '0.1em' }}>
          <PenLine size={11} color="rgba(0,255,255,0.5)" /> MY NOTES
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={`Write your notes for section ${section.section_id}…`}
          style={{
            flex: 1, resize: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)',
            outline: 'none', lineHeight: 1.6, minHeight: 100,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,255,255,0.35)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={save} disabled={saving} style={{
          flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid rgba(0,255,255,0.3)',
          background: 'rgba(0,255,255,0.1)', color: '#00ffff', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} SAVE
        </button>
        <button onClick={downloadNotes} title="Download notes" style={{
          padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
        }}>
          <Download size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Section note-points panel (structured bullets for student note-taking) ───
function SectionNotePoints({ content }: { content: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const groups = extractNotePoints(content)

  const copyAll = () => {
    const lines: string[] = []
    for (const g of groups) {
      if (g.subHeading) lines.push(`\n▸ ${g.subHeading}`)
      for (const b of g.bullets) lines.push(`  • ${b}`)
    }
    void navigator.clipboard.writeText(lines.join('\n').trim()).then(() => {
      setCopied('all')
      setTimeout(() => setCopied(null), 1800)
    })
  }

  const copyBullet = (text: string) => {
    void navigator.clipboard.writeText(`• ${text}`).then(() => {
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  if (groups.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>
        No key points extracted yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PenLine size={11} color="rgba(0,255,255,0.6)" />
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(0,255,255,0.6)', letterSpacing: '0.15em', fontWeight: 700 }}>KEY POINTS TO NOTE</span>
        </div>
        <button onClick={copyAll} title="Copy all points" style={{
          background: copied === 'all' ? 'rgba(0,255,120,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${copied === 'all' ? 'rgba(0,255,120,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          fontSize: 9, fontFamily: 'monospace', color: copied === 'all' ? '#00ff88' : 'rgba(255,255,255,0.4)',
          letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4,
          transition: 'all 0.2s',
        }}>
          {copied === 'all' ? <Check size={9} /> : <Download size={9} />}
          {copied === 'all' ? 'COPIED' : 'COPY ALL'}
        </button>
      </div>

      {/* Bullet groups */}
      {groups.map((group, gi) => (
        <div key={gi} style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          {/* Sub-heading */}
          {group.subHeading && (
            <div style={{
              padding: '7px 12px',
              background: 'rgba(166,0,255,0.08)',
              borderBottom: '1px solid rgba(166,0,255,0.15)',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#c080ff', lineHeight: 1.3, fontFamily: 'monospace' }}>
                ▸ {group.subHeading}
              </span>
            </div>
          )}

          {/* Bullet list */}
          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {group.bullets.map((bullet, bi) => (
              <div key={bi}
                onClick={() => copyBullet(bullet)}
                title="Click to copy"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                  background: copied === bullet ? 'rgba(0,255,120,0.08)' : 'transparent',
                  border: `1px solid ${copied === bullet ? 'rgba(0,255,120,0.3)' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (copied !== bullet) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,255,0.05)' }}
                onMouseLeave={e => { if (copied !== bullet) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: copied === bullet ? '#00ff88' : '#00ffff',
                  boxShadow: copied === bullet ? '0 0 6px #00ff88' : '0 0 4px rgba(0,255,255,0.5)',
                  transition: 'all 0.2s',
                }} />
                <span style={{
                  fontSize: 11, lineHeight: 1.55,
                  color: copied === bullet ? 'rgba(0,255,120,0.9)' : 'rgba(255,255,255,0.7)',
                  flex: 1,
                }}>
                  {bullet}
                </span>
                {copied === bullet
                  ? <Check size={9} color="#00ff88" style={{ flexShrink: 0, marginTop: 4 }} />
                  : <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)', flexShrink: 0, marginTop: 5, fontFamily: 'monospace' }}>COPY</span>
                }
              </div>
            ))}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontFamily: 'monospace', letterSpacing: '0.08em', marginTop: 2 }}>
        CLICK ANY POINT TO COPY · ADD TO NOTES TAB
      </p>
    </div>
  )
}

// ─── Extract concise note-worthy bullet points from raw section content ───────
function extractNotePoints(content: string): { subHeading: string | null; bullets: string[] }[] {
  if (!content) return []

  // Split content by sub-section markers like [1.2.1 Title text]
  const subRe = /\[(\d+\.\d+\.\d+(?:\.\d+)?\s+[^\]]{2,80})\]/g
  const parts: { heading: string | null; text: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = subRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ heading: null, text: content.slice(lastIndex, match.index) })
    }
    const headingStart = match.index + match[0].length
    lastIndex = headingStart
    // peek ahead to next marker for text
    const nextMatch = subRe.exec(content)
    if (nextMatch) {
      parts.push({ heading: match[1].trim(), text: content.slice(headingStart, nextMatch.index) })
      lastIndex = nextMatch.index
      subRe.lastIndex = nextMatch.index
    } else {
      parts.push({ heading: match[1].trim(), text: content.slice(headingStart) })
      lastIndex = content.length
    }
  }
  if (lastIndex < content.length) parts.push({ heading: null, text: content.slice(lastIndex) })

  // If no sub-markers found treat whole content as one block
  if (parts.length === 0) parts.push({ heading: null, text: content })

  return parts.map(part => {
    const raw = part.text.replace(/\s+/g, ' ').trim()
    // Extract sentences that are short enough to be useful bullet points (15–160 chars)
    const sentences = raw.match(/[^.!?]+[.!?]/g) ?? []
    const bullets = sentences
      .map(s => s.trim())
      .filter(s => s.length >= 15 && s.length <= 180)
      .filter(s => !/^(the|a|an|this|that|these|those|it|in|at|on|for|and|or)\b/i.test(s))
      .slice(0, 5)
    return { subHeading: part.heading, bullets }
  }).filter(p => p.bullets.length > 0 || p.subHeading !== null)
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,255,255,0.15)', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#00ffff', flexShrink: 0 }}>A</div>
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ffff', display: 'inline-block', animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
        </div>
      </div>
      <style>{`@keyframes typingPulse { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}

// ─── Quiz modal (dark glassmorphic) ──────────────────────────────────────────
function QuizModal({ moduleId, moduleTitle, partNumber, partTitle, onClose, onComplete }: {
  moduleId: string; moduleTitle: string; partNumber: number; partTitle: string
  onClose: () => void; onComplete: (passed: boolean, score: number) => void
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{
    score: number; total: number; percentage: number; passed: boolean
    weakAreas: string[]
    explanations: Record<string, { correct: string; explanation: string; userAnswer: string }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, moduleTitle, partNumber, partTitle, count: 5 }) })
      .then(r => r.json() as Promise<{ questions: QuizQuestion[] }>)
      .then(d => { setQuestions(d.questions ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [moduleId, moduleTitle, partNumber, partTitle])

  async function handleSubmit() {
    setSubmitting(true)
    const res = await fetch('/api/quiz/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, answers, questions }) })
    const data = await res.json() as typeof result
    setResult(data); setSubmitting(false)
    if (data) onComplete(data.passed, data.percentage)
  }

  const glass: React.CSSProperties = {
    background: 'rgba(10,8,25,0.92)',
    border: '1px solid rgba(0,255,255,0.15)',
    backdropFilter: 'blur(40px)',
    borderRadius: 20,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ ...glass, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgba(166,0,255,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={18} color="#00ffff" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e0ffff' }}>Knowledge Check</p>
              <p style={{ fontSize: 10, color: 'rgba(0,255,255,0.5)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{moduleTitle}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Loader2 size={28} color="#00ffff" className="animate-spin" /></div>}
          {!loading && result && (
            <div style={{ borderRadius: 14, padding: '18px 20px', background: result.passed ? 'rgba(0,255,120,0.08)' : 'rgba(255,60,60,0.08)', border: `1px solid ${result.passed ? 'rgba(0,255,120,0.3)' : 'rgba(255,60,60,0.3)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {result.passed ? <CheckCircle2 size={20} color="#00ff88" /> : <XCircle size={20} color="#ff4444" />}
                <p style={{ fontWeight: 700, color: result.passed ? '#00ff88' : '#ff6666', fontSize: 15 }}>{result.passed ? `Passed — ${result.percentage}%` : `Not yet — ${result.percentage}%`}</p>
              </div>
              {result.weakAreas.length > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Revisit: {result.weakAreas.join(', ')}</p>}
            </div>
          )}
          {!loading && !result && questions.map((q, qi) => (
            <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500, lineHeight: 1.5 }}>{qi + 1}. {q.question}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.options.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', background: answers[q.id] === opt ? 'rgba(0,255,255,0.1)' : 'rgba(255,255,255,0.03)', border: answers[q.id] === opt ? '1px solid rgba(0,255,255,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers(p => ({ ...p, [q.id]: opt }))} style={{ marginTop: 2, accentColor: '#00ffff' }} />
                    <span style={{ fontSize: 12, color: answers[q.id] === opt ? '#e0ffff' : 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{opt}</span>
                  </label>
                ))}
              </div>
              {result?.explanations[q.id] && (
                <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 11, lineHeight: 1.5, background: answers[q.id] === result.explanations[q.id].correct ? 'rgba(0,255,120,0.08)' : 'rgba(255,60,60,0.08)', color: answers[q.id] === result.explanations[q.id].correct ? '#00ff88' : '#ff8888', border: `1px solid ${answers[q.id] === result.explanations[q.id].correct ? 'rgba(0,255,120,0.2)' : 'rgba(255,60,60,0.2)'}` }}>
                  <strong>Correct: {result.explanations[q.id].correct}</strong> — {result.explanations[q.id].explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {!result ? (
            <>
              <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || Object.keys(answers).length < questions.length} style={{ padding: '9px 22px', borderRadius: 10, background: 'rgba(0,255,255,0.15)', border: '1px solid rgba(0,255,255,0.4)', color: '#00ffff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (submitting || Object.keys(answers).length < questions.length) ? 0.4 : 1 }}>
                {submitting && <Loader2 size={14} className="animate-spin" />} Submit
              </button>
            </>
          ) : (
            <button onClick={onClose} style={{ padding: '9px 22px', borderRadius: 10, background: result.passed ? 'rgba(0,255,120,0.15)' : 'rgba(255,60,60,0.1)', border: `1px solid ${result.passed ? 'rgba(0,255,120,0.4)' : 'rgba(255,60,60,0.3)'}`, color: result.passed ? '#00ff88' : '#ff8888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {result.passed ? 'Continue learning →' : 'Try again later'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CourseModulePage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = params.moduleId as string
  const supabase = createClientComponentClient()

  // Module meta
  const [moduleTitle, setModuleTitle] = useState(moduleId.toUpperCase())
  const [partNumber, setPartNumber] = useState(1)
  const [partTitle, setPartTitle] = useState('')
  const [moduleLoaded, setModuleLoaded] = useState(false)
  const [nextModule, setNextModule] = useState<string | null>(null)

  // Sections
  const [sections, setSections] = useState<Section[]>([])
  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const currentSection = sections[currentSectionIdx] ?? null

  // Section progress & notes
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([])
  const currentProgress = sectionProgress.find(p => p.section_id === currentSection?.section_id) ?? null

  // Section content (from course_chunks)
  const [sectionContent, setSectionContent] = useState<string>('')
  const [rightTab, setRightTab] = useState<'notes' | 'content'>('content')

  // Chat
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [exchangeCount, setExchangeCount] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizPassed, setQuizPassed] = useState(false)
  // True if this module was already completed before this session (allows forward nav without re-quiz)
  const [moduleAlreadyCompleted, setModuleAlreadyCompleted] = useState(false)

  // Audio
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [micActive, setMicActive] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userActivated, setUserActivated] = useState(false)

  // Key points being built from current session
  const [sessionKeyPoints, setSessionKeyPoints] = useState<string[]>([])

  // Teaching points for current section (title + done flag)
  const [teachingPoints, setTeachingPoints] = useState<TeachingPoint[]>([])
  const [currentPointIdx, setCurrentPointIdx] = useState(0)
  const teachingPointsRef = useRef<TeachingPoint[]>([])
  const currentPointIdxRef = useRef(0)
  useEffect(() => { teachingPointsRef.current = teachingPoints }, [teachingPoints])
  useEffect(() => { currentPointIdxRef.current = currentPointIdx }, [currentPointIdx])

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])
  const streamingRef = useRef(false)
  const sessionIdRef = useRef<string | undefined>()
  const moduleTitleRef = useRef(moduleId.toUpperCase())
  const partNumberRef = useRef(1)
  const partTitleRef = useRef('')
  const audioEnabledRef = useRef(true)
  const speechBufferRef = useRef('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const hasAutoStarted = useRef(false)
  const micActiveRef = useRef(false)
  const autoMicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startMicRef = useRef<() => void>(() => {})
  const speakTextRef = useRef<(text: string) => void>(() => {})
  const isAudioPlayingRef = useRef(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const currentSectionRef = useRef<Section | null>(null)
  const completedSectionsRef = useRef<string[]>([])

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { streamingRef.current = streaming }, [streaming])
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  useEffect(() => { moduleTitleRef.current = moduleTitle }, [moduleTitle])
  useEffect(() => { partNumberRef.current = partNumber }, [partNumber])
  useEffect(() => { partTitleRef.current = partTitle }, [partTitle])
  useEffect(() => { audioEnabledRef.current = audioEnabled }, [audioEnabled])
  useEffect(() => { micActiveRef.current = micActive }, [micActive])
  useEffect(() => { currentSectionRef.current = currentSection }, [currentSection])
  useEffect(() => {
    completedSectionsRef.current = sectionProgress.filter(p => p.status === 'completed').map(p => p.section_id)
  }, [sectionProgress])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

  // ─── Audio (Web Speech API) ───────────────────────────────────────────────
  const initAudioCtx = useCallback(() => { /* no-op: using Web Speech API */ }, [])

  const speakText = useCallback((text: string) => {
    if (!audioEnabledRef.current) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    // Stop mic while bot is speaking to prevent feedback loop
    if (micActiveRef.current) { recognitionRef.current?.stop(); setMicActive(false) }
    isAudioPlayingRef.current = true
    setIsSpeaking(true)
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-GB'
    utt.rate = 1.05
    const voices = window.speechSynthesis.getVoices()
    const gb = voices.find(v => v.lang === 'en-GB') ?? voices.find(v => v.lang.startsWith('en'))
    if (gb) utt.voice = gb
    utt.onend = () => { isAudioPlayingRef.current = false; setIsSpeaking(false) }
    utt.onerror = () => { isAudioPlayingRef.current = false; setIsSpeaking(false) }
    window.speechSynthesis.speak(utt)
  }, [])

  const cancelSpeech = useCallback(() => {
    isAudioPlayingRef.current = false
    setIsSpeaking(false)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    speechBufferRef.current = ''
  }, [])

  const feedToken = useCallback((token: string) => {
    if (!audioEnabledRef.current) return
    speechBufferRef.current += token
    const sm = speechBufferRef.current.match(/^([\s\S]*[.!?])\s+(.*)/)
    if (sm) { speakText(sm[1]); speechBufferRef.current = sm[2]; return }
    const cm = speechBufferRef.current.match(/^((?:\S+\s+){5,}[\s\S]*?[,;:])\s+(.*)/)
    if (cm) { speakText(cm[1]); speechBufferRef.current = cm[2] }
  }, [speakText])

  const flushSpeech = useCallback(() => {
    const r = speechBufferRef.current.trim()
    if (audioEnabledRef.current && r) speakText(r)
    speechBufferRef.current = ''
  }, [speakText])

  useEffect(() => { speakTextRef.current = speakText }, [speakText])
  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])

  // ─── Core send ────────────────────────────────────────────────────────────
  const doSend = useCallback(async (text: string, silent: boolean) => {
    if (streamingRef.current) return
    if (autoMicTimerRef.current) { clearTimeout(autoMicTimerRef.current); autoMicTimerRef.current = null }
    if (micActiveRef.current) { recognitionRef.current?.stop(); setMicActive(false) }
    cancelSpeech(); setStreaming(true)

    if (!silent) {
      setExchangeCount(n => n + 1)
      setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }])
    }
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date().toISOString() }])

    try {
      const pts = teachingPointsRef.current
      const ptIdx = currentPointIdxRef.current
      const currentPoint = pts[ptIdx] ?? null

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          moduleId,
          sessionId: sessionIdRef.current,
          moduleTitle: moduleTitleRef.current,
          partNumber: partNumberRef.current,
          partTitle: partTitleRef.current,
          currentSection: currentSectionRef.current,
          completedSections: completedSectionsRef.current,
          teachingPointIdx: ptIdx,
          teachingPointTitle: currentPoint?.title ?? null,
          totalTeachingPoints: pts.length,
        }),
      })
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ''
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n'); lineBuffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const p = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; sessionId?: string }
            if (p.token) {
              fullResponse += p.token
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + p.token }
                return u
              })
              feedToken(p.token)
            }
            if (p.sessionId) setSessionId(p.sessionId)
            if (p.done) flushSpeech()
          } catch { /* ignore */ }
        }
      }
      flushSpeech()

      // Extract key points from response (sentences as bullet points)
      if (!silent && fullResponse.trim()) {
        const sentences = fullResponse.match(/[^.!?]+[.!?]/g) ?? []
        const points = sentences.map(s => s.trim()).filter(s => s.length > 20 && s.length < 200).slice(0, 3)
        if (points.length > 0) {
          setSessionKeyPoints(prev => {
            const combined = [...new Set([...prev, ...points])].slice(0, 10)
            // Auto-save key points
            if (currentSectionRef.current) {
              void fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  moduleId,
                  sectionId: currentSectionRef.current.section_id,
                  sectionTitle: currentSectionRef.current.section_title,
                  keyPoints: combined,
                  status: 'in_progress',
                }),
              })
            }
            return combined
          })
          setSectionProgress(prev => {
            const existing = prev.find(p => p.section_id === currentSectionRef.current?.section_id)
            if (!existing || !currentSectionRef.current) return prev
            return prev.map(p => p.section_id === currentSectionRef.current!.section_id
              ? { ...p, key_points: [...new Set([...p.key_points, ...points])].slice(0, 10) }
              : p)
          })
        }
      }

      // Detect if Alex just finished teaching a point (signals "next" or "let's move on")
      if (!silent && fullResponse.trim()) {
        const lower = fullResponse.toLowerCase()
        const pointDoneSignals = ['let\'s move on', 'moving on', 'next topic', 'next point', 'now let\'s look at', 'now we\'ll cover', 'shall we move', 'ready to move']
        const signalledDone = pointDoneSignals.some(s => lower.includes(s))
        if (signalledDone) {
          const pts = teachingPointsRef.current
          const idx = currentPointIdxRef.current
          if (idx < pts.length) {
            const updated = pts.map((p, i) => i === idx ? { ...p, done: true } : p)
            setTeachingPoints(updated)
            const nextIdx = Math.min(idx + 1, pts.length - 1)
            setCurrentPointIdx(nextIdx)
            // Persist teaching progress
            if (currentSectionRef.current) {
              void fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  moduleId,
                  sectionId: currentSectionRef.current.section_id,
                  sectionTitle: currentSectionRef.current.section_title,
                  status: 'in_progress',
                  teachingPointIdx: nextIdx,
                  teachingPoints: updated,
                }),
              })
            }
          }
        }
      }

      // Auto-mic scheduling
      const scheduleAutoMic = () => {
        if (micActiveRef.current || streamingRef.current) return
        if (isAudioPlayingRef.current) { autoMicTimerRef.current = setTimeout(scheduleAutoMic, 200); return }
        startMicRef.current()
      }
      autoMicTimerRef.current = setTimeout(scheduleAutoMic, 400)
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length-1] = { ...u[u.length-1], content: 'Sorry, something went wrong. Please try again.' }; return u })
    } finally {
      setStreaming(false)
    }
  }, [moduleId, cancelSpeech, feedToken, flushSpeech])

  // ─── Load module + sections ───────────────────────────────────────────────
  useEffect(() => {
    const num = parseInt(moduleId.replace('m', ''), 10)
    if (num < 87) setNextModule(`m${String(num + 1).padStart(2, '0')}`)

    Promise.all([
      fetch(`/api/module-meta?moduleId=${moduleId}`).then(r => r.json() as Promise<{ module_title: string; part_number: number; part_title: string } | null>),
      fetch('/api/progress').then(r => r.json() as Promise<{ completedModules: string[] }>),
    ]).then(([meta, prog]) => {
      if (meta) {
        setModuleTitle(meta.module_title ?? moduleId.toUpperCase())
        setPartNumber(meta.part_number ?? 1)
        setPartTitle(meta.part_title ?? '')
      }
      if (prog?.completedModules?.includes(moduleId)) {
        setModuleAlreadyCompleted(true)
      }
      setModuleLoaded(true)
    }).catch(() => { setModuleLoaded(true) })
  }, [moduleId])

  // Load sections for this module
  useEffect(() => {
    fetch(`/api/sections?moduleId=${moduleId}`)
      .then(r => r.json() as Promise<{ sections: Section[] }>)
      .then(d => {
        if (d.sections && d.sections.length > 0) setSections(d.sections)
        setSectionsLoaded(true)
      })
      .catch(() => { setSectionsLoaded(true) })
  }, [moduleId])

  // Load saved section progress
  useEffect(() => {
    fetch(`/api/notes?moduleId=${moduleId}`)
      .then(r => r.json() as Promise<{ progress: SectionProgress[] }>)
      .then(d => {
        if (d.progress) setSectionProgress(d.progress)
      })
      .catch(() => {})
  }, [moduleId])

  // Load teaching points for current section from Supabase chunks
  useEffect(() => {
    if (!currentSection) return
    // Restore saved progress first
    const saved = sectionProgress.find(p => p.section_id === currentSection.section_id)
    if (saved?.teaching_points && saved.teaching_points.length > 0) {
      setTeachingPoints(saved.teaching_points)
      setCurrentPointIdx(saved.teaching_point_idx ?? 0)
      return
    }
    // Fetch chunk content to extract teaching point titles
    void fetch(`/api/teaching-points?moduleId=${moduleId}&sectionId=${currentSection.section_id}`)
      .then(r => r.json() as Promise<{ points: string[] }>)
      .then(d => {
        if (d.points && d.points.length > 0) {
          setTeachingPoints(d.points.map(t => ({ title: t, done: false })))
          setCurrentPointIdx(0)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.section_id, moduleId])

  // Sync session key points to current section progress
  useEffect(() => {
    if (sessionKeyPoints.length > 0 && currentSection) {
      setSectionProgress(prev => {
        const exists = prev.find(p => p.section_id === currentSection.section_id)
        if (exists) return prev.map(p => p.section_id === currentSection.section_id
          ? { ...p, key_points: sessionKeyPoints } : p)
        return [...prev, {
          section_id: currentSection.section_id,
          section_title: currentSection.section_title,
          status: 'in_progress',
          notes: '',
          key_points: sessionKeyPoints,
        }]
      })
    }
  }, [sessionKeyPoints, currentSection])

  // No auto-start — student initiates the conversation

  // When section changes mid-session, reset chat and start new section
  // Load content for the current section
  useEffect(() => {
    if (!currentSection) return
    setSectionContent('')
    fetch(`/api/section-content?moduleId=${moduleId}&sectionId=${encodeURIComponent(currentSection.section_id)}`)
      .then(r => r.json() as Promise<{ content: string }>)
      .then(d => { if (d.content) setSectionContent(d.content) })
      .catch(() => {})
  }, [currentSection, moduleId])

  const switchSection = useCallback((idx: number) => {
    if (idx === currentSectionIdx) return
    setCurrentSectionIdx(idx)
    setMessages([])
    setSessionKeyPoints([])
    setTeachingPoints([])
    setCurrentPointIdx(0)
    hasAutoStarted.current = false
    cancelSpeech()
  }, [currentSectionIdx, cancelSpeech])

  // Mark current section as complete and advance
  const completeSection = useCallback(() => {
    if (!currentSection) return
    setSectionProgress(prev => {
      const exists = prev.find(p => p.section_id === currentSection.section_id)
      const updated: SectionProgress = exists
        ? { ...exists, status: 'completed' }
        : { section_id: currentSection.section_id, section_title: currentSection.section_title, status: 'completed', notes: '', key_points: sessionKeyPoints }
      void fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, sectionId: currentSection.section_id, sectionTitle: currentSection.section_title, status: 'completed', keyPoints: sessionKeyPoints }),
      })
      return exists ? prev.map(p => p.section_id === currentSection.section_id ? updated : p) : [...prev, updated]
    })
    if (currentSectionIdx < sections.length - 1) switchSection(currentSectionIdx + 1)
  }, [currentSection, currentSectionIdx, sections.length, switchSection, sessionKeyPoints, moduleId])

  // ─── Mic ─────────────────────────────────────────────────────────────────
  const startMicImpl = useCallback(() => {
    if (micActiveRef.current || streamingRef.current) return
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = 'en-GB'; rec.continuous = false; rec.interimResults = true
    let gotFinal = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>).map(r => r[0].transcript).join('')
      setInput(t)
      if ((e.results as ArrayLike<{ isFinal: boolean }>)[e.results.length-1].isFinal) {
        gotFinal = true; setMicActive(false); setInput('')
        if (t.trim()) void doSend(t.trim(), false)
      }
    }
    const restart = (ms: number) => {
      if (streamingRef.current || isAudioPlayingRef.current) return
      autoMicTimerRef.current = setTimeout(() => {
        // Double-check audio is still silent before restarting
        if (!streamingRef.current && !isAudioPlayingRef.current) startMicRef.current()
      }, ms)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => { setMicActive(false); if (e.error === 'no-speech' || e.error === 'audio-capture') restart(500) }
    rec.onend = () => { setMicActive(false); if (!gotFinal) restart(300) }
    rec.start(); recognitionRef.current = rec; setMicActive(true)
  }, [doSend])

  useEffect(() => { startMicRef.current = startMicImpl }, [startMicImpl])

  const toggleMic = useCallback(() => {
    if (micActive) { recognitionRef.current?.stop(); setMicActive(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
      alert('Speech recognition not supported. Try Chrome or Edge.')
      return
    }
    startMicImpl()
  }, [micActive, startMicImpl])

  const completedCount = sectionProgress.filter(p => p.status === 'completed').length
  const totalSections = sections.length
  const progressPct = totalSections > 0 ? Math.round(completedCount / totalSections * 100) : 0
  // Can navigate forward only if quiz was passed this session OR module was already completed
  const canGoNext = quizPassed || moduleAlreadyCompleted

  // panel visibility toggles
  const [showSections, setShowSections] = useState(true)
  const [showNotes, setShowNotes] = useState(true)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#020206',
      backgroundImage: 'radial-gradient(ellipse at 50% 35%, #0f0528 0%, #020206 65%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── Ambient glow backdrop ── */}
      <div style={{ position: 'absolute', width: 600, height: 600, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(166,0,255,0.12) 0%, rgba(0,255,255,0.04) 55%, transparent 75%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Top HUD bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', flexShrink: 0, zIndex: 10,
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Left: back + module */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={16} /><span style={{ fontSize: 11, letterSpacing: '0.08em' }}>BACK</span>
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <p style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.18em', color: 'rgba(0,255,255,0.6)' }}>PART {partNumber} · {moduleId.toUpperCase()}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 1, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{moduleTitle}</p>
          </div>
        </div>

        {/* Center: progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(0,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 4 }}>PROGRESS // {completedCount}/{totalSections}</p>
            <div style={{ width: 180, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #00ffff, #a600ff)', borderRadius: 99, transition: 'width 0.5s ease', boxShadow: '0 0 8px #00ffff' }} />
            </div>
          </div>
          {currentSection && (
            <div style={{ background: 'rgba(0,255,255,0.08)', border: '1px solid rgba(0,255,255,0.2)', borderRadius: 8, padding: '4px 10px' }}>
              <p style={{ fontSize: 10, color: '#00ffff', fontFamily: 'monospace', letterSpacing: '0.1em' }}>§ {currentSection.section_id}</p>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setAudioEnabled(v => !v); if (audioEnabled) cancelSpeech() }} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${audioEnabled ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`, color: audioEnabled ? '#00ffff' : 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>{audioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
          </button>
          {currentSection && currentSectionIdx < sections.length - 1 && (
            <button onClick={completeSection} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(0,255,120,0.12)', border: '1px solid rgba(0,255,120,0.35)', color: '#00ff88', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Check size={12} /> SECTION COMPLETE
            </button>
          )}
          {exchangeCount >= 4 && (
            <button onClick={() => setShowQuiz(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(166,0,255,0.15)', border: '1px solid rgba(166,0,255,0.4)', color: '#d080ff', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Brain size={12} /> QUIZ
            </button>
          )}
          {canGoNext && nextModule && (
            <button onClick={() => router.push(`/course/${nextModule}`)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(0,255,120,0.15)', border: '1px solid rgba(0,255,120,0.4)', color: '#00ff88', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              NEXT MODULE <ChevronRight size={12} />
            </button>
          )}
          {!canGoNext && nextModule && exchangeCount > 0 && (
            <div title="Pass the quiz to unlock next module" style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Lock size={10} /> NEXT MODULE
            </div>
          )}
          {/* Panel toggles */}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <button onClick={() => setShowSections(v => !v)} title="Toggle sections" style={{ padding: '6px 8px', borderRadius: 8, background: showSections ? 'rgba(0,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${showSections ? 'rgba(0,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`, color: showSections ? '#00ffff' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setShowNotes(v => !v)} title="Toggle notes" style={{ padding: '6px 8px', borderRadius: 8, background: showNotes ? 'rgba(0,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${showNotes ? 'rgba(0,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`, color: showNotes ? '#00ffff' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Main 3-col layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 5 }}>

        {/* ── COL 1: Sections ── */}
        {showSections && (
          <div style={{
            width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
            background: 'rgba(255,255,255,0.015)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Section trail header */}
            <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(0,255,255,0.45)', letterSpacing: '0.18em' }}>COURSE SECTIONS</p>
            </div>

            {/* Section list */}
            {sections.length > 0 ? (
              <SectionTrail sections={sections} currentIdx={currentSectionIdx} progress={sectionProgress} moduleId={moduleId} onSelect={switchSection} />
            ) : !sectionsLoaded ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <Loader2 size={18} color="rgba(0,255,255,0.4)" className="animate-spin" />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Loading…</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '0 12px' }}>No sections found for this module</p>
              </div>
            )}

            {/* Teaching points for current section */}
            {teachingPoints.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(166,0,255,0.7)', letterSpacing: '0.18em' }}>TOPICS</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                    {teachingPoints.filter(p => p.done).length}/{teachingPoints.length}
                  </p>
                </div>
                <div style={{ padding: '2px 8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {teachingPoints.map((pt, i) => {
                    const isCurrent = i === currentPointIdx && !pt.done
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 8px', borderRadius: 8,
                        background: isCurrent ? 'rgba(166,0,255,0.1)' : 'transparent',
                        border: isCurrent ? '1px solid rgba(166,0,255,0.25)' : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: pt.done ? 'rgba(0,255,120,0.15)' : isCurrent ? 'rgba(166,0,255,0.2)' : 'rgba(255,255,255,0.05)',
                          border: pt.done ? '1px solid rgba(0,255,120,0.5)' : isCurrent ? '1px solid rgba(166,0,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        }}>
                          {pt.done
                            ? <Check size={9} color="#00ff88" />
                            : <span style={{ fontSize: 7, color: isCurrent ? '#d080ff' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{i + 1}</span>
                          }
                        </div>
                        <span style={{
                          fontSize: 10, lineHeight: 1.4,
                          color: pt.done ? 'rgba(0,255,120,0.6)' : isCurrent ? '#e0c0ff' : 'rgba(255,255,255,0.35)',
                          textDecoration: pt.done ? 'line-through' : 'none',
                        }}>
                          {pt.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Module nav */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              <button onClick={() => { const n = parseInt(moduleId.replace('m',''),10); if(n>1) router.push(`/course/m${String(n-1).padStart(2,'0')}`) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                <ChevronLeft size={13} /> PREV
              </button>
              {nextModule && (
                canGoNext ? (
                  <button onClick={() => router.push(`/course/${nextModule}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                    NEXT <ChevronRight size={13} />
                  </button>
                ) : (
                  <span title="Pass the quiz to unlock" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                    <Lock size={10} /> NEXT
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* ── COL 2: Orb (top centre) + Chat (below) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

          {/* ── ORB ZONE — centred at top ── */}
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: 18, paddingBottom: 10,
            background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(0,255,255,0.04) 0%, transparent 70%)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
          }}>
            {/* Section label above orb */}
            {currentSection && (
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSpeaking ? '#00ffff' : 'rgba(0,255,255,0.3)', boxShadow: isSpeaking ? '0 0 8px #00ffff' : 'none', transition: 'all 0.3s' }} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
                  <span style={{ color: '#00ffff', marginRight: 6 }}>§{currentSection.section_id}</span>
                  {currentSection.section_title}
                </p>
              </div>
            )}

            {/* Orb — large, clickable to activate */}
            {!userActivated ? (
              <button onClick={() => { initAudioCtx(); setUserActivated(true); const last = [...messagesRef.current].reverse().find(m => m.role === 'assistant' && m.content.trim()); if (last) setTimeout(() => speakTextRef.current(last.content), 100) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <AudioOrb speaking={false} analyser={null} />
                <p style={{ fontSize: 10, color: '#a600ff', fontFamily: 'monospace', letterSpacing: '0.15em', marginTop: 4, animation: 'tapPulse 1.5s ease-in-out infinite' }}>▶ TAP TO START</p>
              </button>
            ) : (
              <AudioOrb speaking={isSpeaking} analyser={analyserRef.current} />
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.length === 0 && !streaming && userActivated && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#00ffff' }}>A</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 260 }}>
                    Hi, I&apos;m Alex — your AI tutor.<br />
                    Ask me anything about <span style={{ color: '#00ffff' }}>{currentSection?.section_title ?? moduleTitle}</span>, or say &ldquo;let&apos;s start&rdquo; to begin.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,255,255,0.12)', border: '1px solid rgba(0,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#00ffff', flexShrink: 0 }}>A</div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '11px 16px', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, rgba(166,0,255,0.25), rgba(0,85,255,0.2))'
                    : 'rgba(255,255,255,0.04)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(166,0,255,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: msg.role === 'user' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: msg.role === 'assistant' && isSpeaking && i === messages.length - 1
                    ? '0 0 20px rgba(0,255,255,0.08)' : 'none',
                }}>
                  {msg.content || (msg.role === 'assistant' && <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>…</span>)}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length-1]?.role !== 'assistant' && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '12px 20px', flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = input.trim(); if (!t || streamingRef.current) return; setInput(''); void doSend(t, false) } }}
                disabled={streaming} rows={1}
                placeholder={micActive ? '// LISTENING…' : `Ask about ${currentSection?.section_id ?? 'this module'}…`}
                style={{
                  flex: 1, resize: 'none', background: micActive ? 'rgba(255,60,60,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${micActive ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 12, padding: '11px 16px', fontSize: 13, color: 'rgba(255,255,255,0.85)',
                  outline: 'none', maxHeight: 120, lineHeight: 1.5, fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { if (!micActive) e.currentTarget.style.borderColor = 'rgba(0,255,255,0.35)' }}
                onBlur={e => { if (!micActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              />
              <button onClick={toggleMic} disabled={streaming} style={{
                width: 42, height: 42, borderRadius: 12, border: `1px solid ${micActive ? 'rgba(255,60,60,0.5)' : 'rgba(255,255,255,0.12)'}`,
                background: micActive ? 'rgba(255,60,60,0.15)' : 'rgba(255,255,255,0.04)',
                color: micActive ? '#ff6060' : 'rgba(255,255,255,0.5)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                animation: micActive ? 'tapPulse 1s ease-in-out infinite' : 'none',
              }}>
                {micActive ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button onClick={() => { const t = input.trim(); if (!t || streamingRef.current) return; setInput(''); void doSend(t, false) }}
                disabled={streaming || !input.trim()} style={{
                  width: 42, height: 42, borderRadius: 12, border: '1px solid rgba(0,255,255,0.3)',
                  background: 'rgba(0,255,255,0.12)', color: '#00ffff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  opacity: (streaming || !input.trim()) ? 0.35 : 1, transition: 'opacity 0.2s',
                }}>
                {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            {micActive && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6060', display: 'inline-block', animation: 'tapPulse 0.8s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,96,96,0.8)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>LISTENING…</span>
              </div>
            )}
          </div>
        </div>

        {/* ── COL 3: Content + Notes ── */}
        {showNotes && (
          <div style={{
            width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
            background: 'rgba(255,255,255,0.015)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              {(['content', 'notes'] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)} style={{
                  flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 700,
                  color: rightTab === tab ? '#00ffff' : 'rgba(255,255,255,0.3)',
                  borderBottom: rightTab === tab ? '2px solid #00ffff' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {tab === 'content' ? 'CONTENT' : 'NOTES'}
                </button>
              ))}
            </div>

            {rightTab === 'content' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                {currentSection && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#00ffff', letterSpacing: '0.15em', marginBottom: 4 }}>§{currentSection.section_id}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: 12 }}>{currentSection.section_title}</p>
                    {/* Mark done button */}
                    {currentProgress?.status !== 'completed' ? (
                      <button onClick={completeSection} style={{
                        width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid rgba(0,255,120,0.35)',
                        background: 'rgba(0,255,120,0.08)', color: '#00ff88', fontSize: 11, fontWeight: 700,
                        fontFamily: 'monospace', letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12,
                      }}>
                        <Check size={12} /> MARK AS DONE
                      </button>
                    ) : (
                      <div style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid rgba(0,255,120,0.25)', background: 'rgba(0,255,120,0.06)', color: 'rgba(0,255,120,0.7)', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12 }}>
                        <CheckCircle2 size={12} /> COMPLETED
                      </div>
                    )}
                  </div>
                )}
                {sectionContent ? (
                  <SectionNotePoints content={sectionContent} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, flexDirection: 'column', gap: 8 }}>
                    <Loader2 size={16} color="rgba(0,255,255,0.3)" className="animate-spin" />
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Loading content…</p>
                  </div>
                )}
              </div>
            ) : (
              <NotesPanel
                section={currentSection}
                progress={currentProgress}
                moduleId={moduleId}
                onSave={(notes, kp) => {
                  setSectionProgress(prev => {
                    const exists = prev.find(p => p.section_id === currentSection?.section_id)
                    if (!exists || !currentSection) return prev
                    return prev.map(p => p.section_id === currentSection.section_id ? { ...p, notes, key_points: kp } : p)
                  })
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Quiz modal */}
      {showQuiz && (
        <QuizModal moduleId={moduleId} moduleTitle={moduleTitle} partNumber={partNumber} partTitle={partTitle}
          onClose={() => setShowQuiz(false)}
          onComplete={(passed) => { setQuizPassed(passed); setShowQuiz(false) }}
        />
      )}

      <style>{`@keyframes tapPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  )
}
