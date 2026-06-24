'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { Award, Lock, CheckCircle2, ShieldCheck, Download, AlertCircle, Circle } from 'lucide-react'

interface Certificate {
  id: string
  verification_code: string
  final_score: number
  completion_date: string
}

interface ProgressData {
  completedModules: string[]
  overallPercentage: number
  certificates: Certificate[]
}

export default function CertificatePage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [studentName, setStudentName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      
      const [progressRes, studentRes] = await Promise.all([
        fetch('/api/progress'),
        supabase.from('students').select('name').eq('id', user.id).single()
      ])

      if (studentRes.data) setStudentName(studentRes.data.name)
      if (progressRes.ok) {
        setProgress(await progressRes.json() as ProgressData)
      }
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--ac-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const hasCertificate = progress?.certificates && progress.certificates.length > 0
  const completedCount = progress?.completedModules.length ?? 0
  const totalCount = 87
  const percentage = progress?.overallPercentage ?? 0

  return (
    <div style={{ minHeight: '100vh', padding: '40px 28px', maxWidth: 1000, margin: '0 auto', color: 'var(--text-primary)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>

        <div>
          <h1 style={{ fontWeight: 800, margin: '0 0 4px' }} className="text-2xl">My Certificate</h1>
          <p style={{ color: 'var(--text-tertiary)', margin: 0 }} className="text-small">View and verify your official qualification</p>
        </div>
      </div>

      {hasCertificate ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--card-bg)', border: '1px solid rgba(232,184,75,0.3)', borderRadius: 24, padding: '40px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
          
          {/* Decorative background */}
          <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,184,75,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Award size={64} color="#E8B84B" style={{ marginBottom: 20 }} />
            
            <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }} className="text-small">Certificate of Completion</p>
            <h2 style={{ fontWeight: 800, color: '#E8B84B', margin: '0 0 20px' }} className="text-4xl">UK Bookkeeping, Accounting & Taxation</h2>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: 5 }} className="text-base">This certifies that</p>
            <h3 style={{ fontWeight: 700, margin: '0 0 30px' }} className="text-3xl">{studentName}</h3>
            
            <p style={{ color: 'var(--text-secondary)', maxWidth: 600, lineHeight: 1.6, marginBottom: 40 }} className="text-sm">
              Has successfully completed all 87 modules and passed the final comprehensive examination, demonstrating proficiency in UK accounting principles, taxation rules, and compliance standards.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 40, padding: '20px 40px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, marginBottom: 30 }}>
              <div>
                <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', marginBottom: 4 }} className="text-tiny">FINAL SCORE</p>
                <p style={{ fontWeight: 800, color: 'var(--ac-mint)', margin: 0 }} className="text-2xl">{progress.certificates[0].final_score}%</p>
              </div>
              <div style={{ width: 1, height: 40, background: 'var(--border-subtle)' }} />
              <div>
                <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', marginBottom: 4 }} className="text-tiny">ISSUED DATE</p>
                <p style={{ fontWeight: 600, margin: 0 }} className="text-base">{new Date(progress.certificates[0].completion_date).toLocaleDateString('en-GB')}</p>
              </div>
              <div style={{ width: 1, height: 40, background: 'var(--border-subtle)' }} />
              <div>
                <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', marginBottom: 4 }} className="text-tiny">VERIFICATION ID</p>
                <p style={{ fontFamily: 'monospace', margin: 0 }} className="text-sm">{progress.certificates[0].verification_code}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <Link href={`/verify/${progress.certificates[0].verification_code}`} style={{ textDecoration: 'none' }}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 12, color: '#E8B84B', fontWeight: 700, cursor: 'pointer' }} className="text-sm">
                  <ShieldCheck size={18} /> Public Verify Link
                </motion.button>
              </Link>
              
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }} className="text-sm">
                <Download size={18} /> Download / Print
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative' }}>
            <Lock size={32} color="var(--text-tertiary)" />
            <div style={{ position: 'absolute', bottom: -5, right: -5, width: 32, height: 32, borderRadius: '50%', background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} color="#E8B84B" />
            </div>
          </div>

          <h2 style={{ fontWeight: 700, margin: '0 0 12px' }} className="text-[22px]">Certificate Locked</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, lineHeight: 1.6, margin: '0 0 30px' }} className="text-sm">
            To unlock your official verifiable certificate, you must complete all 87 modules and achieve a passing score of 70% or higher on the final comprehensive examination.
          </p>

          <div style={{ width: '100%', maxWidth: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 600, margin: 0 }} className="text-sm">Your Progress</h3>
              <span style={{ fontFamily: 'monospace', color: 'var(--ac-cyan)' }} className="text-small">{completedCount} / {totalCount} Modules</span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 6, borderRadius: 6, background: 'var(--bg-base)', overflow: 'hidden', marginBottom: 24 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, delay: 0.3 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #4ECDC4, #E8B84B)' }} />
            </div>

            {/* Requirements Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {completedCount === totalCount ? <CheckCircle2 size={18} color="var(--ac-mint)" /> : <Circle size={18} color="var(--text-tertiary)" />}
                <span style={{ color: completedCount === totalCount ? 'var(--text-primary)' : 'var(--text-secondary)' }} className="text-sm">Complete all 87 modules</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Circle size={18} color="var(--text-tertiary)" />
                <span style={{ color: 'var(--text-secondary)' }} className="text-sm">Pass the final module quiz with 70%+</span>
              </div>
            </div>
          </div>

        </motion.div>
      )}

    </div>
  )
}
