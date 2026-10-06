'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, Award, Download, Plus, Crown } from 'lucide-react'
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

const PLAN_COLORS = {
  starter: 'bg-slate-100 text-slate-700',
  growth: 'bg-brand-100 text-brand-700',
  enterprise: 'bg-violet-100 text-violet-700',
}

export default function EmployerPage() {
  const [employer, setEmployer] = useState<EmployerData | null>(null)
  const [team, setTeam] = useState<PortalTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employer) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <Crown size={40} className="text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-700">Employer portal unavailable</h2>
        <p className="text-slate-500 text-sm">{loadError || 'No employer account is linked to this signed-in user.'}</p>
        <a href="/" className="inline-block px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          Return home
        </a>
      </div>
    )
  }

  const completionRate = team.length > 0
    ? Math.round(team.filter(m => m.completedModules >= 87).length / team.length * 100)
    : 0
  const avgTeamScore = team.length > 0
    ? Math.round(team.reduce((a, m) => a + m.avgScore, 0) / team.length)
    : 0

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{employer.companyName}</h1>
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mt-1 capitalize ${PLAN_COLORS[employer.plan]}`}>
            {employer.plan} plan · {employer.usedSeats}/{employer.seats} seats
          </span>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,     label: 'Team members', value: team.length },
          { icon: TrendingUp, label: 'Completion rate', value: `${completionRate}%` },
          { icon: TrendingUp, label: 'Avg quiz score', value: `${avgTeamScore}%` },
          { icon: Award,     label: 'Certificates',  value: team.filter(m => m.certificateEarned).length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
              <Icon size={18} className="text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Plus size={18} className="text-brand-600" /> Invite team member
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        {inviteMsg && (
          <p className={`text-sm mt-3 ${inviteMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {inviteMsg}
          </p>
        )}
      </div>

      {/* Team table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Team progress</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Name', 'Email', 'Enrolled', 'Modules', 'Avg score', 'Certificate'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">No team members yet</td>
                </tr>
              )}
              {team.map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{member.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    <div>{member.email}</div>
                    {member.status === 'invited' && <span className="text-xs text-amber-600">Invitation pending</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(member.enrolledAt).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-brand-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, Math.round(member.completedModules / 87 * 100))}%` }}
                        />
                      </div>
                      <span className="text-slate-600 text-xs">{member.completedModules}/87</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${member.avgScore >= 70 ? 'text-emerald-600' : member.avgScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {member.avgScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {member.certificateEarned
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Award size={11} /> Earned</span>
                      : <span className="text-xs text-slate-400">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
