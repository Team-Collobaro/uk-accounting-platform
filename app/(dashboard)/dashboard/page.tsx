'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import {
  Lock, ChevronDown, ChevronUp, ChevronRight, Play,
  Rocket, Star, Flame, Award, Trophy,
} from 'lucide-react'
import { PARTS, MODULE_TITLES } from '@/features/dashboard/constants'
import type { ProgressData } from '@/features/dashboard/types'
import { CelebrationBurst } from '@/features/dashboard/CelebrationBurst'
import { MilestoneToast } from '@/features/dashboard/MilestoneToast'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClientComponentClient()
  const [studentName,    setStudentName]    = useState('Student')
  const [progress,       setProgress]       = useState<ProgressData | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [expandedParts,  setExpandedParts]  = useState<Set<number>>(new Set([1]))
  const [sectionSubtitle, setSectionSubtitle] = useState<string | null>(null)
  const [celebration,    setCelebration]    = useState(false)
  const [milestone,      setMilestone]      = useState<{ message: string; icon: React.ElementType; color: string } | null>(null)
  const prevCompletedRef = useRef<number>(0)

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
        const newCount = data.completedModules.length

        if (prevCompletedRef.current > 0 && newCount > prevCompletedRef.current) {
          setCelebration(true)
          setTimeout(() => setCelebration(false), 2000)
          if      (newCount === 1)  setMilestone({ message: 'First module complete!',              icon: Rocket, color: '#aaaaaa' })
          else if (newCount === 5)  setMilestone({ message: '5 modules done — keep it up!',        icon: Star,   color: '#aaaaaa' })
          else if (newCount === 10) setMilestone({ message: "10 modules! You're on a roll.",       icon: Flame,  color: '#aaaaaa' })
          else if (newCount === 25) setMilestone({ message: '25 modules — nearly a third done!',   icon: Trophy, color: '#aaaaaa' })
          else if (newCount === 50) setMilestone({ message: 'Halfway there — 50 modules!',         icon: Award,  color: '#aaaaaa' })
          else if (newCount === 87) setMilestone({ message: 'All 87 modules complete!',            icon: Trophy, color: '#aaaaaa' })
        }
        prevCompletedRef.current = newCount
        setProgress(data)

        if (data.nextRecommendedModule) {
          const part = PARTS.find(p => p.modules.includes(data.nextRecommendedModule))
          if (part) setExpandedParts(new Set([part.number]))

          // Resolve section subtitle: prefer last-visited, fall back to first section
          try {
            const raw = localStorage.getItem(`last_section_${data.nextRecommendedModule}`)
            if (raw) {
              const ls = JSON.parse(raw) as { sectionId: string; sectionTitle: string }
              setSectionSubtitle(`§ ${ls.sectionId} — ${ls.sectionTitle}`)
            } else {
              const sRes = await fetch(`/api/sections?moduleId=${data.nextRecommendedModule}`)
              if (sRes.ok) {
                const sData = await sRes.json() as { sections: Array<{ section_id: string; section_title: string }> }
                if (sData.sections.length > 0) {
                  const s = sData.sections[0]
                  setSectionSubtitle(`§ ${s.section_id} — ${s.section_title}`)
                }
              }
            }
          } catch { /* ignore */ }
        }
      }
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  function isPartUnlocked(partNumber: number): boolean {
    if (!progress) return partNumber === 1
    if (partNumber === 1) return true
    const prevPart = PARTS.find(p => p.number === partNumber - 1)
    if (!prevPart) return false
    return prevPart.modules.every(m => progress.completedModules.includes(m))
  }

  function getModuleStatus(moduleId: string): 'completed' | 'available' | 'locked' {
    if (!progress) return moduleId === 'm01' ? 'available' : 'locked'
    if (progress.completedModules.includes(moduleId)) return 'completed'
    const ownerPart = PARTS.find(p => p.modules.includes(moduleId))
    if (ownerPart && !isPartUnlocked(ownerPart.number)) return 'locked'
    const allModules = PARTS.flatMap(p => p.modules)
    const pos = allModules.indexOf(moduleId)
    if (pos === 0) return 'available'
    const prevId = allModules[pos - 1]
    return progress.completedModules.includes(prevId) ? 'available' : 'locked'
  }

  const togglePart = (n: number) => setExpandedParts(prev => {
    const next = new Set(prev)
    next.has(n) ? next.delete(n) : next.add(n)
    return next
  })

  if (loading) return (
    <div style={{ padding: '40px', background: '#0c0c0c', minHeight: '100vh' }}>
      <div style={{ height: 32, width: 240, borderRadius: 6, background: '#161616', marginBottom: 12 }} />
      <div style={{ height: 16, width: 380, borderRadius: 4, background: '#141414', marginBottom: 28 }} />
      <div style={{ height: 84, borderRadius: 12, background: '#111', border: '1px solid #333', marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', border: '1px solid #333', borderRadius: 10, overflow: 'hidden', marginBottom: 36 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ height: 100, background: '#0e0e0e', borderRight: i < 3 ? '1px solid #333' : 'none' }} />)}
      </div>
      <div style={{ border: '1px solid #333', borderRadius: 10, overflow: 'hidden' }}>
        {[0,1,2,3].map(i => <div key={i} style={{ height: 48, background: '#0c0c0c', borderBottom: i < 3 ? '1px solid #333' : 'none' }} />)}
      </div>
    </div>
  )

  const completed  = progress?.completedModules.length ?? 0
  const pct        = progress?.overallPercentage ?? 0
  const avgQuiz    = progress?.avgQuizScore ?? 0
  const nextModule = progress?.nextRecommendedModule ?? 'm01'
  const nextTitle  = MODULE_TITLES[nextModule] ?? nextModule.toUpperCase()
  const nextPart   = PARTS.find(p => p.modules.includes(nextModule))
  const streak     = Math.max(1, Math.floor(completed / 3) + (completed > 0 ? 1 : 0))
  const estHours   = Math.round(completed * 1.72)
  const firstName  = studentName.split(' ')[0]

  const subtitle = completed === 0
    ? `You're on module 1 of 87 — a long road, but the best time to start is now.`
    : completed < 10
    ? `You've completed ${completed} of 87 modules. Keep the momentum going.`
    : `${completed} of 87 modules done — you're ${pct}% through the qualification.`

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0c', color: '#e8e8e8', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 60px' }}>
      <CelebrationBurst active={celebration} />
      <AnimatePresence>
        {milestone && <MilestoneToast {...milestone} onDismiss={() => setMilestone(null)} />}
      </AnimatePresence>

      {/* ── Greeting ── */}
      <h1 style={{ fontSize: 28, fontWeight: 600, color: '#f0f0f0', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        {getGreeting()}, {firstName}.
      </h1>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.5 }}>{subtitle}</p>

      {/* ── Continue card ── */}
      <Link href={`/course/${nextModule}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 18,
            padding: '20px 22px', borderRadius: 12,
            background: '#111', border: '1px solid #333', cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#141414' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#111' }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 10, flexShrink: 0,
            background: '#333', border: '1px solid #333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Play size={18} color="#e8e8e8" style={{ marginLeft: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.12em', fontFamily: 'monospace', margin: '0 0 5px', textTransform: 'uppercase' }}>
              CONTINUE · PART {nextPart?.number} · {nextModule.toUpperCase()}
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#f0f0f0', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nextTitle}
            </h2>
            {sectionSubtitle && (
              <p style={{ fontSize: 12, color: '#aaa', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sectionSubtitle}
              </p>
            )}
          </div>
          <ChevronRight size={16} color="#aaa" />
        </div>
      </Link>

      {/* ── Stats row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        border: '1px solid #333', borderRadius: 10, overflow: 'hidden',
        marginBottom: 40,
      }}>
        {/* Progress */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid #333' }}>
          <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.1em', margin: '0 0 10px', textTransform: 'uppercase', fontFamily: 'monospace' }}>Progress</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, marginBottom: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.03em', lineHeight: 1 }}>{pct}</span>
            <span style={{ fontSize: 14, color: '#888', lineHeight: 1 }}>%</span>
          </div>
          <div style={{ height: 2, borderRadius: 2, background: '#333', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#888', borderRadius: 2, minWidth: pct > 0 ? 4 : 0 }} />
          </div>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{completed} of 87 modules</p>
        </div>

        {/* Quiz Avg */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid #333' }}>
          <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.1em', margin: '0 0 10px', textTransform: 'uppercase', fontFamily: 'monospace' }}>Quiz Avg</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, marginBottom: 10 }}>
            {avgQuiz > 0 ? (
              <>
                <span style={{ fontSize: 30, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.03em', lineHeight: 1 }}>{avgQuiz}</span>
                <span style={{ fontSize: 14, color: '#888', lineHeight: 1 }}>%</span>
              </>
            ) : (
              <span style={{ fontSize: 30, fontWeight: 600, color: '#666', letterSpacing: '-0.03em', lineHeight: 1 }}>—</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0, marginTop: 12 }}>
            {avgQuiz > 0 ? `${completed} quiz${completed !== 1 ? 'zes' : ''} taken` : 'No quizzes taken yet.'}
          </p>
        </div>

        {/* Streak */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid #333' }}>
          <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.1em', margin: '0 0 10px', textTransform: 'uppercase', fontFamily: 'monospace' }}>Streak</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.03em', lineHeight: 1 }}>{streak}</span>
            <span style={{ fontSize: 14, color: '#888', lineHeight: 1 }}>d</span>
          </div>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0, marginTop: 12 }}>Keep going</p>
        </div>

        {/* Study Time */}
        <div style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.1em', margin: '0 0 10px', textTransform: 'uppercase', fontFamily: 'monospace' }}>Study Time</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 10 }}>
            {estHours > 0 ? (
              <>
                <span style={{ fontSize: 30, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.03em', lineHeight: 1 }}>{estHours}</span>
                <span style={{ fontSize: 14, color: '#888', lineHeight: 1 }}>h</span>
              </>
            ) : (
              <span style={{ fontSize: 30, fontWeight: 600, color: '#666', letterSpacing: '-0.03em', lineHeight: 1 }}>—</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0, marginTop: 12 }}>
            {estHours > 0 ? 'estimated total' : 'Start tracking today'}
          </p>
        </div>
      </div>

      {/* ── Curriculum ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#e8e8e8' }}>Curriculum</span>
        <span style={{ fontSize: 11, color: '#aaa', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
          {PARTS.length} PARTS · 87 MODULES
        </span>
      </div>

      <div style={{ border: '1px solid #333', borderRadius: 10, overflow: 'hidden' }}>
        {PARTS.map((part, pi) => {
          const doneInPart  = part.modules.filter(m => progress?.completedModules.includes(m)).length
          const isExpanded  = expandedParts.has(part.number)
          const partLocked  = !isPartUnlocked(part.number)
          const hasNextMod  = part.modules.includes(nextModule)
          const partDone    = doneInPart === part.modules.length
          const isLastPart  = pi === PARTS.length - 1

          return (
            <div key={part.number}>
              {/* Part row */}
              <button
                onClick={() => !partLocked && togglePart(part.number)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  padding: '14px 20px', background: 'none', border: 'none',
                  borderBottom: (!isLastPart || isExpanded) ? '1px solid #333' : 'none',
                  cursor: partLocked ? 'default' : 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!partLocked) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
              >
                <span style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', width: 28, flexShrink: 0 }}>
                  P{part.number}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: partLocked ? '#888' : '#e0e0e0', flex: 1 }}>
                  {part.title}
                </span>
                <span style={{ fontSize: 11, color: '#999', marginRight: 14 }}>
                  {part.modules.length} modules
                </span>
                {partLocked ? (
                  <span style={{ fontSize: 10, color: '#999', letterSpacing: '0.08em', fontFamily: 'monospace' }}>LOCKED</span>
                ) : hasNextMod && !partDone ? (
                  <span style={{ fontSize: 10, color: '#ddd', letterSpacing: '0.08em', fontFamily: 'monospace', border: '1px solid #555', padding: '2px 7px', borderRadius: 4 }}>
                    ACTIVE
                  </span>
                ) : partDone ? (
                  <span style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.08em', fontFamily: 'monospace' }}>DONE</span>
                ) : (
                  <span style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.08em', fontFamily: 'monospace' }}>IN PROGRESS</span>
                )}
                {!partLocked && (
                  <span style={{ marginLeft: 10, display: 'flex' }}>
                    {isExpanded
                      ? <ChevronUp size={14} color="#aaa" />
                      : <ChevronDown size={14} color="#aaa" />
                    }
                  </span>
                )}
              </button>

              {/* Module rows */}
              {isExpanded && part.modules.map((moduleId, mi) => {
                const status  = getModuleStatus(moduleId)
                const isNext  = moduleId === nextModule
                const isLast  = mi === part.modules.length - 1
                return (
                  <button
                    key={moduleId}
                    onClick={() => status !== 'locked' && router.push(`/course/${moduleId}`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      padding: '12px 20px 12px 48px', background: 'none', border: 'none',
                      borderBottom: (!isLast || !isLastPart) ? '1px solid #2a2a2a' : 'none',
                      cursor: status !== 'locked' ? 'pointer' : 'default', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (status !== 'locked') (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                  >
                    <span style={{ fontSize: 10, color: '#888', fontFamily: 'monospace', width: 28, flexShrink: 0 }}>
                      {moduleId.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, color: status === 'locked' ? '#777' : status === 'completed' ? '#aaa' : '#ccc', flex: 1 }}>
                      {MODULE_TITLES[moduleId]}
                    </span>
                    {isNext ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#ddd', letterSpacing: '0.08em', fontFamily: 'monospace', border: '1px solid #555', padding: '2px 7px', borderRadius: 4 }}>
                          CURRENT
                        </span>
                        <ChevronRight size={13} color="#aaa" />
                      </div>
                    ) : status === 'locked' ? (
                      <Lock size={12} color="#666" />
                    ) : status === 'completed' ? (
                      <span style={{ fontSize: 10, color: '#999', letterSpacing: '0.08em', fontFamily: 'monospace' }}>DONE</span>
                    ) : (
                      <ChevronRight size={13} color="#aaa" />
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
