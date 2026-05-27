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
void PART_TITLES

// ─── Aurora Wave Orb (canvas, speech-reactive) ────────────────────────────────
function AudioOrb({ speaking, analyser }: { speaking: boolean; analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<number>(0)
  const freqData  = useRef<Uint8Array | null>(null)
  const energyRef = useRef({ bass: 0, mid: 0, high: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const DPR  = window.devicePixelRatio || 1
    const SIZE = 220
    canvas.width  = SIZE * DPR
    canvas.height = SIZE * DPR
    ctx.scale(DPR, DPR)
    const CX = SIZE / 2
    const CY = SIZE / 2

    // Aurora wave rings — replaces torus-knot with concentric aurora bands
    const RINGS        = 14
    const WAVE_POINTS  = 180
    const BASE_R       = 30
    const RING_SPACING = 6.5

    // Aurora colour palette (hue rotation range)
    const AURORA_HUES = [175, 200, 240, 270, 300, 320] // cyan→violet→magenta

    const tick = (time: number) => {
      const t = time * 0.001

      // Read audio energy
      let rawBass = 0, rawMid = 0, rawHigh = 0
      if (analyser && speaking) {
        const bins = analyser.frequencyBinCount
        if (!freqData.current || freqData.current.length !== bins) {
          freqData.current = new Uint8Array(bins)
        }
        analyser.getByteFrequencyData(freqData.current as Uint8Array<ArrayBuffer>)
        const d = freqData.current
        for (let i = 0; i < Math.floor(bins * 0.12); i++) rawBass += d[i]
        for (let i = Math.floor(bins * 0.12); i < Math.floor(bins * 0.45); i++) rawMid  += d[i]
        for (let i = Math.floor(bins * 0.45); i < Math.floor(bins * 0.8);  i++) rawHigh += d[i]
        rawBass /= Math.floor(bins * 0.12) * 255
        rawMid  /= Math.floor(bins * 0.33) * 255
        rawHigh /= Math.floor(bins * 0.35) * 255
      }

      // Smooth
      const LERP = speaking ? 0.2 : 0.05
      const e = energyRef.current
      e.bass = e.bass + (rawBass - e.bass) * LERP
      e.mid  = e.mid  + (rawMid  - e.mid)  * LERP
      e.high = e.high + (rawHigh - e.high) * LERP

      ctx.clearRect(0, 0, SIZE, SIZE)

      // Deep aurora glow background
      const bgR = speaking ? 100 + e.bass * 28 : 85
      const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, bgR * 1.5)
      bg.addColorStop(0, speaking ? `rgba(0,160,255,${0.1 + e.bass * 0.12})` : 'rgba(0,80,220,0.05)')
      bg.addColorStop(0.45, speaking ? `rgba(120,0,255,${0.07 + e.mid * 0.1})` : 'rgba(100,0,200,0.03)')
      bg.addColorStop(0.75, speaking ? `rgba(255,0,180,${0.04 + e.high * 0.06})` : 'rgba(180,0,140,0.02)')
      bg.addColorStop(1, 'transparent')
      ctx.fillStyle = bg
      ctx.beginPath(); ctx.arc(CX, CY, bgR * 1.5, 0, Math.PI * 2); ctx.fill()

      // Aurora wave rings — drawn back to front
      for (let ri = RINGS - 1; ri >= 0; ri--) {
        const ringT     = ri / RINGS
        const baseRad   = BASE_R + ri * RING_SPACING
        const breathe   = speaking ? 1 + e.bass * 0.22 + e.mid * 0.1 * Math.sin(t * 3 + ri) : 1 + 0.04 * Math.sin(t * 0.6 + ri * 0.4)
        const radius    = baseRad * breathe

        // Aurora hue — shifts across rings and time
        const hueBase   = AURORA_HUES[ri % AURORA_HUES.length]
        const hueDrift  = speaking ? e.mid * 55 + t * 18 : t * 8
        const hue       = (hueBase + hueDrift) % 360
        const sat       = speaking ? 95 + e.high * 5 : 80
        const light     = speaking ? 62 + e.bass * 15 : 58 + ringT * 8
        const alpha     = speaking
          ? 0.18 + ringT * 0.55 + e.bass * 0.25
          : 0.06 + ringT * 0.35

        // Wave distortion — more points for outer rings
        const waveFreq  = 3 + (ri % 4)
        const waveAmp   = speaking
          ? (3 + e.high * 14) * (1 - ringT * 0.5)
          : (1.5 + 1.2 * Math.sin(t * 0.5)) * (1 - ringT * 0.4)
        const phaseOff  = ri * 0.42 + t * (speaking ? 1.8 + e.mid * 2 : 0.55)
        const twistAmp  = speaking ? e.bass * 0.18 : 0.04

        ctx.beginPath()
        for (let pi = 0; pi <= WAVE_POINTS; pi++) {
          const angle  = (pi / WAVE_POINTS) * Math.PI * 2
          const wave   = waveAmp * Math.sin(angle * waveFreq + phaseOff)
          const twist  = twistAmp * Math.sin(angle * (waveFreq + 1) + phaseOff * 1.3)
          const r      = radius + wave + twist
          const px     = CX + r * Math.cos(angle)
          const py     = CY + r * Math.sin(angle)
          pi === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.closePath()

        // Gradient stroke — outer rings brighter on the cyan side
        const sg = ctx.createLinearGradient(CX - radius, CY, CX + radius, CY)
        sg.addColorStop(0,   `hsla(${hue},${sat}%,${light}%,${alpha})`)
        sg.addColorStop(0.35,`hsla(${(hue + 30) % 360},${sat}%,${light + 5}%,${alpha * 0.8})`)
        sg.addColorStop(0.65,`hsla(${(hue + 65) % 360},${sat}%,${light}%,${alpha * 1.1})`)
        sg.addColorStop(1,   `hsla(${hue},${sat}%,${light}%,${alpha})`)

        ctx.strokeStyle = sg
        ctx.lineWidth   = speaking
          ? 0.9 + ringT * 1.6 + e.bass * 1.4
          : 0.6 + ringT * 0.9
        ctx.stroke()
      }

      // Central aurora core
      const coreR = speaking ? 18 + e.bass * 12 : 14 + 2 * Math.sin(t * 0.9)
      const cg    = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 2.4)
      cg.addColorStop(0,   `rgba(255,255,255,${speaking ? 0.92 : 0.72})`)
      cg.addColorStop(0.28,`rgba(140,230,255,${speaking ? 0.7 + e.bass * 0.25 : 0.48})`)
      cg.addColorStop(0.6, `rgba(100,80,255,${speaking ? 0.3 + e.mid * 0.18 : 0.18})`)
      cg.addColorStop(0.85,`rgba(200,0,180,${speaking ? 0.12 + e.high * 0.1 : 0.06})`)
      cg.addColorStop(1,   'transparent')
      ctx.fillStyle = cg
      ctx.beginPath(); ctx.arc(CX, CY, coreR * 2.4, 0, Math.PI * 2); ctx.fill()

      // Bright centre point
      const pt = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 0.7)
      pt.addColorStop(0, `rgba(255,255,255,${speaking ? 1 : 0.85})`)
      pt.addColorStop(1, 'transparent')
      ctx.fillStyle = pt
      ctx.beginPath(); ctx.arc(CX, CY, coreR * 0.7, 0, Math.PI * 2); ctx.fill()

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [speaking, analyser])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      {/* Bloom wrapper with aurora rings */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer glow rings (CSS) */}
        {speaking && (
          <>
            <div className="orb-ring" />
            <div className="orb-ring" />
            <div className="orb-ring" />
          </>
        )}
        <div style={{
          filter: speaking
            ? 'drop-shadow(0 0 22px rgba(0,180,255,0.75)) drop-shadow(0 0 55px rgba(150,0,255,0.55)) drop-shadow(0 0 90px rgba(255,0,180,0.3))'
            : 'drop-shadow(0 0 10px rgba(0,180,255,0.4)) drop-shadow(0 0 28px rgba(100,0,200,0.28))',
          transition: 'filter 0.7s ease',
        }}>
          <canvas ref={canvasRef} style={{ width: 220, height: 220, display: 'block' }} />
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <p className="aurora-text" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', fontFamily: 'monospace' }}>
          ALEX · AI TUTOR
        </p>
        <p style={{
          fontSize: 9,
          color: speaking ? 'rgba(0,220,255,0.75)' : 'rgba(255,255,255,0.28)',
          letterSpacing: '0.18em', marginTop: 3, fontFamily: 'monospace',
          transition: 'color 0.4s',
          textShadow: speaking ? '0 0 8px rgba(0,220,255,0.6)' : 'none',
        }}>
          {speaking ? 'AURORA WAVE · ACTIVE' : 'SYNAPSE LINK ONLINE'}
        </p>
      </div>
    </div>
  )
}

// ─── Section list ─────────────────────────────────────────────────────────────
function SectionTrail({
  sections, currentIdx, progress, moduleId, onSelect,
}: {
  sections: Section[]
  currentIdx: number
  progress: SectionProgress[]
  moduleId: string
  onSelect: (idx: number) => void
}) {
  const [fetchedTopics, setFetchedTopics] = useState<Record<string, string[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (sections.length === 0) return
    sections.forEach(s => {
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

  function isSectionUnlocked(idx: number): boolean {
    if (idx === 0) return true
    const prev = sections[idx - 1]
    const prevProg = progress.find(p => p.section_id === prev.section_id)
    return prevProg?.status === 'completed'
  }

  return (
    <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
      {sections.map((s, i) => {
        const prog     = progress.find(p => p.section_id === s.section_id)
        const st       = prog?.status ?? 'not_started'
        const isCurrent = i === currentIdx
        const isDone    = st === 'completed'
        const isExpanded = expanded.has(s.section_id)
        const isLocked  = !isSectionUnlocked(i)

        const topics: TeachingPoint[] = prog?.teaching_points && prog.teaching_points.length > 0
          ? prog.teaching_points
          : (fetchedTopics[s.section_id] ?? []).map(t => ({ title: t, done: false }))
        const doneCount = topics.filter(t => t.done).length

        return (
          <div key={s.section_id}>
            <button
              onClick={() => !isLocked && onSelect(i)}
              className={isCurrent ? 'trail-active' : ''}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 10, textAlign: 'left',
                transition: 'all 0.22s ease', cursor: isLocked ? 'default' : 'pointer',
                opacity: isLocked ? 0.38 : 1,
                background: isCurrent ? undefined : isDone ? 'rgba(0,200,140,0.05)' : 'transparent',
                border: isCurrent
                  ? '1px solid rgba(0,220,255,0.28)'
                  : isDone ? '1px solid rgba(0,200,140,0.2)' : '1px solid transparent',
                boxShadow: isCurrent ? '0 0 14px rgba(0,220,255,0.1), inset 0 0 8px rgba(150,50,255,0.05)' : 'none',
              }}
            >
              {/* Badge */}
              <span style={{
                minWidth: 32, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0, fontFamily: 'monospace', padding: '0 4px',
                background: isCurrent ? 'rgba(0,220,255,0.14)' : isDone ? 'rgba(0,200,140,0.12)' : 'rgba(255,255,255,0.05)',
                border: isCurrent ? '1px solid rgba(0,220,255,0.5)' : isDone ? '1px solid rgba(0,200,140,0.4)' : '1px solid rgba(255,255,255,0.12)',
                color: isCurrent ? '#00dcff' : isDone ? '#00c88c' : 'rgba(255,255,255,0.38)',
                boxShadow: isCurrent ? '0 0 8px rgba(0,220,255,0.35)' : 'none',
              }}>
                {isLocked ? <Lock size={8} /> : isDone ? <Check size={9} /> : s.section_id}
              </span>
              {/* Title */}
              <span style={{
                flex: 1, fontSize: 11, lineHeight: 1.35,
                color: isCurrent ? '#dff8ff' : isDone ? 'rgba(0,200,140,0.8)' : 'rgba(255,255,255,0.42)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.section_title}
              </span>
              {!isLocked && topics.length > 0 && (
                <span onClick={e => toggleExpand(s.section_id, e)} style={{
                  display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                  cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
                }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: isDone ? 'rgba(0,200,120,0.5)' : 'rgba(255,255,255,0.2)' }}>
                    {doneCount}/{topics.length}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={10} color="rgba(255,255,255,0.22)" />
                    : <ChevronDown size={10} color="rgba(255,255,255,0.22)" />}
                </span>
              )}
            </button>

            {!isLocked && isExpanded && topics.length > 0 && (
              <div style={{ marginLeft: 12, marginBottom: 4, borderLeft: '1px solid rgba(0,220,255,0.08)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {topics.map((pt, ti) => {
                  const isCurrentTopic = isCurrent && prog?.teaching_point_idx === ti && !pt.done
                  return (
                    <div key={ti} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '4px 6px', borderRadius: 6,
                      background: isCurrentTopic ? 'rgba(150,50,255,0.08)' : pt.done ? 'rgba(0,200,140,0.04)' : 'transparent',
                      border: isCurrentTopic ? '1px solid rgba(150,50,255,0.22)' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: pt.done ? 'rgba(0,200,140,0.18)' : isCurrentTopic ? 'rgba(150,50,255,0.2)' : 'rgba(255,255,255,0.05)',
                        border: pt.done ? '1px solid rgba(0,200,140,0.55)' : isCurrentTopic ? '1px solid rgba(150,50,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      }}>
                        {pt.done
                          ? <Check size={8} color="#00c88c" />
                          : <span style={{ fontSize: 6, color: isCurrentTopic ? '#c080ff' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{ti + 1}</span>
                        }
                      </div>
                      <span style={{
                        fontSize: 10, lineHeight: 1.4,
                        color: pt.done ? 'rgba(0,200,140,0.55)' : isCurrentTopic ? '#e0c0ff' : 'rgba(255,255,255,0.32)',
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

// ─── Notes panel ──────────────────────────────────────────────────────────────
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
    background: 'rgba(0,220,255,0.025)',
    border: '1px solid rgba(0,220,255,0.1)',
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
      <div style={glassPanel}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 4 }} className="aurora-text">SECTION {section.section_id}</p>
        <p style={{ fontSize: 11, color: 'rgba(220,232,255,0.75)', lineHeight: 1.4 }}>{section.section_title}</p>
      </div>

      {(progress?.key_points ?? []).length > 0 && (
        <div style={glassPanel}>
          <button onClick={() => setKpOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: kpOpen ? 8 : 0 }}>
            <Brain size={12} color="#9632ff" />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,220,255,0.8)', letterSpacing: '0.1em', flex: 1, textAlign: 'left' }}>KEY INSIGHTS</span>
            {kpOpen ? <ChevronUp size={11} color="rgba(255,255,255,0.28)" /> : <ChevronDown size={11} color="rgba(255,255,255,0.28)" />}
          </button>
          {kpOpen && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(progress?.key_points ?? []).map((pt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(220,232,255,0.7)', lineHeight: 1.4 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(150,50,255,0.28)', border: '1px solid rgba(150,50,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#9632ff', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  {pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ ...glassPanel, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'rgba(0,220,255,0.7)', letterSpacing: '0.1em' }}>
          <PenLine size={11} color="rgba(0,220,255,0.5)" /> MY NOTES
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={`Write your notes for section ${section.section_id}…`}
          className="aurora-input"
          style={{
            flex: 1, resize: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,220,255,0.12)',
            borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'rgba(220,232,255,0.82)',
            outline: 'none', lineHeight: 1.6, minHeight: 100, transition: 'border-color 0.2s',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={save} disabled={saving} style={{
          flex: 1, padding: '9px 0', borderRadius: 10,
          border: '1px solid rgba(0,220,255,0.35)',
          background: 'rgba(0,220,255,0.1)',
          color: '#00dcff', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 0 14px rgba(0,220,255,0.12)',
          transition: 'all 0.2s',
        }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} SAVE
        </button>
        <button onClick={downloadNotes} title="Download notes" style={{
          padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
        }}>
          <Download size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Section note-points panel ────────────────────────────────────────────────
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
      setCopied('all'); setTimeout(() => setCopied(null), 1800)
    })
  }

  const copyBullet = (text: string) => {
    void navigator.clipboard.writeText(`• ${text}`).then(() => {
      setCopied(text); setTimeout(() => setCopied(null), 1500)
    })
  }

  if (groups.length === 0) {
    return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', textAlign: 'center', padding: '20px 0' }}>No key points extracted yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PenLine size={11} color="rgba(0,220,255,0.6)" />
          <span className="aurora-text" style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 700 }}>KEY POINTS TO NOTE</span>
        </div>
        <button onClick={copyAll} style={{
          background: copied === 'all' ? 'rgba(0,200,140,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${copied === 'all' ? 'rgba(0,200,140,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          fontSize: 9, fontFamily: 'monospace', color: copied === 'all' ? '#00c88c' : 'rgba(255,255,255,0.4)',
          letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s',
        }}>
          {copied === 'all' ? <Check size={9} /> : <Download size={9} />}
          {copied === 'all' ? 'COPIED' : 'COPY ALL'}
        </button>
      </div>

      {groups.map((group, gi) => (
        <div key={gi} style={{
          background: 'rgba(0,220,255,0.02)',
          border: '1px solid rgba(0,220,255,0.08)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {group.subHeading && (
            <div style={{ padding: '7px 12px', background: 'rgba(150,50,255,0.07)', borderBottom: '1px solid rgba(150,50,255,0.14)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#c080ff', lineHeight: 1.3, fontFamily: 'monospace' }}>▸ {group.subHeading}</span>
            </div>
          )}
          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {group.bullets.map((bullet, bi) => (
              <div key={bi} onClick={() => copyBullet(bullet)} title="Click to copy"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                  background: copied === bullet ? 'rgba(0,200,140,0.08)' : 'transparent',
                  border: `1px solid ${copied === bullet ? 'rgba(0,200,140,0.3)' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (copied !== bullet) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,220,255,0.05)' }}
                onMouseLeave={e => { if (copied !== bullet) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: copied === bullet ? '#00c88c' : '#00dcff',
                  boxShadow: copied === bullet ? '0 0 6px #00c88c' : '0 0 5px rgba(0,220,255,0.6)',
                  transition: 'all 0.2s',
                }} />
                <span style={{ fontSize: 11, lineHeight: 1.55, color: copied === bullet ? 'rgba(0,200,140,0.9)' : 'rgba(220,232,255,0.7)', flex: 1 }}>
                  {bullet}
                </span>
                {copied === bullet
                  ? <Check size={9} color="#00c88c" style={{ flexShrink: 0, marginTop: 4 }} />
                  : <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.14)', flexShrink: 0, marginTop: 5, fontFamily: 'monospace' }}>COPY</span>
                }
              </div>
            ))}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', textAlign: 'center', fontFamily: 'monospace', letterSpacing: '0.08em', marginTop: 2 }}>
        CLICK ANY POINT TO COPY · ADD TO NOTES TAB
      </p>
    </div>
  )
}

// ─── Extract note points ──────────────────────────────────────────────────────
function extractNotePoints(content: string): { subHeading: string | null; bullets: string[] }[] {
  if (!content) return []
  const subRe = /\[(\d+\.\d+\.\d+(?:\.\d+)?\s+[^\]]{2,80})\]/g
  const parts: { heading: string | null; text: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = subRe.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push({ heading: null, text: content.slice(lastIndex, match.index) })
    const headingStart = match.index + match[0].length
    lastIndex = headingStart
    const nextMatch = subRe.exec(content)
    if (nextMatch) {
      parts.push({ heading: match[1].trim(), text: content.slice(headingStart, nextMatch.index) })
      lastIndex = nextMatch.index; subRe.lastIndex = nextMatch.index
    } else {
      parts.push({ heading: match[1].trim(), text: content.slice(headingStart) }); lastIndex = content.length
    }
  }
  if (lastIndex < content.length) parts.push({ heading: null, text: content.slice(lastIndex) })
  if (parts.length === 0) parts.push({ heading: null, text: content })
  return parts.map(part => {
    const raw = part.text.replace(/\s+/g, ' ').trim()
    const sentences = raw.match(/[^.!?]+[.!?]/g) ?? []
    const bullets = sentences.map(s => s.trim()).filter(s => s.length >= 15 && s.length <= 180)
      .filter(s => !/^(the|a|an|this|that|these|those|it|in|at|on|for|and|or)\b/i.test(s)).slice(0, 5)
    return { subHeading: part.heading, bullets }
  }).filter(p => p.bullets.length > 0 || p.subHeading !== null)
}

// ─── Typing indicator (aurora dots) ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(0,220,255,0.18), rgba(150,50,255,0.18))',
        border: '1px solid rgba(0,220,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#00dcff', flexShrink: 0,
        boxShadow: '0 0 12px rgba(0,220,255,0.2)',
      }}>A</div>
      <div style={{
        background: 'rgba(0,220,255,0.04)',
        border: '1px solid rgba(0,220,255,0.12)',
        borderRadius: '18px 18px 18px 4px',
        padding: '12px 16px',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <span key={i} className="typing-dot" style={{ width: 7, height: 7, display: 'inline-block' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Notes prompt banner ──────────────────────────────────────────────────────
function NotesPromptBanner({ phase, topicTitle, topicIdx, total }: {
  phase: 'PRE_NOTES' | 'EXPLAIN' | 'CHECK' | 'POST_NOTES' | 'WRAP'
  topicTitle: string | null; topicIdx: number; total: number
}) {
  if (!topicTitle) return null
  const config: Record<string, { icon: string; label: string; hint: string; color: string; bg: string; border: string }> = {
    PRE_NOTES: { icon: '✏️', label: 'WRITE HEADING', color: '#ffc832', hint: `Write "${topicTitle}" as a heading in your notes and leave space underneath.`, bg: 'rgba(255,200,50,0.05)', border: 'rgba(255,200,50,0.22)' },
    EXPLAIN:   { icon: '📖', label: 'LISTENING',     color: '#00dcff', hint: `Alex is explaining "${topicTitle}" — get ready to fill in your notes.`, bg: 'rgba(0,220,255,0.04)', border: 'rgba(0,220,255,0.2)' },
    CHECK:     { icon: '💬', label: 'ANSWER',         color: '#9632ff', hint: `Answer Alex's question about "${topicTitle}".`, bg: 'rgba(150,50,255,0.05)', border: 'rgba(150,50,255,0.22)' },
    POST_NOTES:{ icon: '📝', label: 'UPDATE NOTES',  color: '#00c8b4', hint: `Add the key point Alex just gave you under "${topicTitle}" in your notes.`, bg: 'rgba(0,200,180,0.05)', border: 'rgba(0,200,180,0.22)' },
    WRAP:      { icon: '🏁', label: 'WRAP-UP',        color: '#00dcff', hint: 'Alex is checking that you understand the whole section.', bg: 'rgba(0,220,255,0.04)', border: 'rgba(0,220,255,0.2)' },
  }
  const c = config[phase]
  if (!c) return null
  return (
    <div style={{
      margin: '0 24px 8px', padding: '10px 14px', borderRadius: 10,
      background: c.bg, border: `1px solid ${c.border}`,
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.15em', color: c.color }}>{c.label}</span>
          {total > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.28)' }}>· topic {topicIdx + 1}/{total}</span>}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(220,232,255,0.62)', lineHeight: 1.4, margin: 0 }}>{c.hint}</p>
      </div>
    </div>
  )
}

// ─── Quiz modal ───────────────────────────────────────────────────────────────
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,10,0.82)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }}>
      {/* Aurora border wrapper */}
      <div className="aurora-border" style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', borderRadius: 20 }}>
        <div style={{
          width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          background: 'rgba(3,7,24,0.96)', borderRadius: 19,
          boxShadow: '0 0 80px rgba(150,50,255,0.25), 0 0 160px rgba(0,220,255,0.12)',
        }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,220,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Brain size={18} color="#00dcff" style={{ filter: 'drop-shadow(0 0 8px rgba(0,220,255,0.7))' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#dce8ff' }}>Knowledge Check</p>
                <p className="aurora-text" style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{moduleTitle}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Loader2 size={28} color="#00dcff" className="animate-spin" /></div>}
            {!loading && result && (
              <div style={{
                borderRadius: 14, padding: '18px 20px',
                background: result.passed ? 'rgba(0,200,140,0.07)' : 'rgba(255,50,50,0.07)',
                border: `1px solid ${result.passed ? 'rgba(0,200,140,0.3)' : 'rgba(255,50,50,0.28)'}`,
                boxShadow: result.passed ? '0 0 28px rgba(0,200,140,0.12)' : '0 0 28px rgba(255,50,50,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {result.passed ? <CheckCircle2 size={20} color="#00c88c" /> : <XCircle size={20} color="#ff4444" />}
                  <p style={{ fontWeight: 700, color: result.passed ? '#00c88c' : '#ff6666', fontSize: 15 }}>
                    {result.passed ? `Passed — ${result.percentage}%` : `Not yet — ${result.percentage}%`}
                  </p>
                </div>
                {result.weakAreas.length > 0 && <p style={{ fontSize: 12, color: 'rgba(220,232,255,0.5)' }}>Revisit: {result.weakAreas.join(', ')}</p>}
              </div>
            )}
            {!loading && questions.map((q, qi) => (
              <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: 'rgba(220,232,255,0.85)', fontWeight: 500, lineHeight: 1.5 }}>{qi + 1}. {q.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {q.options.map(opt => (
                    <label key={opt} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10,
                      cursor: result ? 'default' : 'pointer', transition: 'all 0.18s',
                      background: answers[q.id] === opt ? 'rgba(0,220,255,0.09)' : 'rgba(255,255,255,0.025)',
                      border: answers[q.id] === opt ? '1px solid rgba(0,220,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: answers[q.id] === opt ? '0 0 14px rgba(0,220,255,0.1)' : 'none',
                    }}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => !result && setAnswers(p => ({ ...p, [q.id]: opt }))} style={{ marginTop: 2, accentColor: '#00dcff' }} />
                      <span style={{ fontSize: 12, color: answers[q.id] === opt ? '#dce8ff' : 'rgba(220,232,255,0.58)', lineHeight: 1.5 }}>{opt}</span>
                    </label>
                  ))}
                </div>
                {result?.explanations[q.id] && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10, fontSize: 11, lineHeight: 1.5,
                    background: answers[q.id] === result.explanations[q.id].correct ? 'rgba(0,200,140,0.07)' : 'rgba(255,50,50,0.07)',
                    color: answers[q.id] === result.explanations[q.id].correct ? '#00c88c' : '#ff8888',
                    border: `1px solid ${answers[q.id] === result.explanations[q.id].correct ? 'rgba(0,200,140,0.22)' : 'rgba(255,50,50,0.2)'}`,
                  }}>
                    <strong>Correct: {result.explanations[q.id].correct}</strong> — {result.explanations[q.id].explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(0,220,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {!result ? (
              <>
                <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting || Object.keys(answers).length < questions.length} style={{
                  padding: '9px 22px', borderRadius: 10, background: 'rgba(0,220,255,0.12)', border: '1px solid rgba(0,220,255,0.4)', color: '#00dcff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  opacity: (submitting || Object.keys(answers).length < questions.length) ? 0.38 : 1,
                  boxShadow: '0 0 18px rgba(0,220,255,0.15)',
                }}>
                  {submitting && <Loader2 size={14} className="animate-spin" />} Submit
                </button>
              </>
            ) : (
              <button onClick={onClose} style={{
                padding: '9px 22px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: result.passed ? 'rgba(0,200,140,0.12)' : 'rgba(255,50,50,0.08)',
                border: `1px solid ${result.passed ? 'rgba(0,200,140,0.4)' : 'rgba(255,50,50,0.28)'}`,
                color: result.passed ? '#00c88c' : '#ff8888',
              }}>
                {result.passed ? 'Continue learning →' : 'Try again later'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CourseModulePage() {
  const params  = useParams()
  const router  = useRouter()
  const moduleId = params.moduleId as string
  const supabase = createClientComponentClient()

  const [moduleTitle, setModuleTitle] = useState(moduleId.toUpperCase())
  const [partNumber,  setPartNumber]  = useState(1)
  const [partTitle,   setPartTitle]   = useState('')
  const [moduleLoaded, setModuleLoaded] = useState(false)
  const [nextModule,  setNextModule]  = useState<string | null>(null)

  const [sections,       setSections]       = useState<Section[]>([])
  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const currentSection = sections[currentSectionIdx] ?? null

  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([])
  const currentProgress = sectionProgress.find(p => p.section_id === currentSection?.section_id) ?? null

  const [sectionContent, setSectionContent] = useState<string>('')
  const [rightTab, setRightTab] = useState<'notes' | 'content'>('content')

  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [streaming,     setStreaming]      = useState(false)
  const [sessionId,     setSessionId]     = useState<string | undefined>()
  const [exchangeCount, setExchangeCount] = useState(0)
  const [showQuiz,      setShowQuiz]      = useState(false)
  const [quizPassed,    setQuizPassed]    = useState(false)
  const [moduleAlreadyCompleted, setModuleAlreadyCompleted] = useState(false)

  const [audioEnabled,     setAudioEnabled]     = useState(true)
  const [micActive,        setMicActive]        = useState(false)
  const [isSpeaking,       setIsSpeaking]       = useState(false)
  const [userActivated,    setUserActivated]    = useState(false)
  const [availableVoices,  setAvailableVoices]  = useState<SpeechSynthesisVoice[]>([])

  const [sessionKeyPoints, setSessionKeyPoints] = useState<string[]>([])
  const [teachingPoints,   setTeachingPoints]   = useState<TeachingPoint[]>([])
  const [currentPointIdx,  setCurrentPointIdx]  = useState(0)
  const teachingPointsRef  = useRef<TeachingPoint[]>([])
  const currentPointIdxRef = useRef(0)
  useEffect(() => { teachingPointsRef.current = teachingPoints }, [teachingPoints])
  useEffect(() => { currentPointIdxRef.current = currentPointIdx }, [currentPointIdx])

  type TeachingPhase = 'PRE_NOTES' | 'EXPLAIN' | 'CHECK' | 'POST_NOTES' | 'WRAP'
  const [teachingPhase, setTeachingPhase]   = useState<TeachingPhase>('PRE_NOTES')
  const teachingPhaseRef = useRef<TeachingPhase>('PRE_NOTES')
  useEffect(() => { teachingPhaseRef.current = teachingPhase }, [teachingPhase])

  const chatEndRef        = useRef<HTMLDivElement>(null)
  const messagesRef       = useRef<Message[]>([])
  const streamingRef      = useRef(false)
  const sessionIdRef      = useRef<string | undefined>()
  const moduleTitleRef    = useRef(moduleId.toUpperCase())
  const partNumberRef     = useRef(1)
  const partTitleRef      = useRef('')
  const audioEnabledRef   = useRef(true)
  const speechBufferRef   = useRef('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef    = useRef<any>(null)
  const hasAutoStarted    = useRef(false)
  const micActiveRef      = useRef(false)
  const autoMicTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startMicRef       = useRef<() => void>(() => {})
  const micManuallyStoppedRef = useRef(false)
  const speakTextRef      = useRef<(text: string) => void>(() => {})
  const userActivatedRef  = useRef(false)
  const isAudioPlayingRef = useRef(false)
  const analyserRef       = useRef<AnalyserNode | null>(null)
  const currentSectionRef = useRef<Section | null>(null)
  const completedSectionsRef = useRef<string[]>([])
  const selectedVoiceRef  = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => { messagesRef.current     = messages },       [messages])
  useEffect(() => { streamingRef.current    = streaming },      [streaming])
  useEffect(() => { sessionIdRef.current    = sessionId },      [sessionId])
  useEffect(() => { moduleTitleRef.current  = moduleTitle },    [moduleTitle])
  useEffect(() => { partNumberRef.current   = partNumber },     [partNumber])
  useEffect(() => { partTitleRef.current    = partTitle },      [partTitle])
  useEffect(() => { audioEnabledRef.current = audioEnabled },   [audioEnabled])
  useEffect(() => { micActiveRef.current    = micActive },      [micActive])
  useEffect(() => { userActivatedRef.current = userActivated }, [userActivated])
  useEffect(() => { currentSectionRef.current = currentSection }, [currentSection])
  useEffect(() => {
    completedSectionsRef.current = sectionProgress.filter(p => p.status === 'completed').map(p => p.section_id)
  }, [sectionProgress])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

  // ─── Audio ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const pickVoice = () => {
      const voices  = window.speechSynthesis.getVoices()
      const enVoices = [...voices.filter(v => v.lang === 'en-GB'), ...voices.filter(v => v.lang !== 'en-GB' && v.lang.startsWith('en'))]
      setAvailableVoices(enVoices)
      if (!selectedVoiceRef.current) selectedVoiceRef.current = enVoices[0] ?? null
    }
    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice)
  }, [])

  const initAudioCtx = useCallback(() => { /* no-op: using Web Speech API */ }, [])

  const speakText = useCallback((text: string, onFinished?: () => void) => {
    if (!audioEnabledRef.current) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (micActiveRef.current) { recognitionRef.current?.stop(); setMicActive(false) }
    isAudioPlayingRef.current = true; setIsSpeaking(true)
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-GB'; utt.rate = 1.05
    if (selectedVoiceRef.current) utt.voice = selectedVoiceRef.current
    utt.onend = () => { if (!window.speechSynthesis.speaking) { isAudioPlayingRef.current = false; setIsSpeaking(false) }; onFinished?.() }
    utt.onerror = () => { if (!window.speechSynthesis.speaking) { isAudioPlayingRef.current = false; setIsSpeaking(false) }; onFinished?.() }
    window.speechSynthesis.speak(utt)
  }, [])

  const cancelSpeech = useCallback(() => {
    isAudioPlayingRef.current = false; setIsSpeaking(false)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    speechBufferRef.current = ''
  }, [])

  const speakTextFinal = useCallback((text: string, onFinished?: () => void) => {
    if (!audioEnabledRef.current) { onFinished?.(); return }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onFinished?.(); return }
    if (!text) { onFinished?.(); return }
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-GB'; utt.rate = 1.05
    if (selectedVoiceRef.current) utt.voice = selectedVoiceRef.current
    utt.onend  = () => { isAudioPlayingRef.current = false; setIsSpeaking(false); onFinished?.() }
    utt.onerror = () => { isAudioPlayingRef.current = false; setIsSpeaking(false); onFinished?.() }
    window.speechSynthesis.speak(utt)
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
    const r = speechBufferRef.current.trim(); speechBufferRef.current = ''
    if (audioEnabledRef.current && r) {
      speakTextFinal(r, () => { if (!micManuallyStoppedRef.current) startMicRef.current() })
    } else {
      const waitForQueue = () => {
        if (window.speechSynthesis.speaking) setTimeout(waitForQueue, 200)
        else { isAudioPlayingRef.current = false; setIsSpeaking(false); if (!micManuallyStoppedRef.current) startMicRef.current() }
      }
      if (typeof window !== 'undefined' && window.speechSynthesis.speaking) waitForQueue()
      else { if (!micManuallyStoppedRef.current) startMicRef.current() }
    }
  }, [speakTextFinal])

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
      const pts = teachingPointsRef.current; const ptIdx = currentPointIdxRef.current
      const currentPoint = pts[ptIdx] ?? null
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text, moduleId, sessionId: sessionIdRef.current,
          moduleTitle: moduleTitleRef.current, partNumber: partNumberRef.current, partTitle: partTitleRef.current,
          currentSection: currentSectionRef.current, completedSections: completedSectionsRef.current,
          teachingPointIdx: ptIdx, teachingPointTitle: currentPoint?.title ?? null,
          totalTeachingPoints: pts.length, allTeachingPoints: pts.map(p => p.title), phase: teachingPhaseRef.current,
        }),
      })
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader(); const decoder = new TextDecoder()
      let lineBuffer = ''; let fullResponse = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n'); lineBuffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const p = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; sessionId?: string }
            if (p.token) {
              const tok = p.token; fullResponse += tok
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: fullResponse }; return u })
              feedToken(tok)
            }
            if (p.sessionId) setSessionId(p.sessionId)
            if (p.done) flushSpeech()
          } catch { /* ignore */ }
        }
      }
      flushSpeech()
      if (!silent && fullResponse.trim()) {
        const sentences = fullResponse.match(/[^.!?]+[.!?]/g) ?? []
        const points = sentences.map(s => s.trim()).filter(s => s.length > 20 && s.length < 200).slice(0, 3)
        if (points.length > 0) {
          setSessionKeyPoints(prev => {
            const combined = [...new Set([...prev, ...points])].slice(0, 10)
            if (currentSectionRef.current) {
              void fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduleId, sectionId: currentSectionRef.current.section_id, sectionTitle: currentSectionRef.current.section_title, keyPoints: combined, status: 'in_progress' }) })
            }
            return combined
          })
          setSectionProgress(prev => {
            const existing = prev.find(p => p.section_id === currentSectionRef.current?.section_id)
            if (!existing || !currentSectionRef.current) return prev
            return prev.map(p => p.section_id === currentSectionRef.current!.section_id
              ? { ...p, key_points: [...new Set([...p.key_points, ...points])].slice(0, 10) } : p)
          })
        }
      }
      if (fullResponse.trim()) {
        const lower = fullResponse.toLowerCase(); const currentPhase = teachingPhaseRef.current
        const pts2 = teachingPointsRef.current; const idx = currentPointIdxRef.current
        const isLastPoint = idx >= pts2.length - 1
        if (currentPhase === 'PRE_NOTES' || text === '__AUTO_START__') { setTeachingPhase('EXPLAIN') }
        else if (currentPhase === 'EXPLAIN') { setTeachingPhase('CHECK') }
        else if (currentPhase === 'CHECK') {
          const movingOn = ['let\'s move on','moving on','next topic','next point','note that down'].some(s => lower.includes(s))
          if (movingOn) {
            if (idx < pts2.length) {
              const updated = pts2.map((p, i) => i === idx ? { ...p, done: true } : p)
              setTeachingPoints(updated)
              const nextIdx = isLastPoint ? idx : idx + 1
              setCurrentPointIdx(nextIdx); setTeachingPhase(isLastPoint ? 'WRAP' : 'POST_NOTES')
              if (currentSectionRef.current) {
                void fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ moduleId, sectionId: currentSectionRef.current.section_id, sectionTitle: currentSectionRef.current.section_title, status: 'in_progress', teachingPointIdx: nextIdx, teachingPoints: updated }) })
              }
            }
          }
        } else if (currentPhase === 'POST_NOTES') { setTeachingPhase('PRE_NOTES') }
      }
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length-1] = { ...u[u.length-1], content: 'Sorry, something went wrong. Please try again.' }; return u })
    } finally { setStreaming(false) }
  }, [moduleId, cancelSpeech, feedToken, flushSpeech])

  // ─── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const num = parseInt(moduleId.replace('m', ''), 10)
    if (num < 87) setNextModule(`m${String(num + 1).padStart(2, '0')}`)
    Promise.all([
      fetch(`/api/module-meta?moduleId=${moduleId}`).then(r => r.json() as Promise<{ module_title: string; part_number: number; part_title: string } | null>),
      fetch('/api/progress').then(r => r.json() as Promise<{ completedModules: string[] }>),
    ]).then(([meta, prog]) => {
      if (meta) { setModuleTitle(meta.module_title ?? moduleId.toUpperCase()); setPartNumber(meta.part_number ?? 1); setPartTitle(meta.part_title ?? '') }
      if (prog?.completedModules?.includes(moduleId)) setModuleAlreadyCompleted(true)
      setModuleLoaded(true)
    }).catch(() => { setModuleLoaded(true) })
  }, [moduleId])

  useEffect(() => {
    fetch(`/api/sections?moduleId=${moduleId}`)
      .then(r => r.json() as Promise<{ sections: Section[] }>)
      .then(d => { if (d.sections && d.sections.length > 0) setSections(d.sections); setSectionsLoaded(true) })
      .catch(() => { setSectionsLoaded(true) })
  }, [moduleId])

  useEffect(() => {
    fetch(`/api/notes?moduleId=${moduleId}`)
      .then(r => r.json() as Promise<{ progress: SectionProgress[] }>)
      .then(d => { if (d.progress) setSectionProgress(d.progress) })
      .catch(() => {})
  }, [moduleId])

  useEffect(() => {
    if (!currentSection) return
    const saved = sectionProgress.find(p => p.section_id === currentSection.section_id)
    if (saved?.teaching_points && saved.teaching_points.length > 0) {
      setTeachingPoints(saved.teaching_points); setCurrentPointIdx(saved.teaching_point_idx ?? 0); return
    }
    void fetch(`/api/teaching-points?moduleId=${moduleId}&sectionId=${currentSection.section_id}`)
      .then(r => r.json() as Promise<{ points: string[] }>)
      .then(d => { if (d.points && d.points.length > 0) { setTeachingPoints(d.points.map(t => ({ title: t, done: false }))); setCurrentPointIdx(0) } })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.section_id, moduleId])

  useEffect(() => {
    if (sessionKeyPoints.length > 0 && currentSection) {
      setSectionProgress(prev => {
        const exists = prev.find(p => p.section_id === currentSection.section_id)
        if (exists) return prev.map(p => p.section_id === currentSection.section_id ? { ...p, key_points: sessionKeyPoints } : p)
        return [...prev, { section_id: currentSection.section_id, section_title: currentSection.section_title, status: 'in_progress', notes: '', key_points: sessionKeyPoints }]
      })
    }
  }, [sessionKeyPoints, currentSection])

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
    setCurrentSectionIdx(idx); setMessages([]); setSessionKeyPoints([])
    setTeachingPoints([]); setCurrentPointIdx(0); setTeachingPhase('PRE_NOTES')
    hasAutoStarted.current = false; cancelSpeech()
  }, [currentSectionIdx, cancelSpeech])

  const completeSection = useCallback(() => {
    if (!currentSection) return
    setSectionProgress(prev => {
      const exists = prev.find(p => p.section_id === currentSection.section_id)
      const updated: SectionProgress = exists
        ? { ...exists, status: 'completed' }
        : { section_id: currentSection.section_id, section_title: currentSection.section_title, status: 'completed', notes: '', key_points: sessionKeyPoints }
      void fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, sectionId: currentSection.section_id, sectionTitle: currentSection.section_title, status: 'completed', keyPoints: sessionKeyPoints }) })
      return exists ? prev.map(p => p.section_id === currentSection.section_id ? updated : p) : [...prev, updated]
    })
    if (currentSectionIdx < sections.length - 1) switchSection(currentSectionIdx + 1)
  }, [currentSection, currentSectionIdx, sections.length, switchSection, sessionKeyPoints, moduleId])

  // ─── Mic ──────────────────────────────────────────────────────────────────
  const startMicImpl = useCallback(() => {
    if (!userActivatedRef.current || micActiveRef.current || streamingRef.current) return
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = 'en-GB'; rec.continuous = false; rec.interimResults = true
    let gotFinal = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      const t = Array.from(ev.results as ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>).map(r => r[0].transcript).join('')
      setInput(t)
      if ((ev.results as ArrayLike<{ isFinal: boolean }>)[ev.results.length-1].isFinal) {
        gotFinal = true; setMicActive(false); setInput('')
        if (t.trim()) void doSend(t.trim(), false)
      }
    }
    const restart = (ms: number) => {
      if (streamingRef.current || isAudioPlayingRef.current || micManuallyStoppedRef.current) return
      autoMicTimerRef.current = setTimeout(() => { if (!streamingRef.current && !isAudioPlayingRef.current && !micManuallyStoppedRef.current) startMicRef.current() }, ms)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (ev: any) => { setMicActive(false); if (ev.error === 'no-speech' || ev.error === 'audio-capture') restart(500) }
    rec.onend = () => { setMicActive(false); if (!gotFinal) restart(300) }
    rec.start(); recognitionRef.current = rec; setMicActive(true)
  }, [doSend])

  useEffect(() => { startMicRef.current = startMicImpl }, [startMicImpl])

  const toggleMic = useCallback(() => {
    if (micActive) { micManuallyStoppedRef.current = true; recognitionRef.current?.stop(); setMicActive(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) { alert('Speech recognition not supported. Try Chrome or Edge.'); return }
    micManuallyStoppedRef.current = false; startMicImpl()
  }, [micActive, startMicImpl])

  void moduleLoaded

  const completedCount = sectionProgress.filter(p => p.status === 'completed').length
  const totalSections  = sections.length
  const progressPct    = totalSections > 0 ? Math.round(completedCount / totalSections * 100) : 0
  const canGoNext      = quizPassed || moduleAlreadyCompleted

  const [showSections, setShowSections] = useState(true)
  const [showNotes,    setShowNotes]    = useState(true)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'rgb(3,7,18)',
      backgroundImage: 'radial-gradient(ellipse at 45% 30%, rgba(8,4,32,0.95) 0%, rgba(3,7,18,1) 60%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative',
    }}>

      {/* ── Aurora background ── */}
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-layer-3" />
      </div>

      {/* ── Top HUD bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', flexShrink: 0, zIndex: 10,
        background: 'rgba(3,7,18,0.75)',
        borderBottom: '1px solid rgba(0,220,255,0.09)',
        backdropFilter: 'blur(24px) saturate(160%)',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,232,255,0.38)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={16} />
            <span style={{ fontSize: 11, letterSpacing: '0.08em', fontFamily: 'monospace' }}>BACK</span>
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(0,220,255,0.15)' }} />
          <div>
            <p style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.18em', color: 'rgba(0,220,255,0.65)' }}>PART {partNumber} · {moduleId.toUpperCase()}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(220,232,255,0.88)', marginTop: 1, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{moduleTitle}</p>
          </div>
        </div>

        {/* Centre: aurora progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(0,220,255,0.55)', letterSpacing: '0.15em', marginBottom: 4 }}>PROGRESS // {completedCount}/{totalSections}</p>
            <div style={{ width: 180, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div className="aurora-progress-fill" style={{ height: '100%', width: `${progressPct}%`, borderRadius: 99, transition: 'width 0.55s ease' }} />
            </div>
          </div>
          {currentSection && (
            <div style={{ background: 'rgba(0,220,255,0.07)', border: '1px solid rgba(0,220,255,0.22)', borderRadius: 8, padding: '4px 10px', boxShadow: '0 0 10px rgba(0,220,255,0.1)' }}>
              <p style={{ fontSize: 10, color: '#00dcff', fontFamily: 'monospace', letterSpacing: '0.1em' }}>§ {currentSection.section_id}</p>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setAudioEnabled(v => !v); if (audioEnabled) cancelSpeech() }} style={{
            padding: '6px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
            background: audioEnabled ? 'rgba(0,220,255,0.07)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${audioEnabled ? 'rgba(0,220,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: audioEnabled ? '#00dcff' : 'rgba(255,255,255,0.28)',
          }}>
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>{audioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
          </button>

          {availableVoices.length > 1 && (
            <select onChange={e => { const v = availableVoices.find(v => v.name === e.target.value); if (v) selectedVoiceRef.current = v }}
              defaultValue={selectedVoiceRef.current?.name ?? ''}
              style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', background: 'rgba(0,220,255,0.04)', border: '1px solid rgba(0,220,255,0.14)', color: 'rgba(220,232,255,0.6)', cursor: 'pointer', maxWidth: 160, outline: 'none' }}>
              {availableVoices.map(v => (
                <option key={v.name} value={v.name} style={{ background: '#030712', color: '#dce8ff' }}>
                  {v.name.replace(/Microsoft |Google /, '')} ({v.lang})
                </option>
              ))}
            </select>
          )}

          {currentSection && currentSectionIdx < sections.length - 1 && (
            <button onClick={completeSection} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em',
              background: 'rgba(0,200,140,0.1)', border: '1px solid rgba(0,200,140,0.38)', color: '#00c88c',
              boxShadow: '0 0 14px rgba(0,200,140,0.12)',
            }}>
              <Check size={12} /> SECTION COMPLETE
            </button>
          )}

          {exchangeCount >= 4 && (
            <button onClick={() => setShowQuiz(true)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em',
              background: 'rgba(150,50,255,0.12)', border: '1px solid rgba(150,50,255,0.42)', color: '#b060ff',
              boxShadow: '0 0 14px rgba(150,50,255,0.15)',
            }}>
              <Brain size={12} /> QUIZ
            </button>
          )}

          {canGoNext && nextModule && (
            <button onClick={() => router.push(`/course/${nextModule}`)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em',
              background: 'rgba(0,200,140,0.12)', border: '1px solid rgba(0,200,140,0.4)', color: '#00c88c',
              boxShadow: '0 0 14px rgba(0,200,140,0.12)',
            }}>
              NEXT MODULE <ChevronRight size={12} />
            </button>
          )}
          {!canGoNext && nextModule && exchangeCount > 0 && (
            <div title="Pass the quiz to unlock next module" style={{
              padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)',
            }}>
              <Lock size={10} /> NEXT MODULE
            </div>
          )}

          <div style={{ width: 1, height: 20, background: 'rgba(0,220,255,0.12)' }} />
          <button onClick={() => setShowSections(v => !v)} title="Toggle sections" style={{
            padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
            background: showSections ? 'rgba(0,220,255,0.07)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${showSections ? 'rgba(0,220,255,0.22)' : 'rgba(255,255,255,0.07)'}`,
            color: showSections ? '#00dcff' : 'rgba(255,255,255,0.28)',
          }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setShowNotes(v => !v)} title="Toggle notes" style={{
            padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
            background: showNotes ? 'rgba(0,220,255,0.07)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${showNotes ? 'rgba(0,220,255,0.22)' : 'rgba(255,255,255,0.07)'}`,
            color: showNotes ? '#00dcff' : 'rgba(255,255,255,0.28)',
          }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Main 3-col layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 5 }}>

        {/* ── COL 1: Sections ── */}
        {showSections && (
          <div style={{
            width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column',
            background: 'rgba(0,220,255,0.015)',
            borderRight: '1px solid rgba(0,220,255,0.07)',
            backdropFilter: 'blur(24px) saturate(160%)',
          }}>
            <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid rgba(0,220,255,0.05)', flexShrink: 0 }}>
              <p className="aurora-text" style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.18em', fontWeight: 700 }}>COURSE SECTIONS</p>
            </div>

            {sections.length > 0 ? (
              <SectionTrail sections={sections} currentIdx={currentSectionIdx} progress={sectionProgress} moduleId={moduleId} onSelect={switchSection} />
            ) : !sectionsLoaded ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <Loader2 size={18} color="rgba(0,220,255,0.45)" className="animate-spin" />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>Loading…</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', textAlign: 'center', padding: '0 12px' }}>No sections found for this module</p>
              </div>
            )}

            {/* Teaching points */}
            {teachingPoints.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(0,220,255,0.05)', flexShrink: 0 }}>
                <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(150,50,255,0.75)', letterSpacing: '0.18em' }}>TOPICS</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace' }}>
                    {teachingPoints.filter(p => p.done).length}/{teachingPoints.length}
                  </p>
                </div>
                <div style={{ padding: '2px 8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {teachingPoints.map((pt, i) => {
                    const isCurrent = i === currentPointIdx && !pt.done
                    const phaseIcon = isCurrent ? ({ PRE_NOTES: '✏️', EXPLAIN: '📖', CHECK: '💬', POST_NOTES: '📝', WRAP: '🏁' }[teachingPhase] ?? '') : ''
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 8px', borderRadius: 8,
                        background: isCurrent ? 'rgba(150,50,255,0.09)' : 'transparent',
                        border: isCurrent ? '1px solid rgba(150,50,255,0.24)' : '1px solid transparent',
                        transition: 'all 0.22s',
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: pt.done ? 'rgba(0,200,140,0.15)' : isCurrent ? 'rgba(150,50,255,0.2)' : 'rgba(255,255,255,0.05)',
                          border: pt.done ? '1px solid rgba(0,200,140,0.5)' : isCurrent ? '1px solid rgba(150,50,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                        }}>
                          {pt.done
                            ? <Check size={9} color="#00c88c" />
                            : <span style={{ fontSize: 7, color: isCurrent ? '#c080ff' : 'rgba(255,255,255,0.28)', fontWeight: 700 }}>{i + 1}</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 10, lineHeight: 1.4, color: pt.done ? 'rgba(0,200,140,0.6)' : isCurrent ? '#e0c0ff' : 'rgba(255,255,255,0.32)', textDecoration: pt.done ? 'line-through' : 'none' }}>
                            {pt.title}
                          </span>
                          {isCurrent && phaseIcon && <span style={{ fontSize: 9, marginLeft: 4 }}>{phaseIcon}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Module nav */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,220,255,0.05)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              <button onClick={() => { const n = parseInt(moduleId.replace('m',''),10); if(n>1) router.push(`/course/m${String(n-1).padStart(2,'0')}`) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.28)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                <ChevronLeft size={13} /> PREV
              </button>
              {nextModule && (canGoNext ? (
                <button onClick={() => router.push(`/course/${nextModule}`)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.28)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  NEXT <ChevronRight size={13} />
                </button>
              ) : (
                <span title="Pass the quiz to unlock" style={{ color: 'rgba(255,255,255,0.14)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  <Lock size={10} /> NEXT
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── COL 2: Orb + Chat ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

          {/* ── ORB ZONE ── */}
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: 16, paddingBottom: 8,
            background: 'radial-gradient(ellipse 70% 90% at 50% 0%, rgba(0,140,255,0.04) 0%, rgba(150,0,255,0.03) 40%, transparent 70%)',
            borderBottom: '1px solid rgba(0,220,255,0.06)',
            position: 'relative',
          }}>
            {currentSection && (
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isSpeaking ? '#00dcff' : 'rgba(0,220,255,0.28)',
                  boxShadow: isSpeaking ? '0 0 10px #00dcff, 0 0 22px rgba(0,220,255,0.5)' : 'none',
                  transition: 'all 0.3s',
                }} />
                <p style={{ fontSize: 11, color: 'rgba(220,232,255,0.52)', fontFamily: 'monospace' }}>
                  <span style={{ color: '#00dcff', marginRight: 6 }}>§{currentSection.section_id}</span>
                  {currentSection.section_title}
                </p>
              </div>
            )}

            {/* Orb */}
            {!userActivated ? (
              <button onClick={() => {
                initAudioCtx(); setUserActivated(true); setTeachingPhase('PRE_NOTES')
                const hasMessages = messagesRef.current.length > 0
                if (hasMessages) {
                  const last = [...messagesRef.current].reverse().find(m => m.role === 'assistant' && m.content.trim())
                  if (last) setTimeout(() => speakTextRef.current(last.content), 100)
                } else { setTimeout(() => void doSend('__AUTO_START__', true), 150) }
              }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <AudioOrb speaking={false} analyser={null} />
                <p className="aurora-text" style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', marginTop: 4, animation: 'tapPulse 1.5s ease-in-out infinite' }}>▶ TAP TO START</p>
              </button>
            ) : (
              <AudioOrb speaking={isSpeaking} analyser={analyserRef.current} />
            )}
          </div>

          {/* Notes prompt banner */}
          {userActivated && teachingPoints.length > 0 && (
            <NotesPromptBanner phase={teachingPhase} topicTitle={teachingPoints[currentPointIdx]?.title ?? null} topicIdx={currentPointIdx} total={teachingPoints.length} />
          )}

          {/* ── Messages ── */}
          <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>
            {messages.length === 0 && !streaming && userActivated && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0,220,255,0.14), rgba(150,50,255,0.18))',
                    border: '1px solid rgba(0,220,255,0.38)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 19, fontWeight: 700, color: '#00dcff',
                    boxShadow: '0 0 22px rgba(0,220,255,0.22)',
                  }}>A</div>
                  <p style={{ fontSize: 13, color: 'rgba(220,232,255,0.52)', lineHeight: 1.65, maxWidth: 270 }}>
                    Hi, I&apos;m Alex — your AI tutor.<br />
                    Ask me anything about <span style={{ color: '#00dcff' }}>{currentSection?.section_title ?? moduleTitle}</span>, or say &ldquo;let&apos;s start&rdquo; to begin.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
              return (
                <div key={i} className="message-enter" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(0,220,255,0.16), rgba(150,50,255,0.18))',
                      border: '1px solid rgba(0,220,255,0.38)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#00dcff',
                      boxShadow: isSpeaking && isLastAssistant ? '0 0 14px rgba(0,220,255,0.5)' : '0 0 8px rgba(0,220,255,0.15)',
                      transition: 'box-shadow 0.4s',
                    }}>A</div>
                  )}
                  <div className={isSpeaking && isLastAssistant ? 'speaking-bubble' : ''} style={{
                    maxWidth: '72%', padding: '11px 16px', fontSize: 13, lineHeight: 1.68, whiteSpace: 'pre-wrap',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, rgba(150,50,255,0.22), rgba(0,100,255,0.18))'
                      : 'rgba(0,220,255,0.03)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(150,50,255,0.32)'
                      : '1px solid rgba(0,220,255,0.1)',
                    color: msg.role === 'user' ? 'rgba(220,232,255,0.92)' : 'rgba(220,232,255,0.82)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: msg.role === 'user' ? '0 0 20px rgba(150,50,255,0.1)' : 'none',
                  }}>
                    {msg.content || (msg.role === 'assistant' && <span style={{ color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>…</span>)}
                  </div>
                </div>
              )
            })}
            {streaming && messages[messages.length-1]?.role !== 'assistant' && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          {/* ── Aurora input bar ── */}
          <div style={{
            padding: '12px 20px', flexShrink: 0,
            background: 'rgba(3,7,18,0.75)',
            borderTop: '1px solid rgba(0,220,255,0.08)',
            backdropFilter: 'blur(24px) saturate(160%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = input.trim(); if (!t || streamingRef.current) return; setInput(''); void doSend(t, false) } }}
                disabled={streaming} rows={1}
                placeholder={micActive ? '// LISTENING…' : `Ask about ${currentSection?.section_id ?? 'this module'}…`}
                className="aurora-input"
                style={{
                  flex: 1, resize: 'none',
                  background: micActive ? 'rgba(255,50,50,0.05)' : 'rgba(0,220,255,0.03)',
                  border: `1px solid ${micActive ? 'rgba(255,80,80,0.38)' : 'rgba(0,220,255,0.14)'}`,
                  borderRadius: 14, padding: '12px 18px', fontSize: 13,
                  color: 'rgba(220,232,255,0.88)',
                  outline: 'none', maxHeight: 120, lineHeight: 1.55, fontFamily: 'inherit',
                  transition: 'border-color 0.22s, box-shadow 0.22s',
                }}
              />

              {/* Mic button */}
              <button onClick={toggleMic} disabled={streaming} style={{
                width: 44, height: 44, borderRadius: 14, cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${micActive ? 'rgba(255,60,60,0.5)' : 'rgba(0,220,255,0.18)'}`,
                background: micActive ? 'rgba(255,60,60,0.12)' : 'rgba(0,220,255,0.05)',
                color: micActive ? '#ff6060' : 'rgba(220,232,255,0.45)',
                boxShadow: micActive ? '0 0 18px rgba(255,60,60,0.25)' : 'none',
                animation: micActive ? 'tapPulse 1s ease-in-out infinite' : 'none',
                transition: 'all 0.22s',
              }}>
                {micActive ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Send button — aurora border */}
              <div className="aurora-border" style={{ borderRadius: 14, flexShrink: 0 }}>
                <button onClick={() => { const t = input.trim(); if (!t || streamingRef.current) return; setInput(''); void doSend(t, false) }}
                  disabled={streaming || !input.trim()} style={{
                    width: 44, height: 44, borderRadius: 13,
                    background: 'rgba(3,7,18,0.95)',
                    color: '#00dcff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (streaming || !input.trim()) ? 0.32 : 1,
                    transition: 'opacity 0.2s',
                    border: 'none',
                  }}>
                  {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>

            {micActive && (
              <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6060', display: 'inline-block', boxShadow: '0 0 8px rgba(255,60,60,0.8)', animation: 'tapPulse 0.8s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,96,96,0.8)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>LISTENING…</span>
              </div>
            )}
          </div>
        </div>

        {/* ── COL 3: Content + Notes ── */}
        {showNotes && (
          <div style={{
            width: 284, flexShrink: 0, display: 'flex', flexDirection: 'column',
            background: 'rgba(0,220,255,0.012)',
            borderLeft: '1px solid rgba(0,220,255,0.07)',
            backdropFilter: 'blur(24px) saturate(160%)',
          }}>
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,220,255,0.06)', flexShrink: 0 }}>
              {(['content', 'notes'] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)} style={{
                  flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 700,
                  color: rightTab === tab ? '#00dcff' : 'rgba(255,255,255,0.28)',
                  borderBottom: rightTab === tab ? '2px solid #00dcff' : '2px solid transparent',
                  transition: 'all 0.2s',
                  textShadow: rightTab === tab ? '0 0 10px rgba(0,220,255,0.6)' : 'none',
                }}>
                  {tab === 'content' ? 'CONTENT' : 'NOTES'}
                </button>
              ))}
            </div>

            {rightTab === 'content' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                {currentSection && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="aurora-text" style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', marginBottom: 4, fontWeight: 700 }}>§{currentSection.section_id}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(220,232,255,0.85)', lineHeight: 1.4, marginBottom: 12 }}>{currentSection.section_title}</p>
                    {currentProgress?.status !== 'completed' ? (
                      <button onClick={completeSection} style={{
                        width: '100%', padding: '8px 0', borderRadius: 9,
                        border: '1px solid rgba(0,200,140,0.35)', background: 'rgba(0,200,140,0.07)',
                        color: '#00c88c', fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                        letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12,
                        boxShadow: '0 0 12px rgba(0,200,140,0.1)',
                      }}>
                        <Check size={12} /> MARK AS DONE
                      </button>
                    ) : (
                      <div style={{
                        width: '100%', padding: '8px 0', borderRadius: 9,
                        border: '1px solid rgba(0,200,140,0.22)', background: 'rgba(0,200,140,0.05)',
                        color: 'rgba(0,200,140,0.68)', fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                        letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12,
                      }}>
                        <CheckCircle2 size={12} /> COMPLETED
                      </div>
                    )}
                  </div>
                )}
                {sectionContent ? (
                  <SectionNotePoints content={sectionContent} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, flexDirection: 'column', gap: 8 }}>
                    <Loader2 size={16} color="rgba(0,220,255,0.32)" className="animate-spin" />
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Loading content…</p>
                  </div>
                )}
              </div>
            ) : (
              <NotesPanel section={currentSection} progress={currentProgress} moduleId={moduleId}
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
        <QuizModal
          moduleId={moduleId} moduleTitle={moduleTitle} partNumber={partNumber} partTitle={partTitle}
          onClose={() => setShowQuiz(false)}
          onComplete={(passed) => { setQuizPassed(passed); setShowQuiz(false) }}
        />
      )}
    </div>
  )
}
