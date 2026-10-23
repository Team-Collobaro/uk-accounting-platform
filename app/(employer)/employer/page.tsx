'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Award, TrendingUp, Download, Plus, Crown, Search,
  Filter, CheckCircle2, ShieldCheck, Mail, Briefcase, MapPin,
  Star, Heart, ArrowUpRight, Sparkles, ChevronRight, X, Send,
  SlidersHorizontal, Check, ExternalLink, BookOpen, Clock
} from 'lucide-react'
import type { TeamMember } from '@/types'

interface EmployerData {
  id: string
  companyName: string
  plan: 'starter' | 'growth' | 'enterprise'
  seats: number
  usedSeats: number
}

interface PortalTeamMember extends TeamMember {
  status: 'active' | 'invited'
}

interface Candidate {
  id: string
  name: string
  email: string
  examScore: number
  modulesCompleted: number
  certificateEarned: boolean
  verificationCode: string | null
  verificationUrl: string | null
  statusTier: string
  readiness: string
  location: string
  desiredRole: string
  topSkills: string[]
  bio: string
  enrolledAt: string
  isLiveStudent?: boolean
}

const PLAN_BADGES = {
  starter: { label: 'Starter Recruiter', bg: 'rgba(79,179,196,0.15)', color: 'var(--ac-cyan)' },
  growth: { label: 'Growth Employer', bg: 'rgba(212,165,55,0.15)', color: 'var(--gold)' },
  enterprise: { label: 'Enterprise Partner', bg: 'rgba(143,120,216,0.15)', color: 'var(--ac-violet)' },
}

export default function EmployerPage() {
  const [employer, setEmployer] = useState<EmployerData | null>(null)
  const [team, setTeam] = useState<PortalTeamMember[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // View Tabs: 'candidates' (Hire Talent) vs 'team' (Internal Staff)
  const [activeTab, setActiveTab] = useState<'candidates' | 'team'>('candidates')

  // Search & Filter state for Candidate Directory
  const [searchQuery, setSearchQuery] = useState('')
  const [scoreFilter, setScoreFilter] = useState<'all' | '90' | '80' | '70'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'certified' | 'ready'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'modules' | 'recent'>('score')
  const [shortlisted, setShortlisted] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('ukati_shortlisted_candidates')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false)

  // Modals
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [hireModalCandidate, setHireModalCandidate] = useState<Candidate | null>(null)
  const [hirePosition, setHirePosition] = useState('Junior UK Practice Accountant')
  const [hireSalary, setHireSalary] = useState('£28,000 - £35,000 / year')
  const [hireMessage, setHireMessage] = useState('')
  const [sendingInquiry, setSendingInquiry] = useState(false)
  const [inquiryFeedback, setInquiryFeedback] = useState('')

  // Internal team invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/employer', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load employer portal')
        if (!cancelled) {
          setEmployer(data.employer as EmployerData)
          setTeam(data.team as PortalTeamMember[])
          setCandidates((data.candidates as Candidate[]) || [])
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load employer portal')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const toggleShortlist = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setShortlisted(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('ukati_shortlisted_candidates', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  // Filtered & Sorted Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (showShortlistedOnly && !shortlisted.has(c.id)) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = c.name.toLowerCase().includes(q)
        const matchesRole = c.desiredRole.toLowerCase().includes(q)
        const matchesLoc = c.location.toLowerCase().includes(q)
        const matchesSkills = c.topSkills.some(s => s.toLowerCase().includes(q))
        if (!matchesName && !matchesRole && !matchesLoc && !matchesSkills) return false
      }

      if (scoreFilter === '90' && c.examScore < 90) return false
      if (scoreFilter === '80' && c.examScore < 80) return false
      if (scoreFilter === '70' && c.examScore < 70) return false

      if (statusFilter === 'certified' && !c.certificateEarned) return false
      if (statusFilter === 'ready' && !['Available Immediately', 'Interview Ready'].includes(c.readiness)) return false

      return true
    }).sort((a, b) => {
      if (sortBy === 'score') return b.examScore - a.examScore
      if (sortBy === 'modules') return b.modulesCompleted - a.modulesCompleted
      return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
    })
  }, [candidates, searchQuery, scoreFilter, statusFilter, sortBy, showShortlistedOnly, shortlisted])

  // Top Talent Statistics
  const totalInPool = candidates.length
  const topScorersCount = candidates.filter(c => c.examScore >= 85).length
  const certifiedCount = candidates.filter(c => c.certificateEarned).length
  const availableNowCount = candidates.filter(c => c.readiness === 'Available Immediately').length

  const handleOpenHireModal = (c: Candidate, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setHireModalCandidate(c)
    setHirePosition('UK Accounting & Tax Specialist')
    setHireSalary('£30,000 - £38,000 / year')
    setHireMessage(
      `Hello ${c.name},\n\nWe came across your profile and outstanding exam score (${c.examScore}%) on UKATI. Our firm (${employer?.companyName || 'our company'}) is actively hiring qualified accountants and we would love to invite you for an initial interview.`
    )
    setInquiryFeedback('')
  }

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hireModalCandidate) return
    setSendingInquiry(true)
    setInquiryFeedback('')

    try {
      const response = await fetch('/api/employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hire_inquiry',
          candidateId: hireModalCandidate.id,
          candidateName: hireModalCandidate.name,
          candidateEmail: hireModalCandidate.email,
          position: hirePosition,
          salaryRange: hireSalary,
          message: hireMessage,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to submit inquiry')
      setInquiryFeedback(`Inquiry sent! ${hireModalCandidate.name} has been notified of your interest.`)
      setTimeout(() => {
        setHireModalCandidate(null)
      }, 2000)
    } catch (err) {
      setInquiryFeedback(`Error: ${err instanceof Error ? err.message : 'Failed to send inquiry'}`)
    } finally {
      setSendingInquiry(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')

    try {
      const response = await fetch('/api/employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send invitation')
      setInviteMsg(data.message)
      setInviteEmail('')
      const refreshed = await fetch('/api/employer', { cache: 'no-store' })
      if (refreshed.ok) {
        const refreshedData = await refreshed.json()
        setEmployer(refreshedData.employer as EmployerData)
        setTeam(refreshedData.team as PortalTeamMember[])
      }
    } catch (error) {
      setInviteMsg(`Error: ${error instanceof Error ? error.message : 'Unable to send invitation'}`)
    } finally {
      setInviting(false)
    }
  }

  function downloadCSV() {
    const headers = ['Name', 'Email', 'Enrolled', 'Modules Done', 'Avg Score', 'Certificate']
    const rows = team.map(m => [
      m.name, m.email, new Date(m.enrolledAt).toLocaleDateString('en-GB'),
      m.completedModules, m.avgScore + '%', m.certificateEarned ? 'Yes' : 'No',
    ])
    const csvCell = (value: string | number) => {
      let text = String(value)
      if (/^[=+\-@]/.test(text)) text = `'${text}`
      return `"${text.replace(/"/g, '""')}"`
    }
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.href = url
    a.download = `team-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Loading candidate talent directory…
        </p>
      </div>
    )
  }

  if (!employer) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-5 p-8 rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <Crown size={44} className="mx-auto" style={{ color: 'var(--gold)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>Employer Portal Unavailable</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {loadError || 'No verified employer account is linked to this session. Please sign in with your employer credentials.'}
        </p>
        <Link
          href="/login?role=employer"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md"
          style={{ background: 'var(--gold)', color: '#061219' }}
        >
          Sign in as Employer
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ─── Hero Header & Employer Overview ─── */}
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span
                className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5"
                style={{
                  background: PLAN_BADGES[employer.plan]?.bg || 'rgba(212,165,55,0.15)',
                  color: PLAN_BADGES[employer.plan]?.color || 'var(--gold)',
                  border: '1px solid currentColor',
                }}
              >
                <Crown size={13} />
                {PLAN_BADGES[employer.plan]?.label || 'Recruiter'}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {employer.seats} Candidate Search Credits Included
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
              {employer.companyName}
            </h1>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              Hire top UK bookkeeping, accounting, and taxation candidates based on verified proctored exam scores and curriculum mastery.
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div
            className="flex p-1.5 rounded-xl border self-start lg:self-auto"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <button
              onClick={() => setActiveTab('candidates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'candidates'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={15} />
              <span>Global Talent Pool ({totalInPool})</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'team'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={15} />
              <span>Internal Team ({team.length})</span>
            </button>
          </div>
        </div>

        {/* Talent Pool Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            { label: 'Examinee Talent Pool', value: totalInPool, icon: Users, color: 'var(--ac-cyan)' },
            { label: 'Top Scorers (85%+)', value: topScorersCount, icon: TrendingUp, color: 'var(--gold)' },
            { label: 'Certified Graduates', value: certifiedCount, icon: Award, color: 'var(--ac-mint)' },
            { label: 'Available Immediately', value: availableNowCount, icon: Briefcase, color: 'var(--ac-violet)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="p-3.5 sm:p-4 rounded-xl border flex items-center gap-3"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${color}18`, color }}
              >
                <Icon size={20} />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold leading-none mb-1" style={{ color: 'var(--ink)' }}>
                  {value}
                </p>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── TAB 1: GLOBAL TALENT POOL (HIRE EXAM SCORERS) ─── */}
      {activeTab === 'candidates' && (
        <div className="space-y-6">
          {/* Search, Filter & Sort Controls */}
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by candidate name, role, UK location, or skill (e.g. VAT, CT600, FRS 102)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                  Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="score">Highest Exam Score (Desc)</option>
                  <option value="modules">Most Modules Completed</option>
                  <option value="recent">Recently Active</option>
                </select>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Score Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold mr-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  Exam Score:
                </span>
                {[
                  { id: 'all', label: 'All Scores' },
                  { id: '90', label: '90%+ Elite' },
                  { id: '80', label: '80%+ High Distinction' },
                  { id: '70', label: '70%+ Qualified' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setScoreFilter(id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      scoreFilter === id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Status / Shortlist toggles */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStatusFilter(prev => prev === 'certified' ? 'all' : 'certified')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                    statusFilter === 'certified'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'border-slate-700/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Award size={13} />
                  <span>Verified Certified Only</span>
                </button>

                <button
                  onClick={() => setShowShortlistedOnly(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                    showShortlistedOnly
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'border-slate-700/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Heart size={13} className={showShortlistedOnly ? 'fill-rose-400' : ''} />
                  <span>Shortlisted ({shortlisted.size})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Candidates List / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCandidates.length === 0 ? (
              <div
                className="col-span-full p-12 text-center rounded-2xl border space-y-3"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border-subtle)' }}
              >
                <Search size={36} className="mx-auto text-slate-500" />
                <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>No candidates match your filters</h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Try relaxing your search query or score threshold to view more examinees.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setScoreFilter('all'); setStatusFilter('all'); setShowShortlistedOnly(false); }}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              filteredCandidates.map(c => {
                const isSaved = shortlisted.has(c.id)
                const isHighPerformer = c.examScore >= 85

                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 group relative"
                    style={{
                      background: 'var(--card-bg)',
                      borderColor: isSaved ? 'rgba(212,165,55,0.4)' : 'var(--border-subtle)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    }}
                  >
                    <div>
                      {/* Top Bar: Readiness & Shortlist Star */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            c.readiness === 'Available Immediately'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          <Clock size={11} />
                          {c.readiness}
                        </span>

                        <button
                          onClick={e => toggleShortlist(c.id, e)}
                          title={isSaved ? 'Remove from shortlist' : 'Shortlist candidate'}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{
                            background: isSaved ? 'rgba(225,29,72,0.15)' : 'var(--bg-elevated)',
                            color: isSaved ? '#f43f5e' : 'var(--text-tertiary)',
                          }}
                        >
                          <Heart size={15} className={isSaved ? 'fill-rose-500' : ''} />
                        </button>
                      </div>

                      {/* Candidate Avatar & Core Info */}
                      <div className="flex items-start gap-3.5 mb-3.5">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-sm"
                          style={{
                            background: isHighPerformer ? 'rgba(212,165,55,0.2)' : 'rgba(79,179,196,0.2)',
                            color: isHighPerformer ? 'var(--gold)' : 'var(--ac-cyan)',
                            border: `1px solid ${isHighPerformer ? 'rgba(212,165,55,0.4)' : 'rgba(79,179,196,0.3)'}`,
                          }}
                        >
                          {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base truncate m-0" style={{ color: 'var(--ink)' }}>
                            {c.name}
                          </h3>
                          <p className="text-xs truncate font-medium m-0" style={{ color: 'var(--ac-cyan)' }}>
                            {c.desiredRole}
                          </p>
                          <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            <MapPin size={11} />
                            {c.location}
                          </p>
                        </div>
                      </div>

                      {/* Exam Score Highlight Badge */}
                      <div
                        className="rounded-xl p-3 mb-3.5 border flex items-center justify-between"
                        style={{
                          background: isHighPerformer ? 'rgba(212,165,55,0.08)' : 'var(--bg-surface)',
                          borderColor: isHighPerformer ? 'rgba(212,165,55,0.25)' : 'var(--border-subtle)',
                        }}
                      >
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: 'var(--text-tertiary)' }}>
                            Exam Performance
                          </span>
                          <span className="text-xs font-semibold" style={{ color: isHighPerformer ? 'var(--gold)' : 'var(--ink)' }}>
                            {c.statusTier}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className="text-xl font-extrabold tracking-tight"
                            style={{
                              color: c.examScore >= 85 ? '#3dd68c' : c.examScore >= 70 ? 'var(--gold)' : '#e87b6f',
                            }}
                          >
                            {c.examScore}%
                          </span>
                          <span className="block text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            Avg Score
                          </span>
                        </div>
                      </div>

                      {/* Module Completion Progress */}
                      <div className="space-y-1 mb-3.5">
                        <div className="flex justify-between text-[11px]">
                          <span style={{ color: 'var(--text-tertiary)' }}>Curriculum Progress</span>
                          <span className="font-bold" style={{ color: 'var(--ink)' }}>
                            {c.modulesCompleted} / 87 modules ({Math.round(c.modulesCompleted / 87 * 100)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.round(c.modulesCompleted / 87 * 100))}%`,
                              background: c.certificateEarned ? 'var(--gold)' : 'var(--ac-cyan)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Verified Certificate Check */}
                      {c.certificateEarned && (
                        <div
                          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg mb-3"
                          style={{
                            background: 'rgba(61,214,140,0.12)',
                            color: '#3dd68c',
                            border: '1px solid rgba(61,214,140,0.25)',
                          }}
                        >
                          <ShieldCheck size={14} />
                          <span>Verified Certificate Credential</span>
                          <span className="ml-auto text-[10px] opacity-80">{c.verificationCode}</span>
                        </div>
                      )}

                      {/* Skills Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {c.topSkills.slice(0, 3).map(skill => (
                          <span
                            key={skill}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                          >
                            {skill}
                          </span>
                        ))}
                        {c.topSkills.length > 3 && (
                          <span className="text-[10px] font-medium text-slate-400 px-1">
                            +{c.topSkills.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <button
                        onClick={() => setSelectedCandidate(c)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <BookOpen size={13} />
                        <span>Exam Profile</span>
                      </button>

                      <button
                        onClick={e => handleOpenHireModal(c, e)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-1"
                        style={{ background: 'var(--gold)', color: '#061219' }}
                      >
                        <Mail size={13} />
                        <span>Hire Candidate</span>
                      </button>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: INTERNAL TEAM TRAINING (EXISTING FEATURE) ─── */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Team actions header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Internal Staff Training & Progress</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Track employee progress across all 87 modules and export accredited reports.
              </p>
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Download size={14} /> Export CSV Report
            </button>
          </div>

          {/* Invite form */}
          <div
            className="p-6 rounded-2xl border"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border-subtle)' }}
          >
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
              <Plus size={16} style={{ color: 'var(--gold)' }} /> Invite Employee / Trainee
            </h3>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@yourcompany.com"
                required
                className="flex-1 px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={inviting}
                className="px-5 py-2.5 text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#061219' }}
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </form>
            {inviteMsg && (
              <p className={`text-xs mt-3 ${inviteMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                {inviteMsg}
              </p>
            )}
          </div>

          {/* Team Table */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-semibold uppercase tracking-wider" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                    <th className="text-left px-5 py-3.5">Employee Name</th>
                    <th className="text-left px-5 py-3.5">Email</th>
                    <th className="text-left px-5 py-3.5">Enrolled</th>
                    <th className="text-left px-5 py-3.5">Curriculum (87)</th>
                    <th className="text-left px-5 py-3.5">Avg Score</th>
                    <th className="text-left px-5 py-3.5">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {team.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-xs text-slate-500">
                        No team members invited yet. Use the invite box above to enroll colleagues.
                      </td>
                    </tr>
                  ) : (
                    team.map(member => (
                      <tr key={member.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 font-bold" style={{ color: 'var(--ink)' }}>{member.name}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <div>{member.email}</div>
                          {member.status === 'invited' && <span className="text-[10px] text-amber-400">Invitation pending</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(member.enrolledAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round(member.completedModules / 87 * 100))}%`,
                                  background: 'var(--gold)',
                                }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {member.completedModules}/87
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-bold">
                          <span style={{ color: member.avgScore >= 70 ? '#3dd68c' : member.avgScore >= 50 ? 'var(--gold)' : '#e87b6f' }}>
                            {member.avgScore}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {member.certificateEarned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Award size={12} /> Earned
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: CANDIDATE EXAM PROFILE DETAILS ─── */}
      <AnimatePresence>
        {selectedCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-2xl rounded-2xl border p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--bg-alt, #0a1b24)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <button
                onClick={() => setSelectedCandidate(null)}
                className="absolute right-5 top-5 p-1 rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3.5 mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl"
                  style={{ background: 'rgba(212,165,55,0.2)', color: 'var(--gold)', border: '1px solid rgba(212,165,55,0.4)' }}
                >
                  {selectedCandidate.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{selectedCandidate.name}</h2>
                  <p className="text-xs font-semibold" style={{ color: 'var(--ac-cyan)' }}>{selectedCandidate.desiredRole}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {selectedCandidate.location}
                  </p>
                </div>
              </div>

              {/* Bio & Overview */}
              <div className="p-4 rounded-xl mb-5 text-xs leading-relaxed border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                {selectedCandidate.bio}
              </div>

              {/* Exam & Score Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3.5 rounded-xl border text-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Average Exam Score</span>
                  <span className="text-2xl font-extrabold text-emerald-400">{selectedCandidate.examScore}%</span>
                </div>
                <div className="p-3.5 rounded-xl border text-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Modules Passed</span>
                  <span className="text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>{selectedCandidate.modulesCompleted} / 87</span>
                </div>
                <div className="p-3.5 rounded-xl border text-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Credential Status</span>
                  <span className="text-xs font-bold block mt-1.5" style={{ color: 'var(--gold)' }}>
                    {selectedCandidate.statusTier}
                  </span>
                </div>
              </div>

              {/* Verified Certificate Box */}
              {selectedCandidate.certificateEarned && (
                <div className="p-4 rounded-xl border mb-6 flex items-center justify-between" style={{ background: 'rgba(61,214,140,0.1)', borderColor: 'rgba(61,214,140,0.3)' }}>
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={24} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-300 m-0">Verified UK Accounting Credential</p>
                      <p className="text-[11px] text-slate-400 m-0">Verification Code: {selectedCandidate.verificationCode}</p>
                    </div>
                  </div>
                  {selectedCandidate.verificationCode && (
                    <Link
                      href={`/verify`}
                      target="_blank"
                      className="text-xs font-bold text-emerald-400 flex items-center gap-1 hover:underline"
                    >
                      <span>Public Verification</span>
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              )}

              {/* Skills and Competencies */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Verified Assessment Competencies</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.topSkills.map(skill => (
                    <span
                      key={skill}
                      className="text-xs font-semibold px-3 py-1 rounded-lg border flex items-center gap-1.5"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modal footer actions */}
              <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  onClick={() => toggleShortlist(selectedCandidate.id)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: shortlisted.has(selectedCandidate.id) ? '#f43f5e' : 'var(--text-secondary)',
                  }}
                >
                  <Heart size={14} className={shortlisted.has(selectedCandidate.id) ? 'fill-rose-500' : ''} />
                  <span>{shortlisted.has(selectedCandidate.id) ? 'Shortlisted' : 'Add to Shortlist'}</span>
                </button>

                <button
                  onClick={() => {
                    const c = selectedCandidate
                    setSelectedCandidate(null)
                    handleOpenHireModal(c)
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-md flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--gold)', color: '#061219' }}
                >
                  <Mail size={14} />
                  <span>Send Hiring Interview Invitation</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: DIRECT HIRE / INTERVIEW INQUIRY ─── */}
      <AnimatePresence>
        {hireModalCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-lg rounded-2xl border p-6 sm:p-8 relative"
              style={{ background: 'var(--bg-alt, #0a1b24)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <button
                onClick={() => setHireModalCandidate(null)}
                className="absolute right-5 top-5 p-1 rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(212,165,55,0.2)', color: 'var(--gold)' }}
                >
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                    Connect with {hireModalCandidate.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exam Score: <span className="text-emerald-400 font-bold">{hireModalCandidate.examScore}%</span> · {hireModalCandidate.desiredRole}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendInquiry} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
                    Role Title
                  </label>
                  <input
                    type="text"
                    value={hirePosition}
                    onChange={e => setHirePosition(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
                    Proposed Salary / Hourly Rate
                  </label>
                  <input
                    type="text"
                    value={hireSalary}
                    onChange={e => setHireSalary(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
                    Invitation Message
                  </label>
                  <textarea
                    rows={4}
                    value={hireMessage}
                    onChange={e => setHireMessage(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs leading-relaxed border focus:outline-none"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>

                {inquiryFeedback && (
                  <p className={`text-xs ${inquiryFeedback.startsWith('Error') ? 'text-red-400' : 'text-emerald-400 font-semibold'}`}>
                    {inquiryFeedback}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <a
                    href={`mailto:${hireModalCandidate.email}?subject=${encodeURIComponent(`Interview Invitation: ${hirePosition} at ${employer?.companyName || 'Our Firm'}`)}&body=${encodeURIComponent(hireMessage)}`}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold border transition text-center"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    Open in Email App
                  </a>

                  <button
                    type="submit"
                    disabled={sendingInquiry}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ background: 'var(--gold)', color: '#061219' }}
                  >
                    {sendingInquiry ? 'Sending…' : (
                      <>
                        <Send size={13} />
                        <span>Send Official Hiring Invite</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
