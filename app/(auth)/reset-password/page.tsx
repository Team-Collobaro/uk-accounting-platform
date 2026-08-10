'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { X, ArrowRight, Mail } from 'lucide-react'
import WatchSpinner from '@/components/WatchSpinner'

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Clear error when user types
  useEffect(() => { if (error) setError('') }, [email]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (resetError) { setError(resetError.message); return }
      setSuccess(true)
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
          Reset password
        </h1>
        <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }} className="text-sm">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={labelStyle} className="text-xs">Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email" placeholder="you@example.com" style={inputStyle} className="text-sm"
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(78,205,196,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78,205,196,0.08)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(78,205,196,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
          />
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
              Check your email for the reset link!
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="submit" disabled={loading || success}
          whileHover={!loading && !success ? { scale: 1.02, boxShadow: '0 0 40px rgba(78,205,196,0.25)' } : {}}
          whileTap={!loading && !success ? { scale: 0.98 } : {}}
          style={{ width: '100%', padding: '13px 24px', borderRadius: 12, border: `1px solid ${success ? 'rgba(82,217,139,0.5)' : 'rgba(78,205,196,0.45)'}`, background: success ? 'rgba(82,217,139,0.15)' : loading ? 'rgba(78,205,196,0.08)' : 'linear-gradient(135deg,rgba(78,205,196,0.22),rgba(91,120,216,0.22))', color: success ? '#52D98B' : loading ? 'rgba(78,205,196,0.5)' : '#4ECDC4', fontWeight: 700, cursor: loading || success ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '0.04em', transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif' }} className="text-sm">
          {success ? (
            <><ArrowRight size={15} /> Sent</>
          ) : loading ? (
            <><WatchSpinner size={18} /> Sending…</>
          ) : (
            <><Mail size={15} fill="#4ECDC4" /> Send reset link</>
          )}
        </motion.button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }} className="text-tiny">OR</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }} className="text-small">
        Remember your password?{' '}
        <Link href="/login" style={{ color: 'var(--ac-cyan)', fontWeight: 600, textDecoration: 'none' }}>
          Sign in →
        </Link>
      </p>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
