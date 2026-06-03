'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import BlurText from '@/components/reactbits/BlurText'
import CountUp from '@/components/reactbits/CountUp'
import {
  BookOpen, Award, TrendingUp, Clock,
  CheckCircle2, Lock, ChevronRight,
  AlertCircle, Brain, Sparkles, ChevronDown, ChevronUp,
  Flame, Target, Play, ArrowRight, Star, Trophy, Rocket,
  BookMarked,
} from 'lucide-react'
import { PARTS, MODULE_TITLES, MOTIVATIONAL } from '@/features/dashboard/constants'
import type { ProgressData } from '@/features/dashboard/types'
import { CelebrationBurst } from '@/features/dashboard/CelebrationBurst'
import { ProgressRing } from '@/features/dashboard/ProgressRing'
import { StatCard } from '@/features/dashboard/StatCard'
import { QuickModuleCard } from '@/features/dashboard/QuickModuleCard'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { MilestoneToast } from '@/features/dashboard/MilestoneToast'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [studentName, setStudentName] = useState('Student')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]))
  const [dailyGoal] = useState(3)
  const [todayDone] = useState(0)
  const [motivIdx] = useState(() => Math.floor(Math.random() * MOTIVATIONAL.length))
  const [celebration, setCelebration] = useState(false)
  const [milestone, setMilestone] = useState<{ message: string; icon: React.ElementType; color: string } | null>(null)
  const [hoveredModule, setHoveredModule] = useState<string | null>(null)
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

          if (newCount === 1)  setMilestone({ message: 'First module complete!',          icon: Rocket, color: '#4ECDC4' })
          else if (newCount === 5)  setMilestone({ message: '5 modules done — keep it up!',    icon: Star,   color: '#E8B84B' })
          else if (newCount === 10) setMilestone({ message: "10 modules! You're on a roll.",   icon: Flame,  color: '#E87B6F' })
          else if (newCount === 25) setMilestone({ message: '25 modules — nearly a third done!', icon: Trophy, color: '#9B6FD0' })
          else if (newCount === 50) setMilestone({ message: 'Halfway there — 50 modules!',    icon: Award,  color: '#52D98B' })
          else if (newCount === 87) setMilestone({ message: 'All 87 modules complete!',        icon: Trophy, color: '#E8B84B' })
        }
        prevCompletedRef.current = newCount

        setProgress(data)
        if (data.nextRecommendedModule) {
          const part = PARTS.find(p => p.modules.includes(data.nextRecommendedModule))
          if (part) setExpandedParts(new Set([part.number]))
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

  if (loading) return <DashboardSkeleton />

  const completed  = progress?.completedModules.length ?? 0
  const pct        = progress?.overallPercentage ?? 0
  const nextModule = progress?.nextRecommendedModule ?? 'm01'
  const nextTitle  = MODULE_TITLES[nextModule] ?? nextModule.toUpperCase()
  const nextPart   = PARTS.find(p => p.modules.includes(nextModule))
  const streak     = Math.max(1, Math.floor(completed / 3) + (completed > 0 ? 1 : 0))
  const goalPct    = Math.min(100, Math.round((todayDone / dailyGoal) * 100))
  const MotivIcon  = MOTIVATIONAL[motivIdx].icon

  const allModules  = PARTS.flatMap(p => p.modules)
  const nextIdx     = allModules.indexOf(nextModule)
  const nearbyMods  = allModules.slice(Math.max(0, nextIdx - 1), nextIdx + 4).filter(m => m !== nextModule).slice(0, 3)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: '#E8F0FC', fontFamily: 'Inter,system-ui,sans-serif', padding: '0 0 100px' }}>
      <CelebrationBurst active={celebration} />

      <AnimatePresence>
        {milestone && <MilestoneToast {...milestone} onDismiss={() => setMilestone(null)} />}
      </AnimatePresence>

      {/* ── Hero: Continue Learning ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ padding: '28px 28px 24px', borderBottom: '1px solid rgba(78,205,196,0.07)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(155,111,208,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, left: '40%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(78,205,196,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* greeting row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color="#4ECDC4" />
              </motion.div>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#4A6285', letterSpacing: '0.15em', marginBottom: 3 }}>WELCOME BACK</p>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em', color: '#E8F0FC' }}>
                  <BlurText text={studentName.split(' ')[0]} className="aurora-text" delay={70} direction="top" stepDuration={0.25} />
                </div>
                <p style={{ fontSize: 12, color: '#4A6285', marginTop: 2 }}>{completed} of 87 modules completed · {pct}% through the qualification</p>
              </div>
            </div>

            {/* Motivational tip */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(78,205,196,0.04)', border: '1px solid rgba(78,205,196,0.1)', borderRadius: 13, padding: '10px 16px', maxWidth: 320 }}>
              <MotivIcon size={15} color="rgba(78,205,196,0.6)" />
              <p style={{ fontSize: 12, color: '#6A8AB5', lineHeight: 1.5 }}>{MOTIVATIONAL[motivIdx].text}</p>
            </motion.div>
          </div>

          {/* Continue Learning CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{
              background: 'linear-gradient(135deg, rgba(78,205,196,0.1) 0%, rgba(155,111,208,0.06) 100%)',
              border: '1px solid rgba(78,205,196,0.22)', borderRadius: 20, padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 16, position: 'relative', overflow: 'hidden',
            }}>
            <div style={{ position: 'absolute', top: -30, right: 80, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(78,205,196,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Play size={20} color="#4ECDC4" style={{ marginLeft: 2 }} />
              </motion.div>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(78,205,196,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>
                  CONTINUE LEARNING · {nextPart ? `PART ${nextPart.number}` : ''}
                </p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#E8F0FC', margin: '0 0 2px', lineHeight: 1.2 }}>{nextTitle}</h2>
                <p style={{ fontSize: 12, color: '#4A6285', margin: 0 }}>{nextModule.toUpperCase()} · Alex is ready to guide you</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {nearbyMods.length > 0 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {nearbyMods.map(modId => {
                    const st = getModuleStatus(modId)
                    const pt = PARTS.find(p => p.modules.includes(modId))
                    return (
                      <motion.button key={modId}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                        onClick={() => st !== 'locked' && router.push(`/course/${modId}`)}
                        title={MODULE_TITLES[modId]}
                        style={{
                          padding: '6px 11px', borderRadius: 9, fontSize: 11, cursor: st !== 'locked' ? 'pointer' : 'default',
                          background: st === 'completed' ? `${pt?.color ?? '#4ECDC4'}10` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${st === 'completed' ? `${pt?.color ?? '#4ECDC4'}25` : 'rgba(255,255,255,0.08)'}`,
                          color: st === 'completed' ? pt?.color ?? '#4ECDC4' : '#6A8AB5',
                          opacity: st === 'locked' ? 0.4 : 1,
                        }}>
                        {modId.toUpperCase()}
                      </motion.button>
                    )
                  })}
                </div>
              )}

              <Link href={`/course/${nextModule}`} style={{ textDecoration: 'none' }}>
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(78,205,196,0.35)' }} whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '13px 26px', borderRadius: 13,
                    background: 'linear-gradient(135deg, #4ECDC4 0%, #52D98B 100%)',
                    border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, color: '#050810',
                    boxShadow: '0 4px 20px rgba(78,205,196,0.25)',
                  }}>
                  Start Now <ArrowRight size={15} />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Stats + Daily Goal row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 22 }}>
          <StatCard icon={BookOpen}   label="Modules done"   value={`${completed}`}               countTo={completed}                          color="#4ECDC4" delay={0.05} />
          <StatCard icon={TrendingUp} label="Avg quiz score" value={`${progress?.avgQuizScore ?? 0}%`} countTo={progress?.avgQuizScore ?? 0}   color="#52D98B" delay={0.1}  suffix="%" />
          <StatCard icon={Clock}      label="Est. hours"     value=""                              countTo={Math.round(completed * 1.72)}        color="#E8B84B" delay={0.15} suffix="h" />
          <StatCard icon={Award}      label="Certificates"   value=""                              countTo={progress?.certificates.length ?? 0} color="#9B6FD0" delay={0.2} />

          {/* Streak */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            whileHover={{ y: -4, scale: 1.02 }}
            style={{ background: 'linear-gradient(135deg, rgba(232,184,75,0.08) 0%, rgba(5,8,16,0.6) 100%)', border: '1px solid rgba(232,184,75,0.22)', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, backdropFilter: 'blur(12px)' }}>
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flame size={19} color="#E8B84B" />
            </motion.div>
            <div>
              <p style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }}>Streak</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#E8F0FC', lineHeight: 1 }}>
                <CountUp to={streak} from={0} duration={1.4} delay={0.25} /> <span style={{ fontSize: 13, fontWeight: 500, color: '#4A6285' }}>days</span>
              </p>
            </div>
          </motion.div>

          {/* Daily goal */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ y: -4, scale: 1.02 }}
            style={{ background: 'linear-gradient(135deg, rgba(82,217,139,0.06) 0%, rgba(5,8,16,0.6) 100%)', border: '1px solid rgba(82,217,139,0.18)', borderRadius: 16, padding: '18px 20px', backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Target size={15} color="#52D98B" />
              <p style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Daily Goal</p>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#52D98B' }}>{todayDone}/{dailyGoal}</span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${goalPct}%` }} transition={{ duration: 1, delay: 0.5 }}
                style={{ height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#52D98B,#4ECDC4)', boxShadow: '0 0 8px rgba(82,217,139,0.4)' }} />
            </div>
            <p style={{ fontSize: 11, color: '#4A6285', marginTop: 7 }}>
              {todayDone === 0 ? `Start today — ${dailyGoal} modules goal` : `${dailyGoal - todayDone} more to hit your goal`}
            </p>
          </motion.div>
        </div>

        {/* ── Overall progress + AI tutor badge ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 22, alignItems: 'stretch' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(78,205,196,0.1)', borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ProgressRing pct={pct} color="#4ECDC4" size={80} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#4ECDC4' }}>{pct}%</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ fontWeight: 600, fontSize: 14, color: '#8EA8CC', margin: 0 }}>Overall course progress</h2>
                <span style={{ fontSize: 12, color: '#4A6285', fontFamily: 'monospace' }}>{completed}/87 modules</span>
              </div>
              <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.3, ease: 'easeOut', delay: 0.4 }}
                  style={{ height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#4ECDC4,#9B6FD0)', boxShadow: '0 0 10px rgba(78,205,196,0.3)' }} />
              </div>
              <p style={{ fontSize: 11, color: '#4A6285', marginTop: 7 }}>{87 - completed} modules remaining to complete the qualification</p>
            </div>
          </motion.div>

          {/* AI tutor status card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
            style={{ background: 'rgba(78,205,196,0.04)', border: '1px solid rgba(78,205,196,0.15)', borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 140 }}>
            <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(78,205,196,0.2),rgba(155,111,208,0.2))', border: '1px solid rgba(78,205,196,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(78,205,196,0.2)' }}>
              <Brain size={22} color="#4ECDC4" />
            </motion.div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#4A6285', letterSpacing: '0.15em', marginBottom: 2 }}>AI TUTOR</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#4ECDC4', margin: 0 }}>Alex</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 4 }}>
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52D98B', boxShadow: '0 0 8px #52D98B' }} />
                </motion.div>
                <span style={{ fontSize: 9, color: '#52D98B', fontFamily: 'monospace' }}>ONLINE</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Part accordion ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BookMarked size={14} color="rgba(78,205,196,0.6)" />
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#8EA8CC', margin: 0 }}>Your Curriculum</h2>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4A6285', marginLeft: 'auto' }}>
              {PARTS.filter(p => isPartUnlocked(p.number)).length}/12 parts unlocked
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PARTS.map((part, pi) => {
              const doneInPart  = part.modules.filter(m => progress?.completedModules.includes(m)).length
              const partPct     = Math.round(doneInPart / part.modules.length * 100)
              const isExpanded  = expandedParts.has(part.number)
              const partLocked  = !isPartUnlocked(part.number)
              const hasNextMod  = part.modules.includes(nextModule)
              const partDone    = doneInPart === part.modules.length

              return (
                <motion.div key={part.number}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + pi * 0.03 }}
                  style={{
                    background: hasNextMod ? 'rgba(78,205,196,0.02)' : partDone ? `${part.color}04` : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${partLocked ? 'rgba(255,255,255,0.05)' : hasNextMod ? 'rgba(78,205,196,0.18)' : partDone ? `${part.color}20` : `${part.color}18`}`,
                    borderRadius: 16, overflow: 'hidden',
                    opacity: partLocked ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}>

                  {/* Part header */}
                  <button
                    onClick={() => !partLocked && togglePart(part.number)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: partLocked ? 'default' : 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: partLocked ? 'rgba(255,255,255,0.04)' : `${part.color}15`, border: `1px solid ${partLocked ? 'rgba(255,255,255,0.1)' : part.color + '35'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: partLocked ? '#4A6285' : part.color, fontFamily: 'monospace' }}>
                      {partLocked ? <Lock size={13} /> : partDone ? <CheckCircle2 size={14} color={part.color} /> : part.number}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <p style={{ fontSize: 9, fontFamily: 'monospace', color: partLocked ? '#4A6285' : `${part.color}80`, letterSpacing: '0.12em', margin: 0 }}>PART {part.number}</p>
                        {partLocked
                          ? <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(232,123,111,0.5)', letterSpacing: '0.1em' }}>LOCKED</span>
                          : <span style={{ fontSize: 10, color: '#4A6285', fontFamily: 'monospace' }}>{doneInPart}/{part.modules.length}</span>
                        }
                        {hasNextMod && <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(78,205,196,0.7)', letterSpacing: '0.1em', background: 'rgba(78,205,196,0.1)', padding: '1px 6px', borderRadius: 4 }}>ACTIVE</span>}
                        {partDone && !partLocked && <span style={{ fontSize: 9, fontFamily: 'monospace', color: `${part.color}90`, letterSpacing: '0.1em', background: `${part.color}12`, padding: '1px 6px', borderRadius: 4 }}>COMPLETE</span>}
                      </div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: partLocked ? '#4A6285' : '#E8F0FC', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{part.title}</p>
                    </div>
                    {!partLocked && (
                      <div style={{ width: 72, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.05)', flexShrink: 0, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${partPct}%` }}
                          transition={{ duration: 0.9, delay: 0.5 + pi * 0.03 }}
                          style={{ height: '100%', borderRadius: 3, background: part.color, boxShadow: `0 0 5px ${part.color}` }} />
                      </div>
                    )}
                    <div style={{ color: '#4A6285', flexShrink: 0 }}>
                      {partLocked ? <Lock size={13} color="#4A6285" /> : isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {/* Module grid */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 7, padding: '4px 14px 14px' }}>
                          {part.modules.map(moduleId => (
                            <div key={moduleId}
                              onMouseEnter={() => setHoveredModule(moduleId)}
                              onMouseLeave={() => setHoveredModule(null)}>
                              <QuickModuleCard
                                moduleId={moduleId}
                                status={getModuleStatus(moduleId)}
                                color={part.color}
                                isNext={moduleId === nextModule}
                                onClick={() => getModuleStatus(moduleId) !== 'locked' && router.push(`/course/${moduleId}`)}
                              />
                              <AnimatePresence>
                                {hoveredModule === moduleId && getModuleStatus(moduleId) !== 'locked' && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                                    style={{ position: 'absolute', zIndex: 50, background: 'rgba(9,13,26,0.95)', border: `1px solid ${part.color}30`, borderRadius: 10, padding: '8px 12px', pointerEvents: 'none', marginTop: 4, maxWidth: 200 }}>
                                    <p style={{ fontSize: 11, color: '#E8F0FC', margin: 0 }}>{MODULE_TITLES[moduleId]}</p>
                                    <p style={{ fontSize: 9, color: '#4A6285', fontFamily: 'monospace', marginTop: 2 }}>
                                      {getModuleStatus(moduleId) === 'completed' ? '✓ Completed' : 'Click to start →'}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* ── Certificate ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ marginTop: 20, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Award size={18} color="#E8B84B" />
            <h2 style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#E8F0FC' }}>Certificate</h2>
          </div>

          {progress?.certificates && progress.certificates.length > 0 ? (
            progress.certificates.map(cert => (
              <motion.div key={cert.id} whileHover={{ scale: 1.01 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.22)', borderRadius: 12, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#E8B84B', fontSize: 14, margin: 0 }}>UK Bookkeeping, Accounting & Taxation</p>
                  <p style={{ fontSize: 11, color: 'rgba(232,184,75,0.55)', marginTop: 3 }}>Score: {cert.final_score}% · Issued {new Date(cert.completion_date).toLocaleDateString('en-GB')}</p>
                </div>
                <Link href={`/verify/${cert.verification_code}`} style={{ textDecoration: 'none' }}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '9px 18px', background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 9, color: '#E8B84B', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    View Certificate
                  </motion.button>
                </Link>
              </motion.div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <AlertCircle size={16} color="#4A6285" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#8EA8CC', fontSize: 13, margin: '0 0 4px' }}>Certificate not yet earned</p>
                <p style={{ fontSize: 12, color: '#4A6285', lineHeight: 1.6, margin: '0 0 12px' }}>
                  Complete all 87 modules and pass the final exam with 70%+ to receive your verifiable certificate.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.6 }}
                      style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#E8B84B,#9B6FD0)', boxShadow: '0 0 8px rgba(232,184,75,0.3)' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(78,205,196,0.7)', fontFamily: 'monospace', flexShrink: 0 }}>{completed}/87</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Quick actions row ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            { label: 'Continue learning', icon: Play,       color: '#4ECDC4', href: `/course/${nextModule}` },
            { label: 'Browse curriculum', icon: BookOpen,   color: '#9B6FD0', action: () => togglePart(1) },
            { label: 'View certificate',  icon: Award,      color: '#E8B84B', href: completed === 87 ? `/verify/${progress?.certificates[0]?.verification_code}` : undefined },
            { label: 'Track progress',    icon: TrendingUp, color: '#52D98B', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
          ].map(({ label, icon: Icon, color, href, action }) => (
            <motion.div key={label}
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => { if (action) action(); else if (href) router.push(href) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 13,
                background: `${color}08`, border: `1px solid ${color}20`, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8EA8CC' }}>{label}</span>
              <ChevronRight size={12} color={`${color}50`} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}
