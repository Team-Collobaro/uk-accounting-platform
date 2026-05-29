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
import StarBorder from '@/components/reactbits/StarBorder'
import DecryptedText from '@/components/reactbits/DecryptedText'
import SoftAurora from '@/components/SoftAurora'

/* ─── types ──────────────────────────────────────────────────────────────────── */
interface Message       { role: 'user' | 'assistant'; content: string; timestamp: string; visual?: string; mcqAnswer?: string; mcqCorrect?: string }
interface Section       { section_id: string; section_title: string; section_order: number }
interface TeachingPoint { title: string; content: string; done: boolean }
interface SectionProgress {
  section_id: string; section_title: string; status: string
  notes: string; key_points: string[]
  teaching_point_idx?: number; teaching_points?: TeachingPoint[]
}

function AuroraStatus({ speaking }: { speaking: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', gap: 4, position: 'relative', zIndex: 2 }}>
      <p className="aurora-text" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', fontFamily: 'monospace' }}>
        ALEX · AI TUTOR
      </p>
      <p style={{
        fontSize: 9, letterSpacing: '0.16em', fontFamily: 'monospace',
        color: speaking ? 'var(--ac-cyan)' : 'var(--text-tertiary)',
        opacity: speaking ? 1 : 0.5,
        transition: 'all 0.3s',
        textShadow: speaking ? '0 0 8px rgba(78,205,196,0.7)' : 'none',
      }}>
        {speaking ? '◉ SPEAKING' : '○ READY'}
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION TRAIL
   ══════════════════════════════════════════════════════════════════════════════ */
function SectionTrail({ sections, currentIdx, progress, moduleId, onSelect }: {
  sections: Section[]; currentIdx: number; progress: SectionProgress[]
  moduleId: string; onSelect: (i: number) => void
}) {
  const [fetched,  setFetched]  = useState<Record<string, string[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    sections.forEach(s => {
      const saved = progress.find(p => p.section_id === s.section_id)
      if (saved?.teaching_points?.length) return
      fetch(`/api/teaching-points?moduleId=${moduleId}&sectionId=${s.section_id}`)
        .then(r => r.json() as Promise<{ points: string[]; pointContents: string[] }>)
        .then(d => { if (d.points?.length) setFetched(prev => ({ ...prev, [s.section_id]: d.points })) })
        .catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, moduleId])

  useEffect(() => {
    const cur = sections[currentIdx]
    if (cur) setExpanded(prev => new Set(prev).add(cur.section_id))
  }, [currentIdx, sections])

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const isUnlocked = (idx: number) => {
    if (idx === 0) return true
    const prev = sections[idx - 1]
    return progress.find(p => p.section_id === prev.section_id)?.status === 'completed'
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sections.map((s, i) => {
        const prog      = progress.find(p => p.section_id === s.section_id)
        const isDone    = prog?.status === 'completed'
        const isCurrent = i === currentIdx
        const locked    = !isUnlocked(i)
        const topics: TeachingPoint[] = prog?.teaching_points?.length
          ? prog.teaching_points
          : (fetched[s.section_id] ?? []).map(t => ({ title: t, content: '', done: false }))
        const doneCount = topics.filter(t => t.done).length
        const isExp     = expanded.has(s.section_id)

        return (
          <div key={s.section_id}>
            {/* row */}
            <button
              onClick={() => !locked && onSelect(i)}
              className={isCurrent ? 'trail-active' : ''}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 9, textAlign: 'left',
                cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.35 : 1,
                border: isCurrent
                  ? '1px solid var(--border-medium)'
                  : isDone ? '1px solid rgba(110,201,160,0.18)' : '1px solid transparent',
                background: isCurrent
                  ? undefined  /* .trail-active handles bg */
                  : isDone ? 'rgba(110,201,160,0.05)' : 'transparent',
                boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {/* badge */}
              <span style={{
                minWidth: 30, height: 20, borderRadius: 6, padding: '0 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
                background: isCurrent ? 'rgba(126,207,206,0.14)' : isDone ? 'rgba(110,201,160,0.12)' : 'rgba(255,255,255,0.05)',
                border: isCurrent ? '1px solid rgba(126,207,206,0.40)' : isDone ? '1px solid rgba(110,201,160,0.35)' : '1px solid rgba(255,255,255,0.1)',
                color: isCurrent ? 'var(--ac-cyan)' : isDone ? 'var(--ac-mint)' : 'var(--text-tertiary)',
              }}>
                {locked ? <Lock size={8} /> : isDone ? <Check size={9} /> : s.section_id}
              </span>

              {/* title */}
              <span style={{
                flex: 1, fontSize: 11, lineHeight: 1.35,
                color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--ac-mint)' : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.section_title}
              </span>

              {!locked && topics.length > 0 && (
                <span onClick={e => toggleExpand(s.section_id, e)} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: isDone ? 'var(--ac-mint)' : 'var(--text-tertiary)', opacity: 0.7 }}>
                    {doneCount}/{topics.length}
                  </span>
                  {isExp
                    ? <ChevronUp   size={10} color="var(--text-tertiary)" />
                    : <ChevronDown size={10} color="var(--text-tertiary)" />}
                </span>
              )}
            </button>

            {/* sub-topics */}
            {!locked && isExp && topics.length > 0 && (
              <div style={{ marginLeft: 12, marginBottom: 3, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {topics.map((pt, ti) => {
                  const isCurTopic = isCurrent && prog?.teaching_point_idx === ti && !pt.done
                  return (
                    <div key={ti} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '4px 6px', borderRadius: 6,
                      background: isCurTopic ? 'rgba(139,126,200,0.08)' : 'transparent',
                      border: isCurTopic ? '1px solid rgba(139,126,200,0.2)' : '1px solid transparent',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        background: pt.done ? 'rgba(110,201,160,0.15)' : isCurTopic ? 'rgba(139,126,200,0.18)' : 'rgba(255,255,255,0.04)',
                        border: pt.done ? '1px solid rgba(110,201,160,0.5)' : isCurTopic ? '1px solid rgba(139,126,200,0.45)' : '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {pt.done
                          ? <Check size={8} color="var(--ac-mint)" />
                          : <span style={{ fontSize: 6, color: isCurTopic ? 'var(--ac-violet)' : 'var(--text-tertiary)', fontWeight: 700 }}>{ti + 1}</span>
                        }
                      </div>
                      <span style={{
                        fontSize: 10, lineHeight: 1.4,
                        color: pt.done ? 'var(--ac-mint)' : isCurTopic ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        textDecoration: pt.done ? 'line-through' : 'none', opacity: pt.done ? 0.6 : 1,
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

/* ══════════════════════════════════════════════════════════════════════════════
   NOTES PANEL
   ══════════════════════════════════════════════════════════════════════════════ */
function NotesPanel({ section, progress, moduleId, onSave }: {
  section: Section | null; progress: SectionProgress | null
  moduleId: string; onSave: (notes: string, kp: string[]) => void
}) {
  const [notes,  setNotes]  = useState(progress?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [kpOpen, setKpOpen] = useState(true)

  useEffect(() => { setNotes(progress?.notes ?? '') }, [progress])

  const save = async () => {
    if (!section) return
    setSaving(true)
    await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, sectionId: section.section_id, sectionTitle: section.section_title,
        notes, keyPoints: progress?.key_points ?? [], status: progress?.status ?? 'in_progress' }) })
    onSave(notes, progress?.key_points ?? [])
    setSaving(false)
  }

  const download = () => {
    if (!section) return
    const text = [`Section ${section.section_id}: ${section.section_title}`, '─'.repeat(50), '',
      'KEY POINTS:', ...(progress?.key_points ?? []).map(p => `• ${p}`), '', 'MY NOTES:', notes].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a   = document.createElement('a'); a.href = url
    a.download = `Section_${section.section_id}_notes.txt`; a.click(); URL.revokeObjectURL(url)
  }

  const panel: React.CSSProperties = {
    background: 'rgba(12,16,32,0.6)', border: '1px solid var(--border-subtle)',
    borderRadius: 10, padding: '10px 12px',
    boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)',
  }

  if (!section) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-tertiary)', fontSize: 12, padding: 20, textAlign: 'center' }}>
      Select a section to view notes
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 10px', overflow: 'hidden' }}>
      {/* header */}
      <div style={panel}>
        <p className="label-mono aurora-text" style={{ marginBottom: 3 }}>Section {section.section_id}</p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{section.section_title}</p>
      </div>

      {/* key insights */}
      {(progress?.key_points ?? []).length > 0 && (
        <div style={panel}>
          <button onClick={() => setKpOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: kpOpen ? 8 : 0 }}>
            <Brain size={12} color="var(--ac-violet)" />
            <span className="label-mono" style={{ flex: 1, textAlign: 'left', color: 'var(--text-accent)' }}>Key Insights</span>
            {kpOpen ? <ChevronUp size={10} color="var(--text-tertiary)" /> : <ChevronDown size={10} color="var(--text-tertiary)" />}
          </button>
          {kpOpen && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(progress?.key_points ?? []).map((pt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(139,126,200,0.18)', border: '1px solid rgba(139,126,200,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--ac-violet)', flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* textarea */}
      <div style={{ ...panel, flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
          <PenLine size={10} color="var(--ac-cyan)" /> MY NOTES
        </label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={`Write your notes for section ${section.section_id}…`}
          className="aurora-input"
          style={{ flex: 1, resize: 'none', background: 'rgba(7,9,20,0.6)',
            border: '1px solid var(--border-subtle)', borderRadius: 8,
            padding: '9px 11px', fontSize: 12, color: 'var(--text-primary)',
            outline: 'none', lineHeight: 1.6, minHeight: 90, fontFamily: 'inherit',
            transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' }}
        />
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
        <button onClick={save} disabled={saving} style={{
          flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(126,207,206,0.18), rgba(139,126,200,0.14))',
          border: '1px solid rgba(126,207,206,0.28)', color: 'var(--ac-cyan)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s',
        }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} SAVE
        </button>
        <button onClick={download} title="Download" style={{
          padding: '9px 13px', borderRadius: 9, cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)', boxShadow: 'var(--shadow-sm)',
        }}>
          <Download size={13} />
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION NOTE-POINTS
   ══════════════════════════════════════════════════════════════════════════════ */
function SectionNotePoints({ content }: { content: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const groups = extractNotePoints(content)
  const copyAll = () => {
    const lines: string[] = []
    for (const g of groups) {
      if (g.subHeading) lines.push(`\n▸ ${g.subHeading}`)
      for (const b of g.bullets) lines.push(`  • ${b}`)
    }
    void navigator.clipboard.writeText(lines.join('\n').trim()).then(() => { setCopied('all'); setTimeout(() => setCopied(null), 1800) })
  }
  const copyBullet = (text: string) => {
    void navigator.clipboard.writeText(`• ${text}`).then(() => { setCopied(text); setTimeout(() => setCopied(null), 1500) })
  }
  if (!groups.length) return <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No key points extracted yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="label-mono aurora-text">Key Points</span>
        <button onClick={copyAll} style={{
          background: copied === 'all' ? 'rgba(110,201,160,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${copied === 'all' ? 'rgba(110,201,160,0.35)' : 'var(--border-subtle)'}`,
          borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          fontSize: 9, fontFamily: 'monospace', color: copied === 'all' ? 'var(--ac-mint)' : 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.18s',
        }}>
          {copied === 'all' ? <Check size={9} /> : <Download size={9} />}
          {copied === 'all' ? 'COPIED' : 'COPY ALL'}
        </button>
      </div>
      {groups.map((g, gi) => (
        <div key={gi} style={{
          background: 'rgba(12,16,32,0.55)', border: '1px solid var(--border-subtle)',
          borderRadius: 9, overflow: 'hidden',
          boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          {g.subHeading && (
            <div style={{ padding: '6px 11px', background: 'rgba(139,126,200,0.07)', borderBottom: '1px solid rgba(139,126,200,0.12)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ac-violet)', fontFamily: 'monospace' }}>▸ {g.subHeading}</span>
            </div>
          )}
          <div style={{ padding: '5px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {g.bullets.map((b, bi) => (
              <div key={bi} onClick={() => copyBullet(b)} title="Click to copy"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 7, padding: '4px 7px',
                  borderRadius: 6, cursor: 'pointer',
                  background: copied === b ? 'rgba(110,201,160,0.07)' : 'transparent',
                  border: `1px solid ${copied === b ? 'rgba(110,201,160,0.28)' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (copied !== b) (e.currentTarget as HTMLElement).style.background = 'rgba(126,207,206,0.05)' }}
                onMouseLeave={e => { if (copied !== b) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: copied === b ? 'var(--ac-mint)' : 'var(--ac-cyan)',
                  boxShadow: `0 0 4px ${copied === b ? 'var(--ac-mint)' : 'var(--ac-cyan)'}`, opacity: 0.7 }} />
                <span style={{ fontSize: 11, lineHeight: 1.55, flex: 1,
                  color: copied === b ? 'var(--ac-mint)' : 'var(--text-secondary)' }}>
                  {b}
                </span>
                {copied === b ? <Check size={9} color="var(--ac-mint)" style={{ flexShrink: 0, marginTop: 4 }} />
                  : <span style={{ fontSize: 8, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 5, fontFamily: 'monospace', opacity: 0.5 }}>COPY</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function extractNotePoints(content: string): { subHeading: string | null; bullets: string[] }[] {
  if (!content) return []
  const subRe = /\[(\d+\.\d+\.\d+(?:\.\d+)?\s+[^\]]{2,80})\]/g
  const parts: { heading: string | null; text: string }[] = []
  let lastIndex = 0, match: RegExpExecArray | null
  while ((match = subRe.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push({ heading: null, text: content.slice(lastIndex, match.index) })
    const hs = match.index + match[0].length; lastIndex = hs
    const nm = subRe.exec(content)
    if (nm) { parts.push({ heading: match[1].trim(), text: content.slice(hs, nm.index) }); lastIndex = nm.index; subRe.lastIndex = nm.index }
    else { parts.push({ heading: match[1].trim(), text: content.slice(hs) }); lastIndex = content.length }
  }
  if (lastIndex < content.length) parts.push({ heading: null, text: content.slice(lastIndex) })
  if (!parts.length) parts.push({ heading: null, text: content })
  return parts.map(part => {
    const raw = part.text.replace(/\s+/g, ' ').trim()
    const bullets = (raw.match(/[^.!?]+[.!?]/g) ?? []).map(s => s.trim())
      .filter(s => s.length >= 15 && s.length <= 180)
      .filter(s => !/^(the|a|an|this|that|these|those|it|in|at|on|for|and|or)\b/i.test(s))
      .slice(0, 5)
    return { subHeading: part.heading, bullets }
  }).filter(p => p.bullets.length || p.subHeading)
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONTENT PARSER — splits assistant text into plain text + structured blocks
   ══════════════════════════════════════════════════════════════════════════════ */
type MCQData = { question: string; options: Array<{ letter: string; text: string }>; correct: string }
type LabeledItem = { label: string; desc: string }

type ContentSegment =
  | { kind: 'text';    text: string }
  | { kind: 'pillars'; title: string; items: LabeledItem[] }
  | { kind: 'steps';   title: string; items: LabeledItem[] }
  | { kind: 'terms';   title: string; items: LabeledItem[] }
  | { kind: 'mcq';     data: MCQData }

// Split "Label — Description" or "Label :: Description" or plain text
function splitLabelDesc(line: string): LabeledItem {
  const stripped = line.replace(/^[-*\d.]+\s*/, '').trim()
  // Try em-dash variants: —  –  -
  const m = stripped.match(/^(.+?)\s+(?:—|–|::)\s+(.+)$/)
  if (m) return { label: m[1].trim(), desc: m[2].trim() }
  return { label: stripped, desc: '' }
}

function parseContent(raw: string): ContentSegment[] {
  // Strip :::VISUAL signal lines — they're just a trigger for the diagram, not displayed text
  const cleaned = raw.replace(/:::VISUAL\n?/g, '')
  const segments: ContentSegment[] = []
  const blockRe = /\n?:::(PILLARS|STEPS|TERMS|MCQ)\n([\s\S]*?):::/g
  raw = cleaned
  let last = 0
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(raw)) !== null) {
    if (m.index > last) {
      const txt = raw.slice(last, m.index).trim()
      if (txt) segments.push({ kind: 'text', text: txt })
    }
    const type = m[1] as 'PILLARS' | 'STEPS' | 'TERMS' | 'MCQ'
    const body = m[2].trim()
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean)

    if (type === 'MCQ') {
      const question = lines[0] ?? ''
      const options: Array<{ letter: string; text: string }> = []
      let correct = ''
      for (const l of lines.slice(1)) {
        const optM = l.match(/^([A-D])\.\s+(.+)/)
        if (optM) { options.push({ letter: optM[1], text: optM[2] }); continue }
        const corM = l.match(/^CORRECT:\s*([A-D])/)
        if (corM) correct = corM[1]
      }
      segments.push({ kind: 'mcq', data: { question, options, correct } })
    } else {
      const title = lines[0] ?? ''
      const items = lines.slice(1).map(splitLabelDesc)
      const kind = type === 'PILLARS' ? 'pillars' : type === 'STEPS' ? 'steps' : 'terms'
      segments.push({ kind, title, items } as ContentSegment)
    }
    last = m.index + m[0].length
  }
  const tail = raw.slice(last).trim()
  if (tail) segments.push({ kind: 'text', text: tail })
  return segments
}

/* ── Inline visual blocks rendered inside the chat bubble ── */
const BLOCK_COLORS = ['#4ECDC4', '#9B6FD0', '#52D98B', '#E8B84B', '#E87B6F']

// Shared card renderer — each item gets its own highlighted card with a coloured accent bar
function KeyCardsBlock({ title, items, accentColor, numbered, connector }: {
  title: string
  items: LabeledItem[]
  accentColor: string
  numbered: boolean
  connector?: boolean  // draw a line between items (for steps)
}) {
  return (
    <div className="visual-card-enter" style={{
      marginTop: 12, borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${accentColor}22`,
      background: 'rgba(4,6,14,0.82)',
      boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}08`,
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 14px 8px',
        borderBottom: `1px solid ${accentColor}18`,
        background: `linear-gradient(90deg, ${accentColor}0d 0%, transparent 100%)`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
        <p style={{ fontSize: 10, fontWeight: 700, color: accentColor, fontFamily: 'monospace', letterSpacing: '0.13em', textTransform: 'uppercase', margin: 0 }}>{title}</p>
      </div>

      {/* Cards */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: connector ? 0 : 7 }}>
        {items.map((item, i) => {
          const color = BLOCK_COLORS[i % BLOCK_COLORS.length]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 0, position: 'relative' }}>
              {/* Connector line for steps */}
              {connector && i < items.length - 1 && (
                <div style={{ position: 'absolute', left: 15, top: 30, bottom: -10, width: 1, background: `${color}25`, zIndex: 0 }} />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                padding: connector ? '0 0 14px' : 0, position: 'relative', zIndex: 1 }}>
                {/* Number badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: numbered ? 9 : '50%',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                  background: `${color}14`, border: `1px solid ${color}38`, color,
                  boxShadow: `0 0 10px ${color}18`,
                }}>
                  {numbered ? (i + 1) : '▸'}
                </div>
                {/* Card body */}
                <div style={{
                  flex: 1, minWidth: 0,
                  background: `${color}07`,
                  border: `1px solid ${color}18`,
                  borderLeft: `3px solid ${color}70`,
                  borderRadius: '0 10px 10px 0',
                  padding: '8px 12px',
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color, margin: '0 0 3px', lineHeight: 1.3 }}>
                    {item.label}
                  </p>
                  {item.desc && (
                    <p style={{ fontSize: 12, color: '#8EA8CC', margin: 0, lineHeight: 1.6 }}>
                      {item.desc}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PillarsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} accentColor="#4ECDC4" numbered={true} />
}

function StepsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} accentColor="#9B6FD0" numbered={true} connector={true} />
}

function TermsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} accentColor="#E8B84B" numbered={false} />
}

/* ── MCQ interactive block ── */
function MCQBlock({ data, onAnswer, answered }: { data: MCQData; onAnswer: (letter: string, text: string) => void; answered: string | null }) {
  const COLORS: Record<string, string> = { A: '#4ECDC4', B: '#9B6FD0', C: '#52D98B', D: '#E8B84B' }
  return (
    <div className="visual-card-enter" style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(78,205,196,0.18)', background: 'rgba(5,8,16,0.75)' }}>
      <div style={{ padding: '10px 14px 9px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#4ECDC4', fontFamily: 'monospace' }}>?</span>
        </div>
        <p style={{ fontSize: 13, color: '#E8F0FC', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{data.question}</p>
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.options.map(opt => {
          const isSelected = answered === opt.letter
          const isCorrect  = answered !== null && opt.letter === data.correct
          const isWrong    = answered === opt.letter && opt.letter !== data.correct
          const color = COLORS[opt.letter] ?? '#4ECDC4'

          let bg = 'rgba(255,255,255,0.02)'
          let border = 'rgba(255,255,255,0.08)'
          let textColor = '#8EA8CC'
          if (isCorrect && answered !== null) { bg = 'rgba(82,217,139,0.1)'; border = 'rgba(82,217,139,0.35)'; textColor = '#52D98B' }
          else if (isWrong)                   { bg = 'rgba(232,123,111,0.1)'; border = 'rgba(232,123,111,0.35)'; textColor = '#E87B6F' }
          else if (isSelected)                { bg = `${color}12`; border = `${color}40`; textColor = color }

          return (
            <button
              key={opt.letter}
              disabled={answered !== null}
              onClick={() => onAnswer(opt.letter, `${opt.letter}. ${opt.text}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9,
                background: bg, border: `1px solid ${border}`,
                cursor: answered !== null ? 'default' : 'pointer',
                textAlign: 'left', width: '100%',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { if (answered === null) (e.currentTarget as HTMLElement).style.background = `${color}10` }}
              onMouseLeave={e => { if (answered === null) (e.currentTarget as HTMLElement).style.background = bg }}
            >
              <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: 'monospace', background: `${color}18`, border: `1px solid ${color}35`, color }}>
                {opt.letter}
              </div>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: textColor, flex: 1 }}>{opt.text}</span>
              {isCorrect && answered !== null && <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>}
              {isWrong                          && <span style={{ fontSize: 14, flexShrink: 0 }}>✗</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Renders a full assistant message: plain text + inline structured blocks ── */
function AssistantMessage({ content, svg, onAnswer, answeredMcq }: { content: string; svg?: string; onAnswer?: (letter: string, text: string) => void; answeredMcq?: string | null }) {
  const segments = parseContent(content)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text')    return <span key={i} style={{ display: 'block' }}>{seg.text}</span>
        if (seg.kind === 'pillars' || seg.kind === 'steps' || seg.kind === 'terms') {
          if (seg.kind === 'pillars') return <PillarsBlock key={i} title={seg.title} items={seg.items} />
          if (seg.kind === 'steps')   return <StepsBlock   key={i} title={seg.title} items={seg.items} />
          return                             <TermsBlock   key={i} title={seg.title} items={seg.items} />
        }
        if (seg.kind === 'mcq')     return <MCQBlock     key={i} data={seg.data} onAnswer={onAnswer ?? (()=>{})} answered={answeredMcq ?? null} />
        return null
      })}
      {svg && <VisualCard svg={svg} />}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VISUAL CARD — renders AI-generated SVG diagram beneath assistant bubbles
   ══════════════════════════════════════════════════════════════════════════════ */
function VisualCard({ svg }: { svg: string }) {
  return (
    <div className="visual-card-enter" style={{
      marginTop: 8,
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(78,205,196,0.18)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(78,205,196,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
      width: '100%',
    }}>
      <div
        style={{ lineHeight: 0, display: 'block' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   TYPING INDICATOR
   ══════════════════════════════════════════════════════════════════════════════ */
function TypingIndicator() {
  return (
    <div className="message-enter" style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(78,205,196,0.18), rgba(155,111,208,0.18))',
        border: '1.5px solid rgba(78,205,196,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--ac-cyan)',
        boxShadow: '0 0 12px rgba(78,205,196,0.2)',
      }}>A</div>
      <div style={{
        background: 'rgba(10,14,28,0.82)',
        border: '1px solid rgba(78,205,196,0.14)',
        borderRadius: '16px 16px 16px 4px',
        padding: '11px 16px',
        boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {[0,1,2].map(i => <span key={i} className="typing-dot" style={{ display: 'inline-block' }} />)}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginLeft: 4, letterSpacing: '0.06em' }}>thinking…</span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   NOTES PROMPT BANNER
   ══════════════════════════════════════════════════════════════════════════════ */
function NotesPromptBanner({ phase, topicTitle, topicIdx, total }: {
  phase: 'PRE_NOTES'|'EXPLAIN'|'CONFIRM'|'POST_NOTES'|'CHECK'|'WRAP'
  topicTitle: string|null; topicIdx: number; total: number
}) {
  if (!topicTitle) return null
  const cfg: Record<string, { icon: string; label: string; hint: string; accent: string }> = {
    PRE_NOTES:  { icon: '✏️', label: 'WRITE HEADING', hint: `Write "${topicTitle}" as a heading in your notes.`, accent: 'var(--ac-gold)' },
    EXPLAIN:    { icon: '📖', label: 'LISTENING',      hint: `Alex is explaining "${topicTitle}".`, accent: 'var(--ac-cyan)' },
    CONFIRM:    { icon: '📝', label: 'UPDATE NOTES',   hint: `Update your notes for "${topicTitle}", then reply when ready.`, accent: 'var(--ac-mint)' },
    POST_NOTES: { icon: '💬', label: 'QUICK CHECK',    hint: `Answer the question about "${topicTitle}".`, accent: 'var(--ac-violet)' },
    CHECK:      { icon: '💬', label: 'ANSWER',          hint: `Answer Alex's question about "${topicTitle}".`, accent: 'var(--ac-violet)' },
    WRAP:       { icon: '🏁', label: 'WRAP-UP',         hint: 'Final check — answer the question to complete this section.', accent: 'var(--ac-cyan)' },
  }
  const c = cfg[phase]; if (!c) return null
  return (
    <div style={{
      margin: '0 20px 8px', padding: '9px 14px', borderRadius: 9, flexShrink: 0,
      background: 'rgba(12,16,32,0.65)', border: `1px solid ${c.accent}28`,
      boxShadow: `var(--shadow-sm), 0 0 12px ${c.accent}14`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 14 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.14em', color: c.accent }}>{c.label}</span>
          {total > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>· {topicIdx+1}/{total}</span>}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>{c.hint}</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   QUIZ MODAL
   ══════════════════════════════════════════════════════════════════════════════ */
function QuizModal({ moduleId, moduleTitle, partNumber, partTitle, onClose, onComplete }: {
  moduleId: string; moduleTitle: string; partNumber: number; partTitle: string
  onClose: () => void; onComplete: (passed: boolean, score: number) => void
}) {
  const [questions,  setQuestions]  = useState<QuizQuestion[]>([])
  const [answers,    setAnswers]    = useState<Record<string,string>>({})
  const [result,     setResult]     = useState<{
    score:number; total:number; percentage:number; passed:boolean; weakAreas:string[]
    explanations:Record<string,{correct:string;explanation:string;userAnswer:string}>
  }|null>(null)
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({moduleId,moduleTitle,partNumber,partTitle,count:5})})
      .then(r=>r.json() as Promise<{questions:QuizQuestion[]}>)
      .then(d=>{setQuestions(d.questions??[]);setLoading(false)})
      .catch(()=>setLoading(false))
  },[moduleId,moduleTitle,partNumber,partTitle])

  const handleSubmit = async () => {
    setSubmitting(true)
    const res  = await fetch('/api/quiz/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({moduleId,answers,questions})})
    const data = await res.json() as typeof result
    setResult(data); setSubmitting(false)
    if (data) onComplete(data.passed, data.percentage)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(3,5,14,0.85)', zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(10px)' }}>
      {/* bordered wrapper */}
      <div className="aurora-border" style={{ width:'100%', maxWidth:620, maxHeight:'88vh', borderRadius:16 }}>
        <div style={{
          display:'flex', flexDirection:'column', background:'var(--bg-elevated)',
          borderRadius:15, maxHeight:'88vh',
          boxShadow:'var(--shadow-xl)',
        }}>
          {/* header */}
          <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border-subtle)',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:9,
                background:'linear-gradient(135deg,rgba(126,207,206,0.18),rgba(139,126,200,0.16))',
                border:'1px solid var(--border-medium)', display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'var(--shadow-sm)' }}>
                <Brain size={17} color="var(--ac-cyan)" />
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>Knowledge Check</p>
                <p className="label-mono" style={{ color:'var(--text-tertiary)' }}>{moduleTitle}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', fontSize:18, lineHeight:1, padding:4 }}>✕</button>
          </div>

          {/* body */}
          <div style={{ flex:1, overflowY:'auto', padding:'18px 22px', display:'flex', flexDirection:'column', gap:18 }}>
            {loading && <div style={{ display:'flex',justifyContent:'center',padding:'40px 0' }}><Loader2 size={26} color="var(--ac-cyan)" className="animate-spin" /></div>}

            {!loading && result && (
              <div style={{ borderRadius:11, padding:'14px 18px',
                background: result.passed ? 'rgba(110,201,160,0.07)' : 'rgba(196,123,138,0.07)',
                border: `1px solid ${result.passed ? 'rgba(110,201,160,0.28)' : 'rgba(196,123,138,0.25)'}`,
                boxShadow: `var(--shadow-sm), 0 0 20px ${result.passed?'rgba(110,201,160,0.1)':'rgba(196,123,138,0.08)'}`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  {result.passed
                    ? <CheckCircle2 size={19} color="var(--ac-mint)" />
                    : <XCircle size={19} color="var(--ac-rose)" />}
                  <p style={{ fontWeight:700, color:result.passed?'var(--ac-mint)':'var(--ac-rose)', fontSize:14 }}>
                    {result.passed ? `Passed — ${result.percentage}%` : `Not yet — ${result.percentage}%`}
                  </p>
                </div>
                {result.weakAreas.length > 0 && <p style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:5 }}>Revisit: {result.weakAreas.join(', ')}</p>}
              </div>
            )}

            {!loading && questions.map((q, qi) => (
              <div key={q.id} style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <p style={{ fontSize:13, color:'var(--text-primary)', fontWeight:500, lineHeight:1.55 }}>{qi+1}. {q.question}</p>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {q.options.map(opt => (
                    <label key={opt} style={{
                      display:'flex', alignItems:'flex-start', gap:10, padding:'9px 13px',
                      borderRadius:9, cursor:result?'default':'pointer', transition:'all 0.18s',
                      background: answers[q.id]===opt ? 'rgba(126,207,206,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${answers[q.id]===opt ? 'rgba(126,207,206,0.32)' : 'var(--border-subtle)'}`,
                      boxShadow: answers[q.id]===opt ? '0 0 10px rgba(126,207,206,0.08)' : 'none',
                    }}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id]===opt}
                        onChange={()=>!result&&setAnswers(p=>({...p,[q.id]:opt}))}
                        style={{ marginTop:2, accentColor:'var(--ac-cyan)' }} />
                      <span style={{ fontSize:12, color:answers[q.id]===opt?'var(--text-primary)':'var(--text-secondary)', lineHeight:1.5 }}>{opt}</span>
                    </label>
                  ))}
                </div>
                {result?.explanations[q.id] && (
                  <div style={{ padding:'9px 13px', borderRadius:9, fontSize:11, lineHeight:1.5,
                    background: answers[q.id]===result.explanations[q.id].correct ? 'rgba(110,201,160,0.07)' : 'rgba(196,123,138,0.07)',
                    color: answers[q.id]===result.explanations[q.id].correct ? 'var(--ac-mint)' : 'var(--ac-rose)',
                    border: `1px solid ${answers[q.id]===result.explanations[q.id].correct ? 'rgba(110,201,160,0.22)' : 'rgba(196,123,138,0.2)'}`,
                  }}>
                    <strong>Correct: {result.explanations[q.id].correct}</strong> — {result.explanations[q.id].explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* footer */}
          <div style={{ padding:'13px 22px', borderTop:'1px solid var(--border-subtle)', display:'flex', justifyContent:'flex-end', gap:9 }}>
            {!result ? (
              <>
                <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:9, background:'none',
                  border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>Cancel</button>
                <StarBorder
                  as="button"
                  onClick={handleSubmit}
                  disabled={submitting||Object.keys(answers).length<questions.length}
                  color="rgba(78,205,196,0.9)"
                  speed="3.5s"
                  thickness={1}
                  style={{
                    opacity:(submitting||Object.keys(answers).length<questions.length)?0.38:1,
                    cursor:(submitting||Object.keys(answers).length<questions.length)?'not-allowed':'pointer',
                    borderRadius: 9,
                  }}
                >
                  <span className="btn btn-primary" style={{ padding:'8px 20px', display:'flex', alignItems:'center', gap:6, border:'none', background:'none', boxShadow:'none' }}>
                    {submitting && <Loader2 size={13} className="animate-spin" />} Submit
                  </span>
                </StarBorder>
              </>
            ) : (
              <button onClick={onClose} style={{
                padding:'8px 20px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer',
                background: result.passed ? 'rgba(110,201,160,0.12)' : 'rgba(196,123,138,0.08)',
                border: `1px solid ${result.passed ? 'rgba(110,201,160,0.35)' : 'rgba(196,123,138,0.25)'}`,
                color: result.passed ? 'var(--ac-mint)' : 'var(--ac-rose)',
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

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE SKELETON
   ══════════════════════════════════════════════════════════════════════════════ */
function PageSkeleton() {
  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* HUD bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 52, flexShrink: 0,
        background: 'var(--glass-lg)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 60, height: 22 }} />
          <div className="skeleton" style={{ width: 160, height: 28 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 99 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ width: 72, height: 28 }} />
          <div className="skeleton" style={{ width: 72, height: 28 }} />
          <div className="skeleton" style={{ width: 32, height: 28 }} />
        </div>
      </header>

      {/* 3-col body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* left col */}
        <div style={{
          width: 220, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(11,15,28,0.97) 0%, rgba(8,11,22,0.98) 100%)',
          borderRight: '1px solid var(--border-subtle)',
          padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div className="skeleton" style={{ width: '55%', height: 14 }} />
          {[90, 140, 110, 125, 105, 145].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 34, borderRadius: 9 }} />
          ))}
        </div>

        {/* centre col */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* orb zone */}
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: 22, paddingBottom: 18, gap: 12,
            borderBottom: '1px solid rgba(78,205,196,0.12)',
          }}>
            <div className="skeleton" style={{ width: 220, height: 220, borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: 240, height: 52, borderRadius: 6 }} />
          </div>

          {/* messages area */}
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton" style={{ width: '65%', height: 68, borderRadius: '14px 14px 14px 3px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="skeleton" style={{ width: '45%', height: 44, borderRadius: '14px 14px 3px 14px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton" style={{ width: '72%', height: 88, borderRadius: '14px 14px 14px 3px' }} />
            </div>
          </div>

          {/* input bar */}
          <div style={{
            padding: '10px 16px', flexShrink: 0,
            background: 'var(--glass-lg)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <div className="skeleton" style={{ flex: 1, height: 42, borderRadius: 12 }} />
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 11 }} />
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 11 }} />
          </div>
        </div>

        {/* right col */}
        <div style={{
          width: 276, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(11,15,28,0.97) 0%, rgba(8,11,22,0.98) 100%)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
            <div className="skeleton" style={{ flex: 1, height: 14, margin: '0 16px', borderRadius: 4 }} />
            <div className="skeleton" style={{ flex: 1, height: 14, margin: '0 16px', borderRadius: 4 }} />
          </div>
          <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="skeleton" style={{ width: '60%', height: 14 }} />
            <div className="skeleton" style={{ width: '100%', height: 20 }} />
            <div className="skeleton" style={{ width: '100%', height: 36, borderRadius: 8 }} />
            {[0,1,2,3,4].map(i => (
              <div key={i} className="skeleton" style={{ width: '100%', height: 56, borderRadius: 9 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function CourseModulePage() {
  const params   = useParams()
  const router   = useRouter()
  const moduleId = params.moduleId as string
  const supabase = createClientComponentClient()

  const [moduleTitle, setModuleTitle] = useState(moduleId.toUpperCase())
  const [partNumber,  setPartNumber]  = useState(1)
  const [partTitle,   setPartTitle]   = useState('')
  const [nextModule,  setNextModule]  = useState<string|null>(null)

  const [sections,          setSections]          = useState<Section[]>([])
  const [sectionsLoaded,    setSectionsLoaded]    = useState(false)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const currentSection = sections[currentSectionIdx] ?? null

  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([])
  const currentProgress = sectionProgress.find(p => p.section_id === currentSection?.section_id) ?? null

  const [sectionContent, setSectionContent] = useState('')
  const [rightTab,       setRightTab]       = useState<'notes'|'content'>('content')

  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [streaming,     setStreaming]      = useState(false)
  const [sessionId,     setSessionId]     = useState<string|undefined>()
  const [exchangeCount, setExchangeCount] = useState(0)
  const [showQuiz,      setShowQuiz]      = useState(false)
  const [quizPassed,    setQuizPassed]    = useState(false)
  const [moduleAlreadyCompleted, setModuleAlreadyCompleted] = useState(false)

  const [audioEnabled,    setAudioEnabled]    = useState(true)
  const [micActive,       setMicActive]       = useState(false)
  const [isSpeaking,      setIsSpeaking]      = useState(false)
  const [userActivated,   setUserActivated]   = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

  const [sessionKP,      setSessionKP]      = useState<string[]>([])
  const [teachingPoints, setTeachingPoints] = useState<TeachingPoint[]>([])
  const [currentPtIdx,   setCurrentPtIdx]   = useState(0)
  const tpRef    = useRef<TeachingPoint[]>([])
  const tpIdxRef = useRef(0)
  useEffect(() => { tpRef.current    = teachingPoints }, [teachingPoints])
  useEffect(() => { tpIdxRef.current = currentPtIdx   }, [currentPtIdx])

  type TPhase = 'PRE_NOTES'|'EXPLAIN'|'CONFIRM'|'POST_NOTES'|'CHECK'|'WRAP'
  const [tPhase,  setTPhase]  = useState<TPhase>('PRE_NOTES')
  const tPhaseRef = useRef<TPhase>('PRE_NOTES')
  useEffect(() => { tPhaseRef.current = tPhase }, [tPhase])

  const chatEndRef     = useRef<HTMLDivElement>(null)
  const msgsRef        = useRef<Message[]>([])
  const streamRef      = useRef(false)
  const abortRef       = useRef<AbortController|null>(null)
  const sidRef         = useRef<string|undefined>()
  const mTitleRef      = useRef(moduleId.toUpperCase())
  const pNumRef        = useRef(1)
  const pTitleRef      = useRef('')
  const audioRef       = useRef(true)
  const bufRef         = useRef('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef         = useRef<any>(null)
  const hasStarted     = useRef(false)
  const micRef         = useRef(false)
  const autoMicTimer   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const startMicRef    = useRef<()=>void>(()=>{})
  const micStoppedRef  = useRef(false)
  const micManualRef   = useRef(false)
  const speakRef       = useRef<(t:string)=>void>(()=>{})
  const activatedRef   = useRef(false)
  const playingRef     = useRef(false)
  const analyserRef    = useRef<AnalyserNode|null>(null)
  const secRef         = useRef<Section|null>(null)
  const doneSecsRef    = useRef<string[]>([])
  const voiceRef       = useRef<SpeechSynthesisVoice|null>(null)

  useEffect(()=>{ msgsRef.current    = messages   },[messages])
  useEffect(()=>{ streamRef.current  = streaming  },[streaming])
  useEffect(()=>{ sidRef.current     = sessionId  },[sessionId])
  useEffect(()=>{ mTitleRef.current  = moduleTitle},[moduleTitle])
  useEffect(()=>{ pNumRef.current    = partNumber },[partNumber])
  useEffect(()=>{ pTitleRef.current  = partTitle  },[partTitle])
  useEffect(()=>{ audioRef.current   = audioEnabled},[audioEnabled])
  useEffect(()=>{ micRef.current     = micActive  },[micActive])
  useEffect(()=>{ activatedRef.current = userActivated},[userActivated])
  useEffect(()=>{ secRef.current     = currentSection},[currentSection])
  useEffect(()=>{ doneSecsRef.current = sectionProgress.filter(p=>p.status==='completed').map(p=>p.section_id) },[sectionProgress])
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}) },[messages,streaming])

  /* ── Audio ── */
  useEffect(()=>{
    if (typeof window==='undefined'||!('speechSynthesis' in window)) return
    const pick=()=>{
      const vs=[...window.speechSynthesis.getVoices().filter(v=>v.lang==='en-GB'),
                ...window.speechSynthesis.getVoices().filter(v=>v.lang!=='en-GB'&&v.lang.startsWith('en'))]
      setAvailableVoices(vs)
      if (!voiceRef.current) voiceRef.current=vs[0]??null
    }
    pick(); window.speechSynthesis.addEventListener('voiceschanged',pick)
    return ()=>window.speechSynthesis.removeEventListener('voiceschanged',pick)
  },[])

  const initAudioCtx = useCallback(()=>{},[])

  const speakText = useCallback((text: string, onFinished?: ()=>void)=>{
    if (!audioRef.current) return
    if (typeof window==='undefined'||!('speechSynthesis' in window)) return
    if (micRef.current){recRef.current?.stop();setMicActive(false)}
    playingRef.current=true; setIsSpeaking(true)
    const u=new SpeechSynthesisUtterance(text); u.lang='en-GB'; u.rate=1.05
    if (voiceRef.current) u.voice=voiceRef.current
    u.onend=()=>{ if (!window.speechSynthesis.speaking){playingRef.current=false;setIsSpeaking(false)}; onFinished?.() }
    u.onerror=()=>{ if (!window.speechSynthesis.speaking){playingRef.current=false;setIsSpeaking(false)}; onFinished?.() }
    window.speechSynthesis.speak(u)
  },[])

  const cancelSpeech = useCallback(()=>{
    playingRef.current=false; setIsSpeaking(false)
    if (typeof window!=='undefined'&&'speechSynthesis' in window) window.speechSynthesis.cancel()
    bufRef.current=''
  },[])

  const speakFinal = useCallback((text:string,onFinished?:()=>void)=>{
    if (!audioRef.current){onFinished?.();return}
    if (typeof window==='undefined'||!('speechSynthesis' in window)){onFinished?.();return}
    if (!text){onFinished?.();return}
    const u=new SpeechSynthesisUtterance(text); u.lang='en-GB'; u.rate=1.05
    if (voiceRef.current) u.voice=voiceRef.current
    u.onend=()=>{playingRef.current=false;setIsSpeaking(false);onFinished?.()}
    u.onerror=()=>{playingRef.current=false;setIsSpeaking(false);onFinished?.()}
    window.speechSynthesis.speak(u)
  },[])

  const feedToken = useCallback((tok:string)=>{
    if (!audioRef.current) return
    bufRef.current+=tok
    // Once any ::: block or :::VISUAL signal starts, stop feeding to speech
    const blockStart = bufRef.current.search(/\n?:::(?:VISUAL|PILLARS|STEPS|TERMS|MCQ)/)
    const speech = blockStart >= 0 ? bufRef.current.slice(0, blockStart) : bufRef.current
    if (blockStart >= 0) { bufRef.current = speech; return }
    const sm=speech.match(/^([\s\S]*[.!?])\s+(.*)/)
    if (sm){speakText(sm[1]);bufRef.current=sm[2];return}
    const cm=speech.match(/^((?:\S+\s+){5,}[\s\S]*?[,;:])\s+(.*)/)
    if (cm){speakText(cm[1]);bufRef.current=cm[2]}
  },[speakText])

  const flushSpeech = useCallback(()=>{
    // Strip :::VISUAL signal and all :::BLOCK::: content — only speak plain text
    const stripped = bufRef.current.replace(/:::VISUAL\n?/g, '').replace(/\n?:::[A-Z]+\n[\s\S]*?:::/g, '').trim()
    const r=stripped; bufRef.current=''
    const maybeRestartMic=()=>{ if (!micStoppedRef.current&&micManualRef.current) startMicRef.current() }
    if (audioRef.current&&r){
      speakFinal(r,()=>{ maybeRestartMic() })
    } else {
      const wait=()=>{
        if (window.speechSynthesis.speaking) setTimeout(wait,200)
        else { playingRef.current=false; setIsSpeaking(false); maybeRestartMic() }
      }
      if (typeof window!=='undefined'&&window.speechSynthesis.speaking) wait()
      else { maybeRestartMic() }
    }
  },[speakFinal])

  useEffect(()=>{ speakRef.current=speakText },[speakText])

  /* ── Full cleanup on page leave ── */
  useEffect(()=>()=>{
    // Cancel TTS
    if (typeof window!=='undefined'&&'speechSynthesis' in window) window.speechSynthesis.cancel()
    // Abort any in-flight fetch stream
    abortRef.current?.abort()
    abortRef.current = null
    // Stop mic
    recRef.current?.stop()
    // Clear auto-mic restart timer
    if (autoMicTimer.current) clearTimeout(autoMicTimer.current)
  },[])

  /* ── stopAll — cancel streaming + speech + mic ── */
  const stopAll = useCallback(()=>{
    abortRef.current?.abort()
    abortRef.current = null
    cancelSpeech()
    setStreaming(false)
    bufRef.current = ''
    micStoppedRef.current = true
    micManualRef.current = false
    if (autoMicTimer.current){clearTimeout(autoMicTimer.current);autoMicTimer.current=null}
    recRef.current?.stop()
    setMicActive(false)
  },[cancelSpeech])

  /* ── doSend ── */
  const doSend = useCallback(async(text:string, silent:boolean)=>{
    if (streamRef.current) return
    if (autoMicTimer.current){clearTimeout(autoMicTimer.current);autoMicTimer.current=null}
    if (micRef.current){recRef.current?.stop();setMicActive(false)}
    cancelSpeech(); setStreaming(true)
    const abort = new AbortController()
    abortRef.current = abort
    if (!silent){
      setExchangeCount(n=>n+1)
      setMessages(prev=>[...prev,{role:'user',content:text,timestamp:new Date().toISOString()}])
    }
    setMessages(prev=>[...prev,{role:'assistant',content:'',timestamp:new Date().toISOString()}])
    try {
      const pts=tpRef.current; const ptIdx=tpIdxRef.current; const cp=pts[ptIdx]??null
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
        signal: abort.signal,
        body:JSON.stringify({message:text,moduleId,sessionId:sidRef.current,
          moduleTitle:mTitleRef.current,partNumber:pNumRef.current,partTitle:pTitleRef.current,
          currentSection:secRef.current,completedSections:doneSecsRef.current,
          teachingPointIdx:ptIdx,teachingPointTitle:cp?.title??null,
          teachingPointContent:cp?.content??null,
          totalTeachingPoints:pts.length,allTeachingPoints:pts.map(p=>p.title),phase:tPhaseRef.current})})
      if (!res.body) throw new Error('no body')
      const reader=res.body.getReader(); const dec=new TextDecoder()
      let lb='',full=''
      while (true){
        const {done,value}=await reader.read(); if (done) break
        lb+=dec.decode(value,{stream:true})
        const lines=lb.split('\n'); lb=lines.pop()??''
        for (const line of lines){
          if (!line.startsWith('data: ')) continue
          try {
            const p=JSON.parse(line.slice(6)) as {token?:string;done?:boolean;sessionId?:string}
            if (p.token){const tok=p.token;full+=tok;setMessages(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],content:full};return u});feedToken(tok)}
            if (p.sessionId) setSessionId(p.sessionId)
            if (p.done) flushSpeech()
          } catch{/* ignore */}
        }
      }
      flushSpeech()

      if (full.trim()) {
        const msgIdx = msgsRef.current.length - 1

        // Extract MCQ correct answer
        const mcqCorM = full.match(/:::MCQ[\s\S]*?CORRECT:\s*([A-D])[\s\S]*?:::/)
        const mcqCorrectLetter = mcqCorM ? mcqCorM[1] : undefined

        // Detect if visual is warranted — AI marks it with :::VISUAL or content has structured data
        const wantsVisual = /:::VISUAL/.test(full) ||
          /:::(?:PILLARS|STEPS|TERMS)/.test(full) ||
          /(?:three|four|five|2|3|4|5)\s+(?:pillars?|steps?|stages?|types?|principles?|rules?|rates?)/i.test(full) ||
          /£[\d,]+|[\d.]+%/.test(full)

        // PRE-GENERATE visual BEFORE showing message — await so image is ready when message appears
        let svg: string | null = null
        if (wantsVisual) {
          try {
            const vr = await fetch('/api/visual', { method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ content: full.replace(/:::VISUAL/g,'').slice(0, 800) }) })
            const vd = await vr.json() as { svg: string | null }
            svg = vd.svg ?? null
          } catch { svg = null }
        }

        // Now reveal the message with visual already attached (no patch needed)
        setMessages(prev => {
          const u = [...prev]
          if (u[msgIdx]) u[msgIdx] = {
            ...u[msgIdx],
            ...(svg ? { visual: svg } : {}),
            ...(mcqCorrectLetter ? { mcqCorrect: mcqCorrectLetter } : {}),
          }
          return u
        })
      }

      if (!silent&&full.trim()){
        const plainFull=full.replace(/:::VISUAL\n?/g,'').replace(/\n?:::[A-Z]+\n[\s\S]*?:::/g,'').trim()
        const pts2=plainFull.match(/[^.!?]+[.!?]/g)??[]
        const kps=pts2.map(s=>s.trim()).filter(s=>s.length>20&&s.length<200).slice(0,3)
        if (kps.length){
          setSessionKP(prev=>{const c=[...new Set([...prev,...kps])].slice(0,10)
            if (secRef.current) void fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({moduleId,sectionId:secRef.current.section_id,sectionTitle:secRef.current.section_title,keyPoints:c,status:'in_progress'})})
            return c})
          setSectionProgress(prev=>{ const ex=prev.find(p=>p.section_id===secRef.current?.section_id)
            if (!ex||!secRef.current) return prev
            return prev.map(p=>p.section_id===secRef.current!.section_id
              ?{...p,key_points:[...new Set([...p.key_points,...kps])].slice(0,10)}:p)})
        }
      }

      if (full.trim()){
        const ph=tPhaseRef.current
        // Phase flow: PRE_NOTES → EXPLAIN → CONFIRM → POST_NOTES(MCQ) → CHECK → advance → PRE_NOTES
        if (ph==='PRE_NOTES'||text==='__AUTO_START__') setTPhase('EXPLAIN')
        else if (ph==='EXPLAIN') setTPhase('CONFIRM')      // teach done → wait for student to confirm ready
        else if (ph==='CONFIRM') setTPhase('POST_NOTES')   // student confirmed → show MCQ
        else if (ph==='POST_NOTES') setTPhase('CHECK')     // MCQ shown → wait for answer
        else if (ph==='CHECK') {
          // Wrong-answer branch: Alex explained the mistake → advance topic
          const pts3=tpRef.current; const idx=tpIdxRef.current; const isLast=idx>=pts3.length-1
          const updated=pts3.map((p,ii)=>ii===idx?{...p,done:true}:p)
          setTeachingPoints(updated)
          const nextIdx=isLast?idx:idx+1
          setCurrentPtIdx(nextIdx)
          setTPhase(isLast?'WRAP':'PRE_NOTES')
          if (secRef.current) void fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({moduleId,sectionId:secRef.current.section_id,sectionTitle:secRef.current.section_title,
              status:'in_progress',teachingPointIdx:nextIdx,teachingPoints:updated})})
        }
      }
    } catch(err) {
      if ((err as {name?:string})?.name !== 'AbortError') {
        setMessages(prev=>{const u=[...prev];u[u.length-1]={...u[u.length-1],content:'Sorry, something went wrong.'};return u})
      }
    } finally { setStreaming(false); abortRef.current=null }
  },[moduleId,cancelSpeech,feedToken,flushSpeech])

  /* ── advanceTopic — move to next teaching point, called after correct MCQ answer ── */
  const advanceTopic = useCallback((speakFeedback: string) => {
    const pts = tpRef.current
    const idx = tpIdxRef.current
    const isLast = idx >= pts.length - 1

    // Mark current topic done
    const updated = pts.map((p, i) => i === idx ? { ...p, done: true } : p)
    setTeachingPoints(updated)

    const nextIdx = isLast ? idx : idx + 1
    setCurrentPtIdx(nextIdx)
    setTPhase(isLast ? 'WRAP' : 'PRE_NOTES')

    if (secRef.current) {
      void fetch('/api/notes', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ moduleId, sectionId: secRef.current.section_id,
          sectionTitle: secRef.current.section_title, status:'in_progress',
          teachingPointIdx: nextIdx, teachingPoints: updated }) })
    }

    // Speak the brief correct-answer feedback then auto-continue
    if (speakFeedback) {
      const u = new SpeechSynthesisUtterance(speakFeedback)
      u.lang = 'en-GB'; u.rate = 1.05
      if (voiceRef.current) u.voice = voiceRef.current
      u.onend = () => { void doSend('__AUTO_START__', true) }
      u.onerror = () => { void doSend('__AUTO_START__', true) }
      window.speechSynthesis.speak(u)
    } else {
      void doSend('__AUTO_START__', true)
    }
  }, [moduleId, doSend])

  /* ── data loading ── */
  useEffect(()=>{
    const n=parseInt(moduleId.replace('m',''),10); if (n<87) setNextModule(`m${String(n+1).padStart(2,'0')}`)
    Promise.all([
      fetch(`/api/module-meta?moduleId=${moduleId}`).then(r=>r.json() as Promise<{module_title:string;part_number:number;part_title:string}|null>),
      fetch('/api/progress').then(r=>r.json() as Promise<{completedModules:string[]}>),
    ]).then(([m,pg])=>{
      if (m){setModuleTitle(m.module_title??moduleId.toUpperCase());setPartNumber(m.part_number??1);setPartTitle(m.part_title??'')}
      if (pg?.completedModules?.includes(moduleId)) setModuleAlreadyCompleted(true)
    }).catch(()=>{})
  },[moduleId])

  useEffect(()=>{
    fetch(`/api/sections?moduleId=${moduleId}`)
      .then(r=>r.json() as Promise<{sections:Section[]}>)
      .then(d=>{if (d.sections?.length) setSections(d.sections);setSectionsLoaded(true)})
      .catch(()=>setSectionsLoaded(true))
  },[moduleId])

  useEffect(()=>{
    fetch(`/api/notes?moduleId=${moduleId}`)
      .then(r=>r.json() as Promise<{progress:SectionProgress[]}>)
      .then(d=>{if (d.progress) setSectionProgress(d.progress)})
      .catch(()=>{})
  },[moduleId])

  useEffect(()=>{
    if (!currentSection) return
    const sv=sectionProgress.find(p=>p.section_id===currentSection.section_id)
    if (sv?.teaching_points?.length){setTeachingPoints(sv.teaching_points);setCurrentPtIdx(sv.teaching_point_idx??0);return}
    void fetch(`/api/teaching-points?moduleId=${moduleId}&sectionId=${currentSection.section_id}`)
      .then(r=>r.json() as Promise<{points:string[];pointContents:string[]}>)
      .then(d=>{
        if (d.points?.length){
          setTeachingPoints(d.points.map((t,i)=>({title:t,content:d.pointContents?.[i]??'',done:false})))
          setCurrentPtIdx(0)
        }
      })
      .catch(()=>{})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[currentSection?.section_id,moduleId])

  useEffect(()=>{
    if (sessionKP.length&&currentSection){
      setSectionProgress(prev=>{
        const ex=prev.find(p=>p.section_id===currentSection.section_id)
        if (ex) return prev.map(p=>p.section_id===currentSection.section_id?{...p,key_points:sessionKP}:p)
        return [...prev,{section_id:currentSection.section_id,section_title:currentSection.section_title,status:'in_progress',notes:'',key_points:sessionKP}]
      })
    }
  },[sessionKP,currentSection])

  useEffect(()=>{
    if (!currentSection) return
    setSectionContent('')
    fetch(`/api/section-content?moduleId=${moduleId}&sectionId=${encodeURIComponent(currentSection.section_id)}`)
      .then(r=>r.json() as Promise<{content:string}>)
      .then(d=>{if (d.content) setSectionContent(d.content)})
      .catch(()=>{})
  },[currentSection,moduleId])

  /* ── Auto-start: fire as soon as sections are loaded, no tap required ── */
  useEffect(()=>{
    if (!sectionsLoaded || !currentSection || hasStarted.current) return
    hasStarted.current = true
    setUserActivated(true)
    setTPhase('PRE_NOTES')
    void doSend('__AUTO_START__', true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sectionsLoaded, currentSection])

  const switchSection = useCallback((idx:number)=>{
    if (idx===currentSectionIdx) return
    setCurrentSectionIdx(idx); setMessages([]); setSessionKP([])
    setTeachingPoints([]); setCurrentPtIdx(0); setTPhase('PRE_NOTES')
    hasStarted.current=false; cancelSpeech()
  },[currentSectionIdx,cancelSpeech])

  const completeSection = useCallback(()=>{
    if (!currentSection) return
    setSectionProgress(prev=>{
      const ex=prev.find(p=>p.section_id===currentSection.section_id)
      const upd:SectionProgress=ex?{...ex,status:'completed'}:{section_id:currentSection.section_id,section_title:currentSection.section_title,status:'completed',notes:'',key_points:sessionKP}
      void fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({moduleId,sectionId:currentSection.section_id,sectionTitle:currentSection.section_title,status:'completed',keyPoints:sessionKP})})
      return ex?prev.map(p=>p.section_id===currentSection.section_id?upd:p):[...prev,upd]
    })
    if (currentSectionIdx<sections.length-1) switchSection(currentSectionIdx+1)
  },[currentSection,currentSectionIdx,sections.length,switchSection,sessionKP,moduleId])

  /* ── mic ── */
  const startMicImpl = useCallback(()=>{
    if (!activatedRef.current||micRef.current||streamRef.current) return
    if (typeof window==='undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR=(window as any).SpeechRecognition??(window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec=new SR() as any; rec.lang='en-GB'; rec.continuous=false; rec.interimResults=true
    let got=false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult=(ev:any)=>{
      const t=Array.from(ev.results as ArrayLike<{0:{transcript:string};isFinal:boolean}>).map(r=>r[0].transcript).join('')
      setInput(t)
      if ((ev.results as ArrayLike<{isFinal:boolean}>)[ev.results.length-1].isFinal){got=true;setMicActive(false);setInput('');if (t.trim()) void doSend(t.trim(),false)}
    }
    const restart=(ms:number)=>{
      if (streamRef.current||playingRef.current||micStoppedRef.current||!micManualRef.current) return
      autoMicTimer.current=setTimeout(()=>{if (!streamRef.current&&!playingRef.current&&!micStoppedRef.current&&micManualRef.current) startMicRef.current()},ms)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror=(ev:any)=>{setMicActive(false);if (ev.error==='no-speech'||ev.error==='audio-capture') restart(500)}
    rec.onend=()=>{setMicActive(false);if (!got) restart(300)}
    rec.start(); recRef.current=rec; setMicActive(true)
  },[doSend])
  useEffect(()=>{ startMicRef.current=startMicImpl },[startMicImpl])

  const toggleMic = useCallback(()=>{
    if (micActive){micStoppedRef.current=true;micManualRef.current=false;recRef.current?.stop();setMicActive(false);return}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).SpeechRecognition&&!(window as any).webkitSpeechRecognition){alert('Speech recognition not supported. Try Chrome or Edge.');return}
    micStoppedRef.current=false;micManualRef.current=true; startMicImpl()
  },[micActive,startMicImpl])

  const completedCount = sectionProgress.filter(p=>p.status==='completed').length
  const totalSections  = sections.length
  const progressPct    = totalSections>0 ? Math.round(completedCount/totalSections*100) : 0
  const canGoNext      = quizPassed||moduleAlreadyCompleted
  const [showSections, setShowSections] = useState(true)
  const [showNotes,    setShowNotes]    = useState(true)

  /* ── shared button styles ── */
  const hudBtn = (active: boolean, accent = 'var(--ac-cyan)', accentRgb = '126,207,206'): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
    background: active ? `rgba(${accentRgb},0.12)` : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? `rgba(${accentRgb},0.30)` : 'var(--border-subtle)'}`,
    color: active ? accent : 'var(--text-secondary)',
    boxShadow: active ? `var(--shadow-sm), 0 0 12px rgba(${accentRgb},0.1)` : 'var(--shadow-sm)',
    transition: 'all 0.18s ease',
    letterSpacing: '0.04em',
  })

  /* ══ RENDER ══ */
  if (!sectionsLoaded) return <PageSkeleton />

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative',
    }}>
      {/* ── HUD BAR ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 52, flexShrink: 0, zIndex: 10,
        background: 'var(--glass-lg)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(24px) saturate(150%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04), var(--shadow-sm)',
      }}>
        {/* left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 7, transition: 'color 0.18s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color='var(--text-primary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color='var(--text-tertiary)'}>
            <ChevronLeft size={15} />
            <span style={{ fontSize: 11, letterSpacing: '0.08em', fontFamily: 'monospace' }}>BACK</span>
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
          <div>
            <p style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.16em', color: 'var(--ac-cyan)', opacity: 0.75 }}>PART {partNumber} · {moduleId.toUpperCase()}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <DecryptedText text={moduleTitle} animateOn="view" sequential={true} revealDirection="start" speed={28} className="aurora-text" encryptedClassName="aurora-text" />
            </p>
          </div>
        </div>

        {/* centre — progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <p style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-tertiary)', letterSpacing: '0.12em', marginBottom: 3, textAlign: 'right' }}>
              {completedCount}/{totalSections} sections
            </p>
            <div style={{ width: 160, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99,
              overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)' }}>
              <div className="aurora-progress-fill" style={{ height: '100%', width: `${progressPct}%`, transition: 'width 0.55s ease' }} />
            </div>
          </div>
          {currentSection && (
            <div className="depth-pill" style={{ padding: '3px 10px' }}>
              <p style={{ fontSize: 10, color: 'var(--ac-cyan)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>§ {currentSection.section_id}</p>
            </div>
          )}
        </div>

        {/* right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => { setAudioEnabled(v=>!v); if (audioEnabled) cancelSpeech() }} style={hudBtn(audioEnabled)}>
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span style={{ fontFamily: 'monospace' }}>{audioEnabled ? 'AUDIO' : 'MUTED'}</span>
          </button>

          {availableVoices.length > 1 && (
            <select onChange={e => { const v=availableVoices.find(v=>v.name===e.target.value); if (v) voiceRef.current=v }}
              defaultValue={voiceRef.current?.name ?? ''}
              style={{ padding: '4px 7px', borderRadius: 7, fontSize: 11, fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', cursor: 'pointer', maxWidth: 145, outline: 'none' }}>
              {availableVoices.map(v=>(
                <option key={v.name} value={v.name} style={{ background: '#0C1020', color: '#D8E4F0' }}>
                  {v.name.replace(/Microsoft |Google /,'').slice(0,18)} ({v.lang})
                </option>
              ))}
            </select>
          )}

          {currentSection && currentSectionIdx < sections.length-1 && (
            <button onClick={completeSection} style={hudBtn(false,'var(--ac-mint)','110,201,160')}>
              <Check size={12} /> Done
            </button>
          )}

          {exchangeCount >= 4 && (
            <StarBorder
              as="button"
              onClick={()=>setShowQuiz(true)}
              color="rgba(155,111,208,0.85)"
              speed="4s"
              thickness={1}
              style={{
                ...hudBtn(false,'var(--ac-violet)','139,126,200'),
                padding: '0',
                borderRadius: 8,
              }}
            >
              <span style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px' }}>
                <Brain size={12} /> Quiz
              </span>
            </StarBorder>
          )}

          {canGoNext && nextModule && (
            <button onClick={()=>router.push(`/course/${nextModule}`)} style={hudBtn(true,'var(--ac-mint)','110,201,160')}>
              Next <ChevronRight size={12} />
            </button>
          )}
          {!canGoNext && nextModule && exchangeCount > 0 && (
            <div title="Pass the quiz to unlock" style={{ ...hudBtn(false), opacity: 0.4, cursor: 'default' }}>
              <Lock size={10} /> Next
            </div>
          )}

          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
          <button onClick={()=>setShowSections(v=>!v)} style={hudBtn(showSections)} title="Toggle sections">
            <ChevronLeft size={13} />
          </button>
          <button onClick={()=>setShowNotes(v=>!v)} style={hudBtn(showNotes)} title="Toggle notes">
            <ChevronRight size={13} />
          </button>
        </div>
      </header>

      {/* ── MAIN 3-COL ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 5 }}>

        {/* COL 1 — Sections */}
        {showSections && (
          <div style={{
            width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(180deg, rgba(11,15,28,0.97) 0%, rgba(8,11,22,0.98) 100%)',
            borderRight: '1px solid var(--border-subtle)',
            boxShadow: '2px 0 18px rgba(0,0,0,0.4), inset -1px 0 0 rgba(255,255,255,0.025)',
          }}>
            <div style={{ padding: '10px 12px 7px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <p className="label-mono aurora-text">Course Sections</p>
            </div>

            {sections.length > 0 ? (
              <SectionTrail sections={sections} currentIdx={currentSectionIdx} progress={sectionProgress} moduleId={moduleId} onSelect={switchSection} />
            ) : !sectionsLoaded ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                <Loader2 size={17} color="var(--ac-cyan)" className="animate-spin" style={{ opacity:0.5 }} />
                <p style={{ fontSize:11, color:'var(--text-tertiary)' }}>Loading…</p>
              </div>
            ) : (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <p style={{ fontSize:11, color:'var(--text-tertiary)', padding:'0 12px', textAlign:'center' }}>No sections found</p>
              </div>
            )}

            {/* teaching topics */}
            {teachingPoints.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ padding:'7px 12px 4px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <p className="label-mono" style={{ color:'var(--ac-violet)', opacity:0.8 }}>Topics</p>
                  <p style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:'monospace' }}>
                    {teachingPoints.filter(p=>p.done).length}/{teachingPoints.length}
                  </p>
                </div>
                <div style={{ padding:'2px 8px 10px', display:'flex', flexDirection:'column', gap:2 }}>
                  {teachingPoints.map((pt,i)=>{
                    const isCur=i===currentPtIdx&&!pt.done
                    const icon=isCur ? ({PRE_NOTES:'✏️',EXPLAIN:'📖',CONFIRM:'📝',POST_NOTES:'💬',CHECK:'💬',WRAP:'🏁'}[tPhase]??'') : ''
                    return (
                      <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:7,padding:'4px 8px',borderRadius:8,
                        background:isCur?'rgba(139,126,200,0.08)':'transparent',
                        border:isCur?'1px solid rgba(139,126,200,0.2)':'1px solid transparent',transition:'all 0.2s' }}>
                        <div style={{ width:15,height:15,borderRadius:'50%',flexShrink:0,marginTop:1,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          background:pt.done?'rgba(110,201,160,0.14)':isCur?'rgba(139,126,200,0.18)':'rgba(255,255,255,0.04)',
                          border:pt.done?'1px solid rgba(110,201,160,0.45)':isCur?'1px solid rgba(139,126,200,0.42)':'1px solid rgba(255,255,255,0.09)' }}>
                          {pt.done ? <Check size={8} color="var(--ac-mint)" />
                            : <span style={{fontSize:6,color:isCur?'var(--ac-violet)':'var(--text-tertiary)',fontWeight:700}}>{i+1}</span>}
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <span style={{ fontSize:10,lineHeight:1.4,
                            color:pt.done?'var(--ac-mint)':isCur?'var(--text-primary)':'var(--text-tertiary)',
                            textDecoration:pt.done?'line-through':'none', opacity:pt.done?0.6:1 }}>
                            {pt.title}
                          </span>
                          {isCur&&icon&&<span style={{fontSize:9,marginLeft:4}}>{icon}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* module nav */}
            <div style={{ padding:'9px 12px',borderTop:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',flexShrink:0 }}>
              <button onClick={()=>{const n=parseInt(moduleId.replace('m',''),10);if(n>1)router.push(`/course/m${String(n-1).padStart(2,'0')}`)}}
                style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-tertiary)',fontSize:10,display:'flex',alignItems:'center',gap:3,fontFamily:'monospace',letterSpacing:'0.08em' }}>
                <ChevronLeft size={12} /> PREV
              </button>
              {nextModule&&(canGoNext
                ?<button onClick={()=>router.push(`/course/${nextModule}`)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-tertiary)',fontSize:10,display:'flex',alignItems:'center',gap:3,fontFamily:'monospace',letterSpacing:'0.08em' }}>
                    NEXT <ChevronRight size={12} />
                  </button>
                :<span style={{ color:'var(--text-tertiary)',fontSize:10,display:'flex',alignItems:'center',gap:3,fontFamily:'monospace',letterSpacing:'0.08em',opacity:0.45 }}>
                    <Lock size={9} /> NEXT
                  </span>
              )}
            </div>
          </div>
        )}

        {/* COL 2 — Avatar + Chat */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, position:'relative' }}>

          {/* ── AVATAR ZONE ── */}
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: 18, paddingBottom: 14,
            borderBottom: '1px solid rgba(78,205,196,0.12)',
            boxShadow: 'inset 0 -1px 0 rgba(78,205,196,0.06), 0 4px 40px rgba(0,0,0,0.3)',
            position: 'relative', zIndex: 1,
            overflow: 'hidden',
            minHeight: 200,
          }}>

            {/* SoftAurora — audio-visualizer avatar */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
              <SoftAurora
                speed={0.45}
                scale={1.3}
                brightness={1.1}
                color1="#4ecdc4"
                color2="#9b6fd0"
                noiseFrequency={2.0}
                noiseAmplitude={0.7}
                bandHeight={0.5}
                bandSpread={0.9}
                octaveDecay={0.12}
                layerOffset={0.9}
                colorSpeed={0.7}
                enableMouseInteraction={true}
                mouseInfluence={0.18}
              />
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 8 }}>

              {/* section label */}
              {currentSection && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: isSpeaking ? 'var(--ac-cyan)' : 'var(--border-medium)',
                    boxShadow: isSpeaking ? 'var(--glow-cyan)' : 'none',
                    transition: 'all 0.4s', animation: isSpeaking ? 'onlinePulse 2s infinite' : 'none',
                  }} />
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                    <span style={{ color: 'var(--ac-cyan)', marginRight: 5 }}>§{currentSection.section_id}</span>
                    {currentSection.section_title.length > 38 ? currentSection.section_title.slice(0,36)+'…' : currentSection.section_title}
                  </p>
                </div>
              )}

              <AuroraStatus speaking={isSpeaking} />

            </div>
          </div>

          {/* notes prompt banner */}
          {teachingPoints.length > 0 && (
            <NotesPromptBanner phase={tPhase} topicTitle={teachingPoints[currentPtIdx]?.title??null} topicIdx={currentPtIdx} total={teachingPoints.length} />
          )}

          {/* ── MESSAGES ── */}
          <div className="chat-messages" style={{ flex:1, overflowY:'auto', padding:'16px 18px 8px', display:'flex', flexDirection:'column', gap:4, position:'relative', zIndex:1 } as React.CSSProperties}>

            {/* top fade mask */}
            <div style={{ position:'sticky', top:0, left:0, right:0, height:28, marginBottom:-28, pointerEvents:'none', zIndex:2,
              background:'linear-gradient(to bottom, var(--bg-base) 0%, transparent 100%)', flexShrink:0 }} />

            {messages.length === 0 && !streaming && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', paddingTop:32 }}>
                <div style={{
                  textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14,
                  background:'rgba(10,14,28,0.6)', border:'1px solid var(--border-subtle)',
                  borderRadius:16, padding:'24px 28px', maxWidth:280,
                  boxShadow:'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.04)',
                  backdropFilter:'blur(12px)',
                }}>
                  <div style={{
                    width:48, height:48, borderRadius:'50%',
                    background:'linear-gradient(135deg,rgba(78,205,196,0.18),rgba(155,111,208,0.22))',
                    border:'1.5px solid rgba(78,205,196,0.35)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, fontWeight:700, color:'var(--ac-cyan)',
                    boxShadow:'0 0 24px rgba(78,205,196,0.25)',
                  }}>A</div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>
                      Hi, I&apos;m Alex
                    </p>
                    <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.7 }}>
                      Your AI tutor for<br/>
                      <span style={{ color:'var(--ac-cyan)', fontWeight:500 }}>{currentSection?.section_title ?? moduleTitle}</span>
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
                    {['Explain this topic','Give me an example','Quiz me'].map(s => (
                      <button key={s} onClick={()=>{ setInput(s) }}
                        style={{
                          padding:'5px 11px', borderRadius:20, fontSize:11, cursor:'pointer',
                          background:'rgba(78,205,196,0.07)', border:'1px solid rgba(78,205,196,0.2)',
                          color:'var(--ac-cyan)', transition:'all 0.18s', fontFamily:'inherit',
                        }}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(78,205,196,0.14)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(78,205,196,0.07)'}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* date/session divider shown once above first message */}
            {messages.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'8px 0 12px', flexShrink:0 }}>
                <div style={{ flex:1, height:1, background:'var(--border-subtle)' }} />
                <span style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.12em', color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>
                  SESSION · {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                </span>
                <div style={{ flex:1, height:1, background:'var(--border-subtle)' }} />
              </div>
            )}

            {messages.map((msg, i) => {
              const isLastAss = msg.role==='assistant' && i===messages.length-1
              const isUser    = msg.role==='user'
              // Group: show avatar only on first message of a consecutive run
              const prevSameRole = i > 0 && messages[i-1].role === msg.role
              const nextSameRole = i < messages.length-1 && messages[i+1].role === msg.role

              // Bubble radius logic: squish corners between grouped messages
              let radius: string
              if (isUser) {
                radius = prevSameRole
                  ? nextSameRole ? '14px 4px 4px 14px' : '14px 4px 14px 14px'
                  : nextSameRole ? '14px 14px 4px 14px' : '14px 14px 4px 14px'
              } else {
                radius = prevSameRole
                  ? nextSameRole ? '4px 14px 14px 4px' : '4px 14px 14px 14px'
                  : nextSameRole ? '14px 14px 14px 4px' : '16px 16px 16px 4px'
              }

              return (
                <div key={i} className="message-enter"
                  style={{
                    display:'flex', alignItems:'flex-end', gap:8,
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    marginBottom: nextSameRole ? 2 : 10,
                  }}>

                  {/* Avatar — only on last of a group */}
                  {!isUser && (
                    <div style={{
                      width:30, height:30, borderRadius:'50%', flexShrink:0,
                      visibility: nextSameRole ? 'hidden' : 'visible',
                      background:'linear-gradient(135deg,rgba(78,205,196,0.18),rgba(155,111,208,0.18))',
                      border:'1.5px solid rgba(78,205,196,0.32)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700, color:'var(--ac-cyan)',
                      boxShadow: isSpeaking && isLastAss ? '0 0 14px rgba(78,205,196,0.4)' : '0 0 8px rgba(78,205,196,0.12)',
                      transition:'box-shadow 0.4s ease',
                    }}>A</div>
                  )}

                  <div style={{ display:'flex', flexDirection:'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap:2, maxWidth: isUser ? '74%' : '88%' }}>
                    <div style={{
                      padding: isUser ? '9px 14px' : '10px 15px',
                      fontSize:13, lineHeight:1.75,
                      borderRadius: radius,
                      background: isUser
                        ? 'linear-gradient(135deg, rgba(91,110,175,0.28), rgba(155,111,208,0.20))'
                        : 'rgba(10,14,28,0.82)',
                      border: isUser
                        ? '1px solid rgba(155,111,208,0.30)'
                        : '1px solid rgba(78,205,196,0.10)',
                      borderLeft: !isUser ? '2px solid rgba(78,205,196,0.28)' : undefined,
                      color: 'var(--text-primary)',
                      backdropFilter:'blur(16px)',
                      boxShadow: isUser
                        ? '0 2px 12px rgba(155,111,208,0.15)'
                        : isSpeaking && isLastAss
                          ? '0 2px 12px rgba(78,205,196,0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
                          : '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
                      transition:'box-shadow 0.4s ease',
                    }}>
                      {isUser
                        ? (msg.content || null)
                        : msg.content
                          ? <AssistantMessage
                              content={msg.content}
                              svg={msg.visual}
                              answeredMcq={msg.mcqAnswer ?? null}
                              onAnswer={(letter, fullText) => {
                                if (msg.mcqAnswer) return // already answered
                                // Lock the MCQ immediately
                                setMessages(prev => prev.map((m, mi) => mi === i ? { ...m, mcqAnswer: letter } : m))
                                const correct = msg.mcqCorrect
                                if (correct && letter === correct) {
                                  // Correct — advance to next topic directly, no AI call
                                  advanceTopic('Correct! Well done.')
                                } else {
                                  // Wrong — ask Alex for explanation, then advance
                                  void doSend(fullText, false)
                                }
                              }}
                            />
                          : <span style={{ color:'var(--text-tertiary)', fontStyle:'italic', fontSize:12 }}>…</span>
                      }
                    </div>

                    {/* Timestamp — only on last of a group */}
                    {!nextSameRole && (
                      <span style={{
                        fontSize:9, color:'var(--text-tertiary)', fontFamily:'monospace',
                        letterSpacing:'0.06em', paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0,
                        opacity:0.6,
                      }}>
                        {new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {streaming && messages[messages.length-1]?.role!=='assistant' && <TypingIndicator />}
            <div ref={chatEndRef} style={{ height:8 }} />
          </div>

          {/* ── INPUT BAR ── */}
          <div style={{
            padding:'10px 14px 12px', flexShrink:0,
            background:'var(--glass-lg)',
            borderTop:'1px solid var(--border-subtle)',
            backdropFilter:'blur(24px) saturate(150%)',
            boxShadow:'0 -1px 0 rgba(255,255,255,0.03)',
          }}>
            <div style={{
              display:'flex', alignItems:'flex-end', gap:8,
              background:'rgba(8,11,22,0.7)',
              border:`1px solid ${micActive ? 'rgba(232,80,122,0.35)' : streaming ? 'rgba(78,205,196,0.18)' : 'rgba(78,205,196,0.12)'}`,
              borderRadius:14, padding:'8px 8px 8px 14px',
              boxShadow:'inset 0 2px 8px rgba(0,0,0,0.4)',
              transition:'border-color 0.22s',
            }}>
              <textarea
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();const t=input.trim();if (!t||streamRef.current) return;setInput('');void doSend(t,false)} }}
                disabled={streaming} rows={1}
                placeholder={micActive ? '🎤  Listening…' : streaming ? 'Alex is responding…' : `Message Alex…`}
                className="aurora-input"
                style={{
                  flex:1, resize:'none',
                  background:'transparent',
                  border:'none',
                  padding:'4px 0', fontSize:13,
                  color: micActive ? 'var(--ac-rose)' : 'var(--text-primary)',
                  outline:'none', maxHeight:110,
                  lineHeight:1.6, fontFamily:'inherit', transition:'color 0.2s',
                  boxShadow:'none',
                }}
              />

              {/* mic */}
              <button onClick={toggleMic} disabled={streaming} title={micActive ? 'Stop mic' : 'Use mic'} style={{
                width:34, height:34, borderRadius:9, cursor:'pointer', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: micActive ? 'rgba(232,80,122,0.14)' : 'transparent',
                border: `1px solid ${micActive ? 'rgba(232,80,122,0.35)' : 'transparent'}`,
                color: micActive ? 'var(--ac-rose)' : 'var(--text-tertiary)',
                animation: micActive ? 'tapPulse 1s ease-in-out infinite' : 'none',
                transition:'all 0.2s',
              }}>
                {micActive ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              {/* stop (visible while streaming or speaking) */}
              {(streaming || isSpeaking) ? (
                <button onClick={stopAll} title="Stop" style={{
                  width:34, height:34, borderRadius:9, flexShrink:0, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'rgba(232,80,122,0.14)',
                  border:'1px solid rgba(232,80,122,0.35)',
                  color:'var(--ac-rose)',
                  boxShadow:'0 0 10px rgba(232,80,122,0.15)',
                  transition:'all 0.18s',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="1" y="1" width="10" height="10" rx="2"/>
                  </svg>
                </button>
              ) : (
                /* send */
                <button
                  onClick={()=>{const t=input.trim();if (!t||streamRef.current) return;setInput('');void doSend(t,false)}}
                  disabled={!input.trim()}
                  style={{
                    width:34, height:34, borderRadius:9, flexShrink:0, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: !input.trim()
                      ? 'rgba(255,255,255,0.04)'
                      : 'linear-gradient(135deg,rgba(78,205,196,0.25),rgba(155,111,208,0.20))',
                    border:`1px solid ${!input.trim() ? 'transparent' : 'rgba(78,205,196,0.30)'}`,
                    color: !input.trim() ? 'var(--text-tertiary)' : 'var(--ac-cyan)',
                    boxShadow: !input.trim() ? 'none' : '0 0 10px rgba(78,205,196,0.15)',
                    transition:'all 0.18s',
                  }}
                >
                  <Send size={15} />
                </button>
              )}
            </div>

            {micActive && (
              <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6, paddingLeft:2 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--ac-rose)', animation:'tapPulse 0.9s ease-in-out infinite', boxShadow:'0 0 6px var(--ac-rose)' }} />
                <span style={{ fontSize:10, color:'var(--ac-rose)', fontFamily:'monospace', letterSpacing:'0.1em', opacity:0.85 }}>LISTENING…</span>
              </div>
            )}
          </div>
        </div>

        {/* COL 3 — Content + Notes */}
        {showNotes && (
          <div style={{
            width:276, flexShrink:0, display:'flex', flexDirection:'column',
            background:'linear-gradient(180deg, rgba(11,15,28,0.97) 0%, rgba(8,11,22,0.98) 100%)',
            borderLeft:'1px solid var(--border-subtle)',
            boxShadow:'-2px 0 18px rgba(0,0,0,0.4), inset 1px 0 0 rgba(255,255,255,0.025)',
          }}>
            {/* tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
              {(['content','notes'] as const).map(tab=>(
                <button key={tab} onClick={()=>setRightTab(tab)} style={{
                  flex:1, padding:'10px 0', background:'none', border:'none', cursor:'pointer',
                  fontSize:10, fontFamily:'monospace', letterSpacing:'0.14em', fontWeight:700,
                  color: rightTab===tab ? 'var(--ac-cyan)' : 'var(--text-tertiary)',
                  borderBottom: rightTab===tab ? '2px solid var(--ac-cyan)' : '2px solid transparent',
                  transition:'all 0.2s',
                  textShadow: rightTab===tab ? '0 0 8px rgba(126,207,206,0.5)' : 'none',
                }}>
                  {tab==='content' ? 'CONTENT' : 'NOTES'}
                </button>
              ))}
            </div>

            {rightTab==='content' ? (
              <div style={{ flex:1, overflowY:'auto', padding:'12px 12px' }}>
                {currentSection && (
                  <div style={{ marginBottom:10 }}>
                    <p className="label-mono aurora-text" style={{ marginBottom:3 }}>§{currentSection.section_id}</p>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', lineHeight:1.4, marginBottom:10 }}>{currentSection.section_title}</p>
                    {currentProgress?.status!=='completed' ? (
                      <button onClick={completeSection} style={{
                        width:'100%', padding:'7px 0', borderRadius:8, cursor:'pointer', marginBottom:10,
                        background:'rgba(110,201,160,0.08)', border:'1px solid rgba(110,201,160,0.28)',
                        color:'var(--ac-mint)', fontSize:11, fontWeight:700, fontFamily:'monospace',
                        letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                        boxShadow:'var(--shadow-sm)',
                      }}>
                        <Check size={11} /> MARK AS DONE
                      </button>
                    ) : (
                      <div style={{ width:'100%', padding:'7px 0', borderRadius:8, marginBottom:10,
                        background:'rgba(110,201,160,0.05)', border:'1px solid rgba(110,201,160,0.2)',
                        color:'var(--ac-mint)', fontSize:11, fontWeight:700, fontFamily:'monospace',
                        letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center', gap:5, opacity:0.7 }}>
                        <CheckCircle2 size={11} /> COMPLETED
                      </div>
                    )}
                  </div>
                )}
                {sectionContent
                  ? <SectionNotePoints content={sectionContent} />
                  : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:100, flexDirection:'column', gap:7 }}>
                      <Loader2 size={15} color="var(--ac-cyan)" className="animate-spin" style={{ opacity:0.4 }} />
                      <p style={{ fontSize:11, color:'var(--text-tertiary)' }}>Loading content…</p>
                    </div>
                  )
                }
              </div>
            ) : (
              <NotesPanel section={currentSection} progress={currentProgress} moduleId={moduleId}
                onSave={(notes,kp)=>{
                  setSectionProgress(prev=>{
                    const ex=prev.find(p=>p.section_id===currentSection?.section_id)
                    if (!ex||!currentSection) return prev
                    return prev.map(p=>p.section_id===currentSection.section_id?{...p,notes,key_points:kp}:p)
                  })
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* quiz modal */}
      {showQuiz && (
        <QuizModal moduleId={moduleId} moduleTitle={moduleTitle} partNumber={partNumber} partTitle={partTitle}
          onClose={()=>setShowQuiz(false)}
          onComplete={(passed)=>{setQuizPassed(passed);setShowQuiz(false)}}
        />
      )}

      <style>{`
        @keyframes tapPulse { 0%,100%{opacity:0.45} 50%{opacity:1} }
        @keyframes onlinePulse {
          0%,100%{transform:scale(1); box-shadow:0 0 5px rgba(126,207,206,0.4)}
          50%{transform:scale(1.4); box-shadow:0 0 12px rgba(126,207,206,0.7)}
        }
      `}</style>
    </div>
  )
}
