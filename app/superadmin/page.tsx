'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import {
  ShieldAlert, ShieldCheck, Users, Building2, Smartphone, Monitor,
  Award, RefreshCw, LogOut, Search, Filter, AlertTriangle, CheckCircle2,
  MapPin, Globe, Ban, Edit, UserPlus, KeyRound, Clock, ExternalLink,
  ChevronRight, X, ArrowUpRight, Check, Activity, Laptop, Download,
  SlidersHorizontal, ChevronDown, Sparkles, TrendingUp, Compass, Radio,
  Copy, Eye, AlertOctagon
} from 'lucide-react'
import '../(dashboard)/dashboard-shell.css'

interface Metrics {
  totalStudents: number
  totalEmployers: number
  activeWebSessions: number
  activeMobileSessions: number
  flaggedIncidents: number
  totalCertificates: number
}

interface StudentItem {
  id: string
  name: string
  email: string
  modulesCompleted: number
  totalModules: number
  avgScore: number
  weakTopics: string[]
  totalTokens: number
  hasCertificate: boolean
  flaggedIncidents: number
  isOnline: boolean
  activeSessions: Array<{
    platform: 'web' | 'mobile'
    session_id: string
    current_ip: string | null
    current_country: string | null
    current_city: string | null
    last_seen: string
  }>
  createdAt: string
}

interface EmployerItem {
  id: string
  ownerId: string | null
  companyName: string
  email: string
  plan: 'starter' | 'growth' | 'enterprise'
  seats: number
  usedSeats: number
  invitesCount: number
  invites: Array<{
    id: string
    email: string
    status: string
    invited_at: string
  }>
  createdAt: string
}

interface SecurityAuditItem {
  id: number
  user_id: string
  studentName?: string
  studentEmail?: string
  platform: 'web' | 'mobile'
  session_id: string
  event_type: string
  ip: string | null
  country: string | null
  city: string | null
  user_agent: string | null
  flagged: boolean
  flag_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
}

type SuperTab = 'overview' | 'students' | 'employers' | 'security' | 'admins'

const PLAN_BADGES = {
  starter: { label: 'Starter', bg: 'rgba(79,179,196,0.15)', color: 'var(--ac-cyan)', border: 'rgba(79,179,196,0.3)' },
  growth: { label: 'Growth', bg: 'rgba(212,165,55,0.15)', color: 'var(--gold)', border: 'rgba(212,165,55,0.3)' },
  enterprise: { label: 'Enterprise', bg: 'rgba(143,120,216,0.15)', color: 'var(--ac-violet)', border: 'rgba(143,120,216,0.3)' },
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [activeTab, setActiveTab] = useState<SuperTab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [lastSynced, setLastSynced] = useState<string>('Just now')

  const [metrics, setMetrics] = useState<Metrics>({
    totalStudents: 0,
    totalEmployers: 0,
    activeWebSessions: 0,
    activeMobileSessions: 0,
    flaggedIncidents: 0,
    totalCertificates: 0,
  })

  const [students, setStudents] = useState<StudentItem[]>([])
  const [employers, setEmployers] = useState<EmployerItem[]>([])
  const [securityFeed, setSecurityFeed] = useState<SecurityAuditItem[]>([])

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [studentFilter, setStudentFilter] = useState<'all' | 'online' | 'distinction' | 'flagged' | 'certified'>('all')
  const [studentSort, setStudentSort] = useState<'score' | 'modules' | 'recent'>('score')
  const [employerPlanFilter, setEmployerPlanFilter] = useState<string>('all')
  const [flaggedOnlyFeed, setFlaggedOnlyFeed] = useState(false)

  // Drawer & Action states
  const [inspectStudent, setInspectStudent] = useState<StudentItem | null>(null)
  const [editingEmployer, setEditingEmployer] = useState<EmployerItem | null>(null)
  const [editPlan, setEditPlan] = useState<'starter' | 'growth' | 'enterprise'>('growth')
  const [editSeats, setEditSeats] = useState(10)
  const [promotingEmail, setPromotingEmail] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const [copiedIp, setCopiedIp] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<'directory' | 'governance' | null>(null)

  const isDirectoryActive = activeTab === 'students' || activeTab === 'employers'
  const isGovernanceActive = activeTab === 'security' || activeTab === 'admins'
  const [isTopbarExpanded, setIsTopbarExpanded] = useState(false)
  const shouldExpandTopbar = isTopbarExpanded || openDropdown !== null

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.nav-dropdown-trigger')) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const [overviewRes, studentsRes, employersRes, securityRes] = await Promise.all([
        fetch('/api/superadmin/overview', { cache: 'no-store' }),
        fetch('/api/superadmin/students', { cache: 'no-store' }),
        fetch('/api/superadmin/employers', { cache: 'no-store' }),
        fetch('/api/superadmin/security-feed', { cache: 'no-store' }),
      ])

      if (overviewRes.status === 401 || overviewRes.status === 403) {
        router.push('/login?role=admin')
        return
      }

      if (overviewRes.ok) {
        const d = await overviewRes.json()
        setMetrics(d.metrics)
        setAdminEmail(d.admin?.email || 'Superadmin')
      }
      if (studentsRes.ok) {
        const d = await studentsRes.json()
        setStudents(d.students || [])
      }
      if (employersRes.ok) {
        const d = await employersRes.json()
        setEmployers(d.employers || [])
      }
      if (securityRes.ok) {
        const d = await securityRes.json()
        setSecurityFeed(d.audits || [])
      }
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      console.error('Failed to load superadmin data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [loadData])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login?role=admin')
  }

  // Terminate a single device session
  async function handleTerminateSession(userId: string, platform: 'web' | 'mobile') {
    if (!confirm(`Are you sure you want to terminate this student's ${platform} session? They will be signed out immediately.`)) {
      return
    }

    try {
      setActionLoading(true)
      const res = await fetch('/api/superadmin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate_session', userId, platform }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionSuccess(data.message)
        setTimeout(() => setActionSuccess(''), 4000)
        await loadData()
        if (inspectStudent && inspectStudent.id === userId) {
          setInspectStudent(prev => prev ? {
            ...prev,
            activeSessions: prev.activeSessions.filter(s => s.platform !== platform),
            isOnline: prev.activeSessions.filter(s => s.platform !== platform).length > 0
          } : null)
        }
      } else {
        setActionError(data.error || 'Failed to terminate session')
        setTimeout(() => setActionError(''), 4000)
      }
    } catch {
      setActionError('Error communicating with server')
      setTimeout(() => setActionError(''), 4000)
    } finally {
      setActionLoading(false)
    }
  }

  // Update employer plan/seats
  async function handleSaveEmployerSeats(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEmployer) return
    try {
      setActionLoading(true)
      setActionError('')
      const res = await fetch('/api/superadmin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_employer_seats',
          employerId: editingEmployer.id,
          seats: Number(editSeats),
          plan: editPlan,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionSuccess(data.message)
        setEditingEmployer(null)
        setTimeout(() => setActionSuccess(''), 4000)
        await loadData()
      } else {
        setActionError(data.error || 'Failed to update employer quota')
      }
    } catch {
      setActionError('Error communicating with server')
    } finally {
      setActionLoading(false)
    }
  }

  // Promote new superadmin
  async function handlePromoteAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!promotingEmail.trim()) return
    try {
      setActionLoading(true)
      setActionError('')
      const res = await fetch('/api/superadmin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'promote_admin',
          adminEmail: promotingEmail.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionSuccess(data.message)
        setPromotingEmail('')
        setTimeout(() => setActionSuccess(''), 4000)
        await loadData()
      } else {
        setActionError(data.error || 'Failed to promote user')
      }
    } catch {
      setActionError('Error communicating with server')
    } finally {
      setActionLoading(false)
    }
  }

  // Export current list to CSV
  function exportCSV(type: 'students' | 'employers') {
    let csvContent = ''
    if (type === 'students') {
      csvContent = 'ID,Name,Email,Modules Completed,Average Score,Has Certificate,Flagged Incidents,Enrolled Date\n'
      students.forEach(s => {
        csvContent += `"${s.id}","${s.name}","${s.email}",${s.modulesCompleted},${s.avgScore}%,${s.hasCertificate ? 'Yes' : 'No'},${s.flaggedIncidents},"${s.createdAt}"\n`
      })
    } else {
      csvContent = 'ID,Company Name,Owner Email,Plan,Used Seats,Total Seats,Created Date\n'
      employers.forEach(e => {
        csvContent += `"${e.id}","${e.companyName}","${e.email}","${e.plan}",${e.usedSeats},${e.seats},"${e.createdAt}"\n`
      })
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `ukati_${type}_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIp(text)
    setTimeout(() => setCopiedIp(null), 2000)
  }

  // Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        const q = searchQuery.toLowerCase().trim()
        const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        if (!matchesSearch) return false

        if (studentFilter === 'online') return s.isOnline
        if (studentFilter === 'distinction') return s.avgScore >= 85
        if (studentFilter === 'flagged') return s.flaggedIncidents > 0
        if (studentFilter === 'certified') return s.hasCertificate
        return true
      })
      .sort((a, b) => {
        if (studentSort === 'score') return b.avgScore - a.avgScore
        if (studentSort === 'modules') return b.modulesCompleted - a.modulesCompleted
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [students, searchQuery, studentFilter, studentSort])

  // Filtered Employers
  const filteredEmployers = useMemo(() => {
    return employers.filter((e) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q || e.companyName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      if (!matchesSearch) return false

      if (employerPlanFilter !== 'all') return e.plan === employerPlanFilter
      return true
    })
  }, [employers, searchQuery, employerPlanFilter])

  // Filtered Security Feed
  const filteredFeed = useMemo(() => {
    return securityFeed.filter((item) => {
      if (flaggedOnlyFeed && !item.flagged) return false
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        item.studentEmail?.toLowerCase().includes(q) ||
        item.studentName?.toLowerCase().includes(q) ||
        item.country?.toLowerCase().includes(q) ||
        item.city?.toLowerCase().includes(q) ||
        item.ip?.toLowerCase().includes(q) ||
        item.event_type.toLowerCase().includes(q)
      )
    })
  }, [securityFeed, flaggedOnlyFeed, searchQuery])

  // Extract all online sessions for Command Center live stream
  const allActiveSessions = useMemo(() => {
    const list: Array<{
      studentId: string
      studentName: string
      studentEmail: string
      platform: 'web' | 'mobile'
      sessionId: string
      ip: string | null
      country: string | null
      city: string | null
      lastSeen: string
      flagged: boolean
    }> = []

    students.forEach((s) => {
      s.activeSessions.forEach((sess) => {
        list.push({
          studentId: s.id,
          studentName: s.name,
          studentEmail: s.email,
          platform: sess.platform,
          sessionId: sess.session_id,
          ip: sess.current_ip,
          country: sess.current_country,
          city: sess.current_city,
          lastSeen: sess.last_seen,
          flagged: s.flaggedIncidents > 0,
        })
      })
    })

    return list
  }, [students])

  if (loading) {
    return (
      <div className="student-shell min-h-screen flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] backdrop-blur-xl shadow-2xl">
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '3px solid rgba(212, 165, 55, 0.2)',
              borderTopColor: 'var(--gold)',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>
            UKATI Superadmin Command Center
          </h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            Synchronizing telemetry, active sessions & corporate quotas…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="student-shell min-h-screen flex flex-col">
      {/* ─── UKATI FLOATING GLASSMORHPIC DYNAMIC DOCK TOPBAR ─── */}
      <header
        className="student-topbar"
        onMouseEnter={() => setIsTopbarExpanded(true)}
        onMouseLeave={() => setIsTopbarExpanded(false)}
        style={{
          left: '50%',
          right: 'auto',
          transform: 'translateX(-50%)',
          width: shouldExpandTopbar ? 'calc(100% - 40px)' : 'min(940px, calc(100% - 40px))',
          height: 74,
          padding: shouldExpandTopbar ? '0 36px' : '0 32px',
          gap: shouldExpandTopbar ? 24 : 16,
          boxSizing: 'border-box',
          transitionProperty: 'width, padding, gap, box-shadow',
          transitionDuration: shouldExpandTopbar ? '0.4s' : '0.52s',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDelay: shouldExpandTopbar ? '0s' : '0.25s',
          boxShadow: shouldExpandTopbar
            ? '0 20px 50px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 12px 36px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Brand Logo Flank (Symmetric with Right Actions) */}
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 140, flexShrink: 0 }}>
          <Link href="/superadmin" className="flex items-center transition-transform hover:scale-105" aria-label="UKATI Superadmin">
            <Image src="/logo-no-background.png" width={52} height={52} alt="UKATI" priority style={{ objectFit: 'contain' }} />
          </Link>
        </div>

        {/* Centered Main Nav: The Three Main Items Named With Icons */}
        <nav
          className="student-topnav"
          aria-label="Superadmin Navigation"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            margin: '0 auto',
            flex: 1,
          }}
        >
          {/* Main 1: Overview */}
          <button
            onClick={() => { setActiveTab('overview'); setOpenDropdown(null) }}
            className="transition-all"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 19px',
              borderRadius: 999,
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              background: activeTab === 'overview' ? 'var(--bg-hover)' : 'var(--bg-surface)',
              border: activeTab === 'overview' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'overview' ? '0 4px 18px rgba(212,165,55,0.18)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Compass size={15} style={{ color: activeTab === 'overview' ? 'var(--accent)' : 'var(--text-tertiary)' }} />
            <span>Overview</span>
          </button>

          {/* Main 2: Directory (Dropdown: Students & Employers) */}
          <div className="relative nav-dropdown-trigger" style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setOpenDropdown(openDropdown === 'directory' ? null : 'directory')
              }}
              onMouseEnter={() => setOpenDropdown('directory')}
              className="transition-all"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 19px',
                borderRadius: 999,
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                background: isDirectoryActive ? 'var(--bg-hover)' : 'var(--bg-surface)',
                border: isDirectoryActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: isDirectoryActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isDirectoryActive ? '0 4px 18px rgba(212,165,55,0.18)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Users size={16} style={{ color: isDirectoryActive ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              <span>Directory</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  marginLeft: 3,
                  background: isDirectoryActive ? 'rgba(212,165,55,0.2)' : 'var(--bg-elevated)',
                  color: isDirectoryActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {students.length + employers.length}
              </span>
              <ChevronDown
                size={14}
                style={{
                  marginLeft: 2,
                  transform: openDropdown === 'directory' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'var(--text-tertiary)',
                }}
              />
            </button>

            <AnimatePresence>
              {openDropdown === 'directory' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  onMouseLeave={() => setOpenDropdown(null)}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 14px)',
                    left: 0,
                    minWidth: 280,
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(25px)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 18,
                    boxShadow: '0 18px 45px rgba(0, 0, 0, 0.32)',
                    padding: '10px',
                    zIndex: 90,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {/* Sub Item 1: Students */}
                  <button
                    onClick={() => { setActiveTab('students'); setOpenDropdown(null) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: activeTab === 'students' ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(79, 179, 196, 0.15)', color: 'var(--ac-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={17} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Students & Devices</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Roster, progress & hardware</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 750, padding: '2px 7px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>
                      {students.length}
                    </span>
                  </button>

                  {/* Sub Item 2: Employers */}
                  <button
                    onClick={() => { setActiveTab('employers'); setOpenDropdown(null) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: activeTab === 'employers' ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(212, 165, 55, 0.15)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={17} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Corporate Employers</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Tiers & quota allocations</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 750, padding: '2px 7px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>
                      {employers.length}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main 3: Governance (Dropdown: Security & Admins) */}
          <div className="relative nav-dropdown-trigger" style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setOpenDropdown(openDropdown === 'governance' ? null : 'governance')
              }}
              onMouseEnter={() => setOpenDropdown('governance')}
              className="transition-all"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 19px',
                borderRadius: 999,
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                background: isGovernanceActive ? 'var(--bg-hover)' : 'var(--bg-surface)',
                border: isGovernanceActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: isGovernanceActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isGovernanceActive ? '0 4px 18px rgba(212,165,55,0.18)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <ShieldAlert
                size={15}
                style={{
                  color: metrics.flaggedIncidents > 0
                    ? 'var(--danger-bd)'
                    : (isGovernanceActive ? 'var(--accent)' : 'var(--text-tertiary)')
                }}
              />
              <span>Governance</span>
              {metrics.flaggedIncidents > 0 ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    marginLeft: 3,
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                  }}
                >
                  {metrics.flaggedIncidents} Flagged
                </span>
              ) : null}
              <ChevronDown
                size={14}
                style={{
                  marginLeft: 2,
                  transform: openDropdown === 'governance' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'var(--text-tertiary)',
                }}
              />
            </button>

            <AnimatePresence>
              {openDropdown === 'governance' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  onMouseLeave={() => setOpenDropdown(null)}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    minWidth: 300,
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(25px)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 18,
                    boxShadow: '0 18px 45px rgba(0, 0, 0, 0.32)',
                    padding: '10px',
                    zIndex: 90,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {/* Sub Item 1: Security Feed */}
                  <button
                    onClick={() => { setActiveTab('security'); setOpenDropdown(null) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: activeTab === 'security' ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: metrics.flaggedIncidents > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(61, 214, 140, 0.15)', color: metrics.flaggedIncidents > 0 ? '#ef4444' : 'var(--ac-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldAlert size={17} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Security & Location</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Telemetry & impossible travel</div>
                      </div>
                    </div>
                    {metrics.flaggedIncidents > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                        {metrics.flaggedIncidents}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 750, padding: '2px 7px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--ac-mint)' }}>
                        Clean
                      </span>
                    )}
                  </button>

                  {/* Sub Item 2: Admins */}
                  <button
                    onClick={() => { setActiveTab('admins'); setOpenDropdown(null) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: activeTab === 'admins' ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(212, 165, 55, 0.15)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <KeyRound size={17} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Admin Governance</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Permissions & delegation</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 750, padding: '2px 7px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>
                      Access
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Topbar Actions with Balanced Spacing & Safe Right Clearance */}
        <div
          className="student-topbar-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            minWidth: 140,
            gap: 8,
            flexShrink: 0,
            paddingRight: 4,
          }}
        >
          {/* Refresh Button (Icon Only) */}
          <button
            onClick={() => loadData()}
            disabled={refreshing}
            className="student-signout-compact"
            title="Sync telemetry"
            aria-label="Sync"
            style={{
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: 11,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-[var(--accent)]' : ''} />
          </button>

          {/* Theme Toggle */}
          <ThemeToggle collapsed />

          {/* Sign Out (Icon Only) */}
          <button
            onClick={handleSignOut}
            className="student-signout-compact hover:text-red-400"
            title="Sign out of Superadmin"
            aria-label="Sign out"
            style={{
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: 11,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ─── TOAST / BANNER NOTIFICATIONS ─── */}
      <div style={{ position: 'fixed', top: 102, right: 24, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
          {actionSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                background: 'var(--tip-bg)',
                border: '1px solid var(--tip-bd)',
                color: 'var(--tip-text)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </motion.div>
          )}
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-bd)',
                color: 'var(--danger-text)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <AlertOctagon size={16} />
              <span>{actionError}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── MAIN WORKSPACE CONTENT ─── */}
      <main
        style={{
          flex: 1,
          padding: '112px 24px 60px',
          maxWidth: 1540,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* HERO TITLE & GOVERNANCE HEADER */}
        <section
          style={{
            marginBottom: 28,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                color: 'var(--accent)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 750,
                fontSize: 11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              UKATI Global LMS Governance & Security
            </div>
            <h1
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 'clamp(24px, 3vw, 32px)',
                lineHeight: 1.15,
                margin: 0,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Executive Command & Telemetry Center
            </h1>
            <p
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 14,
                margin: '6px 0 0',
                maxWidth: 680,
              }}
            >
              Enforcing single-active student sessions, flag-only impossible travel tracking, employer corporate seat provisioning, and high-stakes exam integrity.
            </p>
          </div>

          {/* Quick Actions & Synced Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Clock size={13} style={{ color: 'var(--ac-cyan)' }} />
              <span>Synced at {lastSynced}</span>
            </div>

            <button
              onClick={() => exportCSV(activeTab === 'employers' ? 'employers' : 'students')}
              className="student-signout-compact"
              style={{
                padding: '9px 16px',
                background: 'linear-gradient(135deg, rgba(79,179,196,0.15), rgba(212,165,55,0.12))',
                borderColor: 'var(--border-medium)',
                color: 'var(--text-primary)',
              }}
            >
              <Download size={14} style={{ color: 'var(--ac-cyan)' }} />
              <span>Export {activeTab === 'employers' ? 'Employers' : 'Students'} CSV</span>
            </button>
          </div>
        </section>

        {/* ─── 4 HERO KPI METRICS CARDS (UKATI GLASSMORPHIC DESIGN) ─── */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {/* Card 1: Students & Sessions */}
          <motion.div
            whileHover={{ y: -3, borderColor: 'var(--border-medium)' }}
            transition={{ duration: 0.15 }}
            style={{
              padding: '20px 22px',
              borderRadius: 20,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--ac-cyan), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Enrolled Students
              </span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(79, 179, 196, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ac-cyan)',
                }}
              >
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {metrics.totalStudents}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ac-cyan)', fontWeight: 650 }}>
                <Laptop size={13} /> {metrics.activeWebSessions} Web
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 650 }}>
                <Smartphone size={13} /> {metrics.activeMobileSessions} Mobile
              </span>
            </div>
          </motion.div>

          {/* Card 2: Corporate Employers */}
          <motion.div
            whileHover={{ y: -3, borderColor: 'var(--border-medium)' }}
            transition={{ duration: 0.15 }}
            style={{
              padding: '20px 22px',
              borderRadius: 20,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Corporate Partners
              </span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(212, 165, 55, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold)',
                }}
              >
                <Building2 size={18} />
              </div>
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {metrics.totalEmployers}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                {employers.reduce((acc, e) => acc + e.usedSeats, 0)} Seats
              </span>
              <span>allocated to enterprise teams</span>
            </div>
          </motion.div>

          {/* Card 3: Security & Impossible Travel */}
          <motion.div
            whileHover={{ y: -3, borderColor: 'var(--border-medium)' }}
            transition={{ duration: 0.15 }}
            style={{
              padding: '20px 22px',
              borderRadius: 20,
              background: 'var(--card-bg)',
              border: metrics.flaggedIncidents > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--card-border)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: metrics.flaggedIncidents > 0 ? 'linear-gradient(90deg, #ef4444, transparent)' : 'linear-gradient(90deg, var(--ac-mint), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Flagged Incidents
              </span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: metrics.flaggedIncidents > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(61, 214, 140, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: metrics.flaggedIncidents > 0 ? '#ef4444' : 'var(--ac-mint)',
                }}
              >
                {metrics.flaggedIncidents > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
              </div>
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 32, fontWeight: 800, color: metrics.flaggedIncidents > 0 ? '#f87171' : 'var(--text-primary)', lineHeight: 1 }}>
              {metrics.flaggedIncidents}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12 }}>
              {metrics.flaggedIncidents > 0 ? (
                <span style={{ color: '#ef4444', fontWeight: 650 }}>
                  Flag-only travel drift logged for inspection
                </span>
              ) : (
                <span style={{ color: 'var(--ac-mint)', fontWeight: 650 }}>
                  Zero suspicious location hops detected
                </span>
              )}
            </div>
          </motion.div>

          {/* Card 4: Verified Certifications */}
          <motion.div
            whileHover={{ y: -3, borderColor: 'var(--border-medium)' }}
            transition={{ duration: 0.15 }}
            style={{
              padding: '20px 22px',
              borderRadius: 20,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--ac-mint), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Issued Certificates
              </span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(61, 214, 140, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ac-mint)',
                }}
              >
                <Award size={18} />
              </div>
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {metrics.totalCertificates}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--ac-mint)', fontWeight: 700 }}>
                {students.filter(s => s.avgScore >= 85).length} High Distinction
              </span>
              <span>graduates</span>
            </div>
          </motion.div>
        </section>

        {/* ─── SECONDARY SUB-CATEGORY TOGGLE BAR ─── */}
        {isDirectoryActive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button
              onClick={() => setActiveTab('students')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 14,
                background: activeTab === 'students' ? 'var(--bg-hover)' : 'var(--card-bg)',
                border: activeTab === 'students' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: activeTab === 'students' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'students' ? '0 4px 16px rgba(212,165,55,0.18)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={15} style={{ color: activeTab === 'students' ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              <span>Students & Hardware Devices</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 750,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  color: activeTab === 'students' ? 'var(--accent)' : 'var(--text-tertiary)',
                }}
              >
                {students.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('employers')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 14,
                background: activeTab === 'employers' ? 'var(--bg-hover)' : 'var(--card-bg)',
                border: activeTab === 'employers' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: activeTab === 'employers' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'employers' ? '0 4px 16px rgba(212,165,55,0.18)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Building2 size={15} style={{ color: activeTab === 'employers' ? 'var(--gold)' : 'var(--text-tertiary)' }} />
              <span>Corporate Employers</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 750,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  color: activeTab === 'employers' ? 'var(--gold)' : 'var(--text-tertiary)',
                }}
              >
                {employers.length}
              </span>
            </button>
          </div>
        )}

        {isGovernanceActive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button
              onClick={() => setActiveTab('security')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 14,
                background: activeTab === 'security' ? 'var(--bg-hover)' : 'var(--card-bg)',
                border: activeTab === 'security' ? (metrics.flaggedIncidents > 0 ? '1px solid #ef4444' : '1px solid var(--accent)') : '1px solid var(--border-subtle)',
                color: activeTab === 'security' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'security' ? '0 4px 16px rgba(212,165,55,0.18)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldAlert size={15} style={{ color: metrics.flaggedIncidents > 0 ? '#ef4444' : (activeTab === 'security' ? 'var(--accent)' : 'var(--text-tertiary)') }} />
              <span>Security & Location Audit</span>
              {metrics.flaggedIncidents > 0 ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                  }}
                >
                  {metrics.flaggedIncidents} Flagged
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 750,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Verified
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('admins')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 14,
                background: activeTab === 'admins' ? 'var(--bg-hover)' : 'var(--card-bg)',
                border: activeTab === 'admins' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: activeTab === 'admins' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'admins' ? '0 4px 16px rgba(212,165,55,0.18)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <KeyRound size={15} style={{ color: activeTab === 'admins' ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              <span>Admin Governance</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 750,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-tertiary)',
                }}
              >
                Access
              </span>
            </button>
          </div>
        )}

        {/* ─── TAB 1: COMMAND OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* Live Streaming Active Sessions Panel */}
            <div
              style={{
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                padding: '24px 26px',
                boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ color: 'var(--ac-cyan)', fontSize: 11, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Realtime Proctoring Telemetry
                  </div>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 750, fontSize: 18, margin: '4px 0 0', color: 'var(--text-primary)' }}>
                    Active Connected Hardware Devices ({allActiveSessions.length})
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ac-mint)', display: 'inline-block', boxShadow: '0 0 10px var(--ac-mint)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Live Heartbeat Monitor (1 Web + 1 Mobile permitted per student)
                  </span>
                </div>
              </div>

              {allActiveSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
                  <Laptop size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>No students are actively browsing or taking exams at this second.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {allActiveSessions.map((sess) => (
                    <div
                      key={sess.sessionId}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 14,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: sess.platform === 'web' ? 'rgba(79, 179, 196, 0.15)' : 'rgba(212, 165, 55, 0.15)',
                              color: sess.platform === 'web' ? 'var(--ac-cyan)' : 'var(--gold)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {sess.platform === 'web' ? <Laptop size={17} /> : <Smartphone size={17} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                              {sess.studentName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {sess.studentEmail}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 750,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: sess.platform === 'web' ? 'rgba(79, 179, 196, 0.12)' : 'rgba(212, 165, 55, 0.12)',
                            color: sess.platform === 'web' ? 'var(--ac-cyan)' : 'var(--gold)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {sess.platform}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={12} style={{ color: 'var(--accent)' }} />
                          <span>{sess.city ? `${sess.city}, ` : ''}{sess.country || 'Unknown Geo'}</span>
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {sess.ip || '127.0.0.1'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          Active {new Date(sess.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleTerminateSession(sess.studentId, sess.platform)}
                          disabled={actionLoading}
                          style={{
                            fontSize: 11,
                            fontWeight: 650,
                            color: '#f87171',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            padding: '4px 10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Split Row: Academic Leaders & Top Corporate Clients */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
              {/* Leaders Card */}
              <div
                style={{
                  borderRadius: 20,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--card-bg)',
                  backdropFilter: 'blur(20px)',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 750, fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>
                    Top Academic Candidates
                  </h3>
                  <button
                    onClick={() => { setActiveTab('students'); setStudentFilter('distinction') }}
                    style={{ background: 'none', border: 'none', color: 'var(--ac-cyan)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {students.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setInspectStudent(s)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.modulesCompleted}/87 Modules Completed</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 8,
                            background: s.avgScore >= 85 ? 'rgba(212, 165, 55, 0.18)' : 'rgba(79, 179, 196, 0.15)',
                            color: s.avgScore >= 85 ? 'var(--gold)' : 'var(--ac-cyan)',
                          }}
                        >
                          {s.avgScore}%
                        </span>
                        <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Corporate Employers Preview */}
              <div
                style={{
                  borderRadius: 20,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--card-bg)',
                  backdropFilter: 'blur(20px)',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 750, fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>
                    Corporate Employer Allocations
                  </h3>
                  <button
                    onClick={() => setActiveTab('employers')}
                    style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Manage Quotas <ChevronRight size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {employers.slice(0, 5).map((e) => {
                    const badge = PLAN_BADGES[e.plan] || PLAN_BADGES.growth
                    const pct = Math.round((e.usedSeats / Math.max(e.seats, 1)) * 100)
                    return (
                      <div
                        key={e.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{e.companyName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.usedSeats} of {e.seats} Seats Active ({pct}%)</div>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 750,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: STUDENTS ROSTER & DEVICES ─── */}
        {activeTab === 'students' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Filter & Search Bar */}
            <div
              style={{
                borderRadius: 16,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              {/* Search Field */}
              <div style={{ position: 'relative', minWidth: 260, flex: '1 1 300px' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ac-cyan)' }} />
                <input
                  type="text"
                  placeholder="Search students by name or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'Montserrat, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Status Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Students' },
                  { id: 'online', label: 'Active Online' },
                  { id: 'distinction', label: 'Distinction (≥85%)' },
                  { id: 'flagged', label: 'Flagged Security' },
                  { id: 'certified', label: 'Certified' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStudentFilter(f.id as typeof studentFilter)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 999,
                      border: studentFilter === f.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      background: studentFilter === f.id ? 'var(--bg-hover)' : 'transparent',
                      color: studentFilter === f.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      fontSize: 11,
                      fontWeight: 650,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Sort by:</span>
                <select
                  value={studentSort}
                  onChange={(e) => setStudentSort(e.target.value as typeof studentSort)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontFamily: 'Montserrat, sans-serif',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="score">Highest Average Score</option>
                  <option value="modules">Most Modules Completed</option>
                  <option value="recent">Recently Enrolled</option>
                </select>
              </div>
            </div>

            {/* Students Table */}
            <div
              style={{
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '14px 20px' }}>Student Profile</th>
                      <th style={{ padding: '14px 16px' }}>Status</th>
                      <th style={{ padding: '14px 16px' }}>Progress</th>
                      <th style={{ padding: '14px 16px' }}>Average Score</th>
                      <th style={{ padding: '14px 16px' }}>Active Hardware</th>
                      <th style={{ padding: '14px 16px' }}>Security</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          No students matching your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s, idx) => {
                        const webSession = s.activeSessions.find(sess => sess.platform === 'web')
                        const mobileSession = s.activeSessions.find(sess => sess.platform === 'mobile')
                        const isEven = idx % 2 === 0

                        return (
                          <tr
                            key={s.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: isEven ? 'transparent' : 'var(--table-row-alt)',
                              transition: 'background 0.15s',
                            }}
                          >
                            {/* Profile */}
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, rgba(79,179,196,0.2), rgba(212,165,55,0.2))',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: 13,
                                    color: 'var(--accent)',
                                  }}
                                >
                                  {s.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 750, color: 'var(--text-primary)' }}>{s.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td style={{ padding: '14px 16px' }}>
                              {s.isOnline ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    background: 'rgba(61, 214, 140, 0.12)',
                                    color: 'var(--ac-mint)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ac-mint)' }} />
                                  Online
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Offline</span>
                              )}
                            </td>

                            {/* Progress */}
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ width: 120 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{s.modulesCompleted}/87</span>
                                  <span style={{ color: 'var(--ac-cyan)' }}>{Math.round((s.modulesCompleted / 87) * 100)}%</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 999, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${(s.modulesCompleted / 87) * 100}%`,
                                      height: '100%',
                                      borderRadius: 999,
                                      background: 'linear-gradient(90deg, var(--ac-cyan), var(--accent))',
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Average Score */}
                            <td style={{ padding: '14px 16px' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '4px 9px',
                                  borderRadius: 8,
                                  background: s.avgScore >= 85 ? 'rgba(212,165,55,0.18)' : (s.avgScore >= 70 ? 'rgba(79,179,196,0.15)' : 'rgba(239,68,68,0.15)'),
                                  color: s.avgScore >= 85 ? 'var(--gold)' : (s.avgScore >= 70 ? 'var(--ac-cyan)' : '#f87171'),
                                }}
                              >
                                {s.avgScore}%
                              </span>
                            </td>

                            {/* Active Hardware */}
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {webSession && (
                                  <span
                                    title={`Web Session: ${webSession.current_city || 'City'}, ${webSession.current_country || 'Country'} (${webSession.current_ip})`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '3px 7px',
                                      borderRadius: 6,
                                      background: 'rgba(79, 179, 196, 0.15)',
                                      color: 'var(--ac-cyan)',
                                      fontSize: 10,
                                      fontWeight: 700,
                                    }}
                                  >
                                    <Laptop size={11} /> {webSession.current_country || 'Web'}
                                  </span>
                                )}
                                {mobileSession && (
                                  <span
                                    title={`Mobile Session: ${mobileSession.current_city || 'City'}, ${mobileSession.current_country || 'Country'} (${mobileSession.current_ip})`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '3px 7px',
                                      borderRadius: 6,
                                      background: 'rgba(212, 165, 55, 0.15)',
                                      color: 'var(--gold)',
                                      fontSize: 10,
                                      fontWeight: 700,
                                    }}
                                  >
                                    <Smartphone size={11} /> {mobileSession.current_country || 'Mobile'}
                                  </span>
                                )}
                                {!webSession && !mobileSession && (
                                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>None active</span>
                                )}
                              </div>
                            </td>

                            {/* Security Verdict */}
                            <td style={{ padding: '14px 16px' }}>
                              {s.flaggedIncidents > 0 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444',
                                    fontSize: 11,
                                    fontWeight: 750,
                                  }}
                                >
                                  <AlertTriangle size={12} /> {s.flaggedIncidents} Flagged
                                </span>
                              ) : (
                                <span style={{ color: 'var(--ac-mint)', fontSize: 11, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Check size={12} /> Clean
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <button
                                onClick={() => setInspectStudent(s)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 8,
                                  border: '1px solid var(--border-subtle)',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                  fontSize: 11,
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <Eye size={12} style={{ color: 'var(--ac-cyan)' }} />
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: CORPORATE EMPLOYERS ─── */}
        {activeTab === 'employers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Search and Tier Filter */}
            <div
              style={{
                borderRadius: 16,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div style={{ position: 'relative', minWidth: 260, flex: '1 1 300px' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)' }} />
                <input
                  type="text"
                  placeholder="Search corporate employers by company or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'Montserrat, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {['all', 'starter', 'growth', 'enterprise'].map((plan) => (
                  <button
                    key={plan}
                    onClick={() => setEmployerPlanFilter(plan)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 999,
                      border: employerPlanFilter === plan ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      background: employerPlanFilter === plan ? 'var(--bg-hover)' : 'transparent',
                      color: employerPlanFilter === plan ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      fontSize: 11,
                      fontWeight: 650,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {plan === 'all' ? 'All Plans' : plan}
                  </button>
                ))}
              </div>
            </div>

            {/* Employers Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
              {filteredEmployers.map((emp) => {
                const badge = PLAN_BADGES[emp.plan] || PLAN_BADGES.growth
                const usagePct = Math.round((emp.usedSeats / Math.max(emp.seats, 1)) * 100)

                return (
                  <motion.div
                    key={emp.id}
                    whileHover={{ y: -3, borderColor: 'var(--border-medium)' }}
                    style={{
                      borderRadius: 20,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      padding: '22px 24px',
                      backdropFilter: 'blur(20px)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.10)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                        <div>
                          <h4 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 17, margin: 0, color: 'var(--text-primary)' }}>
                            {emp.companyName}
                          </h4>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{emp.email}</span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 750,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Seat Meter */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Corporate Seat Quota</span>
                          <span style={{ color: 'var(--text-primary)' }}>{emp.usedSeats} / {emp.seats} ({usagePct}%)</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(usagePct, 100)}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: usagePct > 90 ? '#ef4444' : 'linear-gradient(90deg, var(--ac-cyan), var(--gold))',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Joined {new Date(emp.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          setEditingEmployer(emp)
                          setEditPlan(emp.plan)
                          setEditSeats(emp.seats)
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                          color: 'var(--gold)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Edit size={12} />
                        <span>Manage Quota</span>
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── TAB 4: SECURITY & LOCATION AUDIT FEED ─── */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Control Bar */}
            <div
              style={{
                borderRadius: 16,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div>
                <h4 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 750, fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>
                  Location Drift & Proctor Audit Stream
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  All session logins, geo-telemetry heartbeats, and impossible travel triggers in flag-only mode.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => setFlaggedOnlyFeed(!flaggedOnlyFeed)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: flaggedOnlyFeed ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                    background: flaggedOnlyFeed ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
                    color: flaggedOnlyFeed ? '#ef4444' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>Show Flagged Only</span>
                </button>
              </div>
            </div>

            {/* Audit Table */}
            <div
              style={{
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '14px 20px' }}>Timestamp</th>
                      <th style={{ padding: '14px 16px' }}>Student</th>
                      <th style={{ padding: '14px 16px' }}>Platform</th>
                      <th style={{ padding: '14px 16px' }}>Event</th>
                      <th style={{ padding: '14px 16px' }}>Location & IP</th>
                      <th style={{ padding: '14px 16px' }}>Verdict</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeed.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          No audit telemetry events match this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredFeed.map((item, idx) => {
                        const isEven = idx % 2 === 0
                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: item.flagged ? 'rgba(239, 68, 68, 0.05)' : (isEven ? 'transparent' : 'var(--table-row-alt)'),
                            }}
                          >
                            <td style={{ padding: '14px 20px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.studentName || 'Student'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.studentEmail}</div>
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 750,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: item.platform === 'web' ? 'rgba(79, 179, 196, 0.15)' : 'rgba(212, 165, 55, 0.15)',
                                  color: item.platform === 'web' ? 'var(--ac-cyan)' : 'var(--gold)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {item.platform}
                              </span>
                            </td>

                            <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                              {item.event_type}
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MapPin size={12} style={{ color: 'var(--accent)' }} />
                                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                                  {item.city ? `${item.city}, ` : ''}{item.country || 'Unknown'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>
                                  {item.ip || '127.0.0.1'}
                                </span>
                                {item.ip && (
                                  <button
                                    onClick={() => copyToClipboard(item.ip!)}
                                    title="Copy IP"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}
                                  >
                                    <Copy size={10} className={copiedIp === item.ip ? 'text-green-400' : ''} />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              {item.flagged ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444',
                                    fontSize: 11,
                                    fontWeight: 750,
                                  }}
                                >
                                  <AlertTriangle size={12} /> {item.flag_reason || 'Flagged'}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--ac-mint)', fontSize: 11, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Check size={12} /> Verified
                                </span>
                              )}
                            </td>

                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleTerminateSession(item.user_id, item.platform)}
                                disabled={actionLoading}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(239,68,68,0.25)',
                                  background: 'rgba(239,68,68,0.08)',
                                  color: '#f87171',
                                  fontSize: 11,
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                }}
                              >
                                Disconnect
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 5: ADMIN GOVERNANCE ─── */}
        {activeTab === 'admins' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24 }}>
            {/* Whitelisted Superadmins */}
            <div
              style={{
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                padding: '26px 28px',
                boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                Access Governance
              </div>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, margin: 0, color: 'var(--text-primary)' }}>
                Authorized Superadmins
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 20px' }}>
                Accounts possessing full unrestricted oversight over exams, sessions, corporate employer tiers, and telemetry logs.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(212, 165, 55, 0.2)',
                        color: 'var(--gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 750, color: 'var(--text-primary)', fontSize: 13 }}>naja@teamcollaboro.com</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Primary Superadmin Owner</div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(212,165,55,0.15)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(212,165,55,0.3)',
                    }}
                  >
                    OWNER
                  </span>
                </div>

                {adminEmail && adminEmail !== 'naja@teamcollaboro.com' && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'rgba(79, 179, 196, 0.2)',
                          color: 'var(--ac-cyan)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <KeyRound size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 750, color: 'var(--text-primary)', fontSize: 13 }}>{adminEmail}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Active Session</div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(79,179,196,0.15)',
                        color: 'var(--ac-cyan)',
                        border: '1px solid rgba(79,179,196,0.3)',
                      }}
                    >
                      ACTIVE ADMIN
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Promote New Admin Form */}
            <div
              style={{
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                padding: '26px 28px',
                boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{ color: 'var(--ac-cyan)', fontSize: 11, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                Delegate Authority
              </div>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, margin: 0, color: 'var(--text-primary)' }}>
                Grant Superadmin Role
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 20px' }}>
                Add an email to authorize platform access via the unified sign-in portal.
              </p>

              <form onSubmit={handlePromoteAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Candidate Admin Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. colleague@teamcollaboro.com"
                    value={promotingEmail}
                    onChange={(e) => setPromotingEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'Montserrat, sans-serif',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !promotingEmail.trim()}
                  className="student-signout-compact"
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--ac-cyan), var(--accent))',
                    border: 'none',
                    color: '#061219',
                    fontWeight: 750,
                    fontSize: 13,
                    cursor: 'pointer',
                    justifyContent: 'center',
                  }}
                >
                  <UserPlus size={15} />
                  <span>{actionLoading ? 'Granting Role…' : 'Promote to Superadmin'}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ─── SLIDE-OVER STUDENT INSPECT DRAWER (GLASSMORPHIC) ─── */}
      <AnimatePresence>
        {inspectStudent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectStudent(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 95,
              }}
            />

            {/* Slide Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(480px, 100vw)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(30px)',
                borderLeft: '1px solid var(--border-medium)',
                boxShadow: '-10px 0 40px rgba(0,0,0,0.3)',
                zIndex: 100,
                padding: '28px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Drawer Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, rgba(79,179,196,0.25), rgba(212,165,55,0.25))',
                      border: '1px solid var(--border-medium)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 16,
                      color: 'var(--accent)',
                    }}
                  >
                    {inspectStudent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, margin: 0, color: 'var(--text-primary)' }}>
                      {inspectStudent.name}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{inspectStudent.email}</div>
                  </div>
                </div>

                <button
                  onClick={() => setInspectStudent(null)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Academic Stats Box */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 16,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Modules</div>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--ac-cyan)', marginTop: 2 }}>
                    {inspectStudent.modulesCompleted}/87
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Avg Score</div>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: inspectStudent.avgScore >= 85 ? 'var(--gold)' : 'var(--text-primary)', marginTop: 2 }}>
                    {inspectStudent.avgScore}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Certificate</div>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: inspectStudent.hasCertificate ? 'var(--ac-mint)' : 'var(--text-tertiary)', marginTop: 2 }}>
                    {inspectStudent.hasCertificate ? 'Issued' : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Connected Active Hardware Sessions */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Connected Hardware ({inspectStudent.activeSessions.length})
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Policy: 1 Web + 1 Mobile max</span>
                </div>

                {inspectStudent.activeSessions.length === 0 ? (
                  <div style={{ padding: '20px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                    No active sessions currently logged in.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inspectStudent.activeSessions.map((sess) => (
                      <div
                        key={sess.session_id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 14,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {sess.platform === 'web' ? <Laptop size={16} style={{ color: 'var(--ac-cyan)' }} /> : <Smartphone size={16} style={{ color: 'var(--gold)' }} />}
                            <span style={{ fontWeight: 750, fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                              {sess.platform} Browser
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--ac-mint)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ac-mint)' }} /> Online
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={11} style={{ color: 'var(--accent)' }} />
                            <span>{sess.current_city ? `${sess.current_city}, ` : ''}{sess.current_country || 'Unknown location'}</span>
                          </div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
                            IP: {sess.current_ip || '127.0.0.1'} • Seen {new Date(sess.last_seen).toLocaleTimeString()}
                          </div>
                        </div>

                        <button
                          onClick={() => handleTerminateSession(inspectStudent.id, sess.platform)}
                          disabled={actionLoading}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <Ban size={13} />
                          <span>Disconnect {sess.platform} device now</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak Topics */}
              {inspectStudent.weakTopics && inspectStudent.weakTopics.length > 0 && (
                <div>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 750, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Identified Areas for Improvement
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {inspectStudent.weakTopics.map((topic, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Enrolled Info */}
              <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                Enrolled since {new Date(inspectStudent.createdAt).toLocaleDateString()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── MODAL: EDIT EMPLOYER QUOTA (GLASSMORPHIC) ─── */}
      <AnimatePresence>
        {editingEmployer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingEmployer(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(6px)',
                zIndex: 95,
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(460px, 92vw)',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(30px)',
                border: '1px solid var(--border-medium)',
                borderRadius: 22,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                zIndex: 100,
                padding: '28px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, margin: 0, color: 'var(--text-primary)' }}>
                    Corporate Quota Allocation
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{editingEmployer.companyName}</div>
                </div>
                <button
                  onClick={() => setEditingEmployer(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveEmployerSeats} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Subscription Tier
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {(['starter', 'growth', 'enterprise'] as const).map((p) => {
                      const selected = editPlan === p
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditPlan(p)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 10,
                            border: selected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: selected ? 'var(--bg-hover)' : 'var(--bg-surface)',
                            color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Total Assigned Candidate Seats
                  </label>
                  <input
                    type="number"
                    min={editingEmployer.usedSeats}
                    max={500}
                    value={editSeats}
                    onChange={(e) => setEditSeats(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontFamily: 'Montserrat, sans-serif',
                      outline: 'none',
                    }}
                  />
                  <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Currently utilizing {editingEmployer.usedSeats} active seat{editingEmployer.usedSeats === 1 ? '' : 's'}. Minimum: {editingEmployer.usedSeats}.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingEmployer(null)}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 12,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--gold), #e2b547)',
                      color: '#061219',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {actionLoading ? 'Saving…' : 'Save Quota'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
