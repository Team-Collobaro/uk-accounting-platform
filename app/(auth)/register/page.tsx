'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { Eye, EyeOff, X, ArrowRight, UserPlus, Building2 } from 'lucide-react'
import RoleToggle, { type AuthRole } from '@/components/auth/RoleToggle'
import { getAppUrl } from '@/lib/url'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  const [role, setRole] = useState<AuthRole>(searchParams.get('role') === 'employer' ? 'employer' : 'student')
  const isEmployer = role === 'employer'
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)
  const [confirmationRequired, setConfirmationRequired] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role,
            ...(isEmployer && { company_name: companyName.trim() }),
          },
          emailRedirectTo: `${getAppUrl()}/auth/callback`,
        }
      })
      if (signUpError) { setError(signUpError.message); return }

      try { localStorage.setItem('uk_acct_email', email) } catch { /* ignore */ }
      if (signUpData.session) {
        const profileResponse = isEmployer
          ? await fetch('/api/employer/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName: companyName.trim() }),
          })
          : await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${firstName.trim()} ${lastName.trim()}`.trim() }),
          })
        if (!profileResponse.ok) console.warn('Profile will be created on first sign-in')
      } else {
        setConfirmationRequired(true)
      }
      setSuccess(true)
      if (signUpData.session) setTimeout(() => { router.push(isEmployer ? '/employer' : '/dashboard') }, 2000)
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

  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <ArrowRight size={32} color="#fff" />
        </div>
        <h2 style={{ fontWeight: 800, color: '#1A365D', marginBottom: 12, fontSize: 24 }}>
          {confirmationRequired ? 'Confirm Your Email' : 'Account Created'}
        </h2>
        <p style={{ color: '#6b6b6b', lineHeight: 1.6, fontSize: 15 }}>
          {confirmationRequired
            ? `We sent a confirmation link to ${email}. Open it to activate your account, then sign in.`
            : isEmployer
              ? `Welcome to UKATI. We're taking you to your employer portal to set up your team.`
              : `Welcome to UKATI. We're redirecting you to your dashboard to begin your journey.`}
        </p>
        {confirmationRequired && (
          <Link href={isEmployer ? '/login?role=employer' : '/login'} style={{ display: 'inline-block', marginTop: 20, color: '#1A365D', fontWeight: 700, textDecoration: 'none' }}>
            Go to sign in →
          </Link>
        )}
      </motion.div>
    )
  }

  return (
    <>
      <RoleToggle value={role} onChange={(next) => { setRole(next); setError('') }} />

      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <h1 style={{ fontWeight: 800, color: '#1A365D', letterSpacing: '-0.02em', margin: '0 0 6px 0', fontSize: 22 }}>
          {isEmployer ? 'Create an employer account' : 'Create an account'}
        </h1>
        <p style={{ color: '#6b6b6b', lineHeight: 1.5, fontSize: 14, margin: 0 }}>
          {isEmployer ? 'Train your team and track their progress' : 'Begin your UK accounting journey today'}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AnimatePresence initial={false}>
          {isEmployer && (
            <motion.div
              key="company"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <label style={labelStyle}>Company name</label>
              <input
                id="register-company-name"
                type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                required={isEmployer} autoComplete="organization" placeholder="Acme Accounting Ltd" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#1A365D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,54,93,0.1)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First name</label>
            <input
              type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#1A365D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,54,93,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last name</label>
            <input
              type="text" value={lastName} onChange={e => setLastName(e.target.value)} required style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#1A365D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,54,93,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>{isEmployer ? 'Work email' : 'Email address'}</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email" placeholder={isEmployer ? 'you@company.com' : 'you@example.com'} style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#1A365D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,54,93,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
              placeholder="••••••••" style={{ ...inputStyle, paddingRight: 44 }}
              minLength={8}
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
          style={{ width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none', background: '#BA923A', color: '#fff', fontWeight: 700, cursor: loading || success ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, transition: 'all 0.2s', opacity: loading ? 0.7 : 1, marginTop: 8 }}>
          {loading ? (
            <>Creating account…</>
          ) : isEmployer ? (
            <><Building2 size={16} /> Create Employer Account</>
          ) : (
            <><UserPlus size={16} /> Enrol Now</>
          )}
        </motion.button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
        <span style={{ color: '#a0aab2', letterSpacing: '0.1em', fontSize: 10, fontWeight: 600 }}>{isEmployer ? 'ALREADY REGISTERED?' : 'ALREADY ENROLLED?'}</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
      </div>

      <p style={{ textAlign: 'center', color: '#6b6b6b', fontSize: 14, margin: 0 }}>
        Already have an account?{' '}
        <Link href={isEmployer ? '/login?role=employer' : '/login'} style={{ color: '#1A365D', fontWeight: 700, textDecoration: 'none' }}>
          Sign in →
        </Link>
      </p>
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
