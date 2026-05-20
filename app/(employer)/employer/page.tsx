'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { Users, TrendingUp, Award, Download, Plus, Crown } from 'lucide-react'
import type { TeamMember } from '@/types'

interface EmployerData {
  id: string
  company_name: string
  plan: 'starter' | 'growth' | 'enterprise'
  seats: number
  used_seats: number
  team_members: string[]
}

const PLAN_COLORS = {
  starter: 'bg-slate-100 text-slate-700',
  growth: 'bg-brand-100 text-brand-700',
  enterprise: 'bg-violet-100 text-violet-700',
}

const PLAN_SEATS = { starter: 5, growth: 20, enterprise: 50 }

export default function EmployerPage() {
  const supabase = createClientComponentClient()
  const [employer, setEmployer] = useState<EmployerData | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: emp } = await supabase
        .from('employers')
        .select('*')
        .eq('email', user.email)
        .single()

      if (emp) {
        setEmployer(emp as EmployerData)

        // Load team member details
        if (emp.team_members?.length > 0) {
          const { data: members } = await supabase
            .from('students')
            .select('id, name, email, completed_modules, avg_quiz_score, created_at')
            .in('id', emp.team_members)

          const { data: certs } = await supabase
            .from('certificates')
            .select('student_id')
            .in('student_id', emp.team_members)

          const certSet = new Set((certs ?? []).map((c: { student_id: string }) => c.student_id))

          setTeam(
            (members ?? []).map((m: {
              id: string; name: string; email: string
              completed_modules: string[]; avg_quiz_score: number; created_at: string
            }) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              enrolledAt: m.created_at,
              completedModules: (m.completed_modules ?? []).length,
              avgScore: Math.round(m.avg_quiz_score ?? 0),
              certificateEarned: certSet.has(m.id),
            }))
          )
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')

    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail)
    if (error) {
      setInviteMsg(`Error: ${error.message}`)
    } else {
      setInviteMsg(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
    }
    setInviting(false)
  }

  function downloadCSV() {
    const headers = ['Name', 'Email', 'Enrolled', 'Modules Done', 'Avg Score', 'Certificate']
    const rows = team.map(m => [
      m.name, m.email, new Date(m.enrolledAt).toLocaleDateString('en-GB'),
      m.completedModules, m.avgScore + '%', m.certificateEarned ? 'Yes' : 'No',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `team-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
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
        <h2 className="text-xl font-bold text-slate-700">No employer account found</h2>
        <p className="text-slate-500 text-sm">Please upgrade to an employer plan to access team management.</p>
        <button className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          View plans
        </button>
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{employer.company_name}</h1>
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mt-1 capitalize ${PLAN_COLORS[employer.plan]}`}>
            {employer.plan} plan · {employer.used_seats}/{PLAN_SEATS[employer.plan]} seats
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
        <form onSubmit={handleInvite} className="flex gap-3">
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
                  <td className="px-4 py-3 text-slate-500">{member.email}</td>
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
