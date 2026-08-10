'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { Eye, EyeOff, X, ArrowRight, Lock } from 'lucide-react'
import WatchSpinner from '@/components/WatchSpinner'

function UpdatePasswordForm() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Clear error when user types
  useEffect(() => { if (error) setError('') }, [password]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) { setError(updateError.message); return }
      setSuccess(true)
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1500)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    borderRadius: 12, color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 600, color: 'var(--text-tertiary)',
    letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase',
  }

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }} className="text-[22px]">
          Update password
        </h1>
        <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }} className="text-sm">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }} className="text-xs">New Password</label>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
              placeholder="••••••••" style={{ ...inputStyle, paddingRight: 44 }} className="text-sm"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(78,205,196,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78,205,196,0.08)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(78,205,196,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(78,205,196,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'rgba(232,80,122,0.1)', border: '1px solid rgba(232,80,122,0.3)', borderRadius: 10, padding: '12px 16px', color: '#e8507a', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8 }} className="text-small">
              <X size={14} style={{ flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
          {success && (
             <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
               style={{ background: 'rgba(82,217,139,0.1)', border: '1px solid rgba(82,217,139,0.3)', borderRadius: 10, padding: '12px 16px', color: '#52D98B', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8 }} className="text-small">
               Password updated successfully! Redirecting...
             </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="submit" disabled={loading || success}
          whileHover={!loading && !success ? { scale: 1.02, boxShadow: '0 0 40px rgba(78,205,196,0.25)' } : {}}
          whileTap={!loading && !success ? { scale: 0.98 } : {}}
          style={{ width: '100%', padding: '13px 24px', borderRadius: 12, border: `1px solid ${success ? 'rgba(82,217,139,0.5)' : 'rgba(78,205,196,0.45)'}`, background: success ? 'rgba(82,217,139,0.15)' : loading ? 'rgba(78,205,196,0.08)' : 'linear-gradient(135deg,rgba(78,205,196,0.22),rgba(91,120,216,0.22))', color: success ? '#52D98B' : loading ? 'rgba(78,205,196,0.5)' : '#4ECDC4', fontWeight: 700, cursor: loading || success ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '0.04em', transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif' }} className="text-sm">
          {success ? (
            <><ArrowRight size={15} /> Updated</>
          ) : loading ? (
            <><WatchSpinner size={18} /> Updating…</>
          ) : (
            <><Lock size={15} fill="#4ECDC4" /> Update password</>
          )}
        </motion.button>
      </form>
    </>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  )
}
