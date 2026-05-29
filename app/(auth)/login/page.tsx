'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { Eye, EyeOff, Zap, X, ArrowRight } from 'lucide-react'
import WatchSpinner from '@/components/WatchSpinner'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  const [email,        setEmail]        = useState(() => {
    try { return typeof window !== 'undefined' ? (localStorage.getItem('uk_acct_email') ?? '') : '' } catch { return '' }
  })
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  // Clear error when user types
  useEffect(() => { if (error) setError('') }, [email, password]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); return }
      try { localStorage.setItem('uk_acct_email', email) } catch { /* ignore */ }
      setSuccess(true)
      const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'
      setTimeout(() => { router.push(redirectTo); router.refresh() }, 600)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: 'rgba(14,21,37,0.8)',
    border: '1px solid rgba(78,205,196,0.2)',
    borderRadius: 12, color: '#e8f0fc', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase',
  }

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e8f0fc', letterSpacing: '-0.02em', marginBottom: 6 }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          Continue your UK accounting journey
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={labelStyle}>Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email" placeholder="you@example.com" style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(78,205,196,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78,205,196,0.08)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(78,205,196,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              placeholder="••••••••" style={{ ...inputStyle, paddingRight: 44 }}
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
              style={{ background: 'rgba(232,80,122,0.1)', border: '1px solid rgba(232,80,122,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#e8507a', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <X size={14} style={{ flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="submit" disabled={loading || success}
          whileHover={!loading && !success ? { scale: 1.02, boxShadow: '0 0 40px rgba(78,205,196,0.25)' } : {}}
          whileTap={!loading && !success ? { scale: 0.98 } : {}}
          style={{ width: '100%', padding: '13px 24px', borderRadius: 12, border: `1px solid ${success ? 'rgba(82,217,139,0.5)' : 'rgba(78,205,196,0.45)'}`, background: success ? 'rgba(82,217,139,0.15)' : loading ? 'rgba(78,205,196,0.08)' : 'linear-gradient(135deg,rgba(78,205,196,0.22),rgba(91,120,216,0.22))', color: success ? '#52D98B' : loading ? 'rgba(78,205,196,0.5)' : '#4ECDC4', fontWeight: 700, fontSize: 14, cursor: loading || success ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '0.04em', transition: 'all 0.2s', fontFamily: 'Inter, system-ui, sans-serif' }}>
          {success ? (
            <><ArrowRight size={15} /> Taking you in…</>
          ) : loading ? (
            <><WatchSpinner size={18} /> Signing in…</>
          ) : (
            <><Zap size={15} fill="#4ECDC4" /> Sign in</>
          )}
        </motion.button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>NEW HERE?</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/register" style={{ color: '#4ECDC4', fontWeight: 600, textDecoration: 'none' }}>
          Create one free →
        </Link>
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
