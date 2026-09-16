'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { Eye, EyeOff, X, ArrowRight, LogIn } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  const [email, setEmail] = useState(() => {
    try { return typeof window !== 'undefined' ? (localStorage.getItem('uk_acct_email') ?? '') : '' } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
    background: '#f8f9fa',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 12, color: '#1a1a1a', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Montserrat, system-ui, sans-serif', boxSizing: 'border-box',
    fontSize: 14,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 600, color: '#4a4a4a',
    letterSpacing: '0.04em', marginBottom: 8, fontSize: 12, textTransform: 'uppercase',
  }

  return (
    <>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <h1 style={{ fontWeight: 800, color: '#1A365D', letterSpacing: '-0.02em', margin: '0 0 6px 0', fontSize: 22 }}>
          Welcome back
        </h1>
        <p style={{ color: '#6b6b6b', lineHeight: 1.5, fontSize: 14, margin: 0 }}>
          Continue your UK accounting journey
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={labelStyle}>Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email" placeholder="you@example.com" style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#1A365D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,54,93,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
            <Link href="/reset-password" style={{ color: '#BA923A', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              placeholder="••••••••" style={{ ...inputStyle, paddingRight: 44 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#1A365D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,54,93,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a0aab2', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1A365D')}
              onMouseLeave={e => (e.currentTarget.style.color = '#a0aab2')}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#b91c1c', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <X size={14} style={{ flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="submit" disabled={loading || success}
          whileHover={!loading && !success ? { scale: 1.02 } : {}}
          whileTap={!loading && !success ? { scale: 0.98 } : {}}
          style={{ width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none', background: success ? '#15803d' : '#1A365D', color: '#fff', fontWeight: 700, cursor: loading || success ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, transition: 'all 0.2s', opacity: loading ? 0.7 : 1 }}>
          {success ? (
            <><ArrowRight size={16} /> Taking you in…</>
          ) : loading ? (
            <>Signing in…</>
          ) : (
            <><LogIn size={16} /> Sign in</>
          )}
        </motion.button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
        <span style={{ color: '#a0aab2', letterSpacing: '0.1em', fontSize: 10, fontWeight: 600 }}>NEW HERE?</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
      </div>

      <p style={{ textAlign: 'center', color: '#6b6b6b', fontSize: 14, margin: 0 }}>
        Don't have an account?{' '}
        <Link href="/register" style={{ color: '#BA923A', fontWeight: 700, textDecoration: 'none' }}>
          Enrol today →
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
