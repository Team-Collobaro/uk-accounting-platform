'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { Eye, EyeOff, Sparkles, Check, X, Shield, BookOpen, Award } from 'lucide-react'
import WatchSpinner from '@/components/WatchSpinner'

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Contains a number', pass: /\d/.test(password) },
    { label: 'Contains uppercase', pass: /[A-Z]/.test(password) },
  ]
  const score = checks.filter(c => c.pass).length
  const colors = ['#E8507A', '#E8B84B', '#52D98B']
  const labels = ['Weak', 'Good', 'Strong']

  if (!password) return null

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i < score ? colors[score - 1] : 'rgba(255,255,255,0.08)', transition: 'background 0.3s', boxShadow: i < score ? `0 0 6px ${colors[score - 1]}60` : 'none' }} />
        ))}
      </div>
      {score > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {checks.map(c => (
              <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: c.pass ? '#52D98B' : 'rgba(255,255,255,0.25)' }}>
                {c.pass ? <Check size={9} /> : <X size={9} />} {c.label}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors[score - 1], fontFamily: 'monospace' }}>{labels[score - 1]}</span>
        </div>
      )}
    </motion.div>
  )
}

function PasswordMatchIndicator({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null
  const match = password === confirm
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11,
        color: match ? '#52D98B' : '#E8507A' }}>
      {match ? <Check size={10} /> : <X size={10} />}
      {match ? 'Passwords match' : 'Passwords do not match'}
    </motion.div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [step,         setStep]         = useState<'form' | 'success'>('form')

  // Clear error when user types
  useEffect(() => { if (error) setError('') }, [name, email, password, confirm]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })

      if (signUpError) { setError(signUpError.message); return }

      if (data.user) {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id, name, email }),
        })
        if (!res.ok) {
          const body = await res.json() as { error?: string }
          setError(body.error ?? 'Failed to create student profile')
          return
        }
      }

      setStep('success')
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
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
  const focusOn = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(78,205,196,0.55)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78,205,196,0.08)'
  }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(78,205,196,0.2)'
    e.currentTarget.style.boxShadow = 'none'
  }

  if (step === 'success') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <motion.div animate={{ scale: [0.8, 1.15, 1] }} transition={{ duration: 0.5 }}
          style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(82,217,139,0.15)', border: '2px solid rgba(82,217,139,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(82,217,139,0.25)' }}>
          <Check size={28} color="#52D98B" />
        </motion.div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E8F0FC', marginBottom: 6 }}>Account created!</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Welcome, {name.split(' ')[0]}. Taking you to your dashboard…
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 260 }}>
          {[
            { icon: BookOpen, text: '87 modules awaiting you', color: '#4ECDC4' },
            { icon: Shield,   text: 'Alex AI tutor is ready',  color: '#9B6FD0' },
            { icon: Award,    text: 'Certificate on completion', color: '#E8B84B' },
          ].map(({ icon: Icon, text, color }) => (
            <motion.div key={text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 10, padding: '8px 14px' }}>
              <Icon size={13} color={color} />
              <span style={{ fontSize: 12, color: '#8EA8CC' }}>{text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e8f0fc', letterSpacing: '-0.02em', marginBottom: 6 }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          Start your UK accounting journey — free, forever.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Full name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" placeholder="Jane Smith" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
        </div>

        <div>
          <label style={labelStyle}>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="Min. 8 characters" style={{ ...inputStyle, paddingRight: 44 }} onFocus={focusOn} onBlur={focusOff} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(78,205,196,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <PasswordStrengthBar password={password} />
        </div>

        <div>
          <label style={labelStyle}>Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" placeholder="Re-enter password" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          <PasswordMatchIndicator password={password} confirm={confirm} />
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

        <motion.button type="submit" disabled={loading}
          whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 40px rgba(78,205,196,0.25)' } : {}}
          whileTap={!loading ? { scale: 0.98 } : {}}
          style={{ width: '100%', padding: '13px 24px', borderRadius: 12, border: '1px solid rgba(78,205,196,0.45)', background: loading ? 'rgba(78,205,196,0.08)' : 'linear-gradient(135deg,rgba(78,205,196,0.22),rgba(91,120,216,0.22))', color: loading ? 'rgba(78,205,196,0.5)' : '#4ECDC4', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '0.04em', transition: 'background 0.2s', fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}>
          {loading ? (<><WatchSpinner size={18} /> Creating account…</>) : (<><Sparkles size={15} fill="#4ECDC4" /> Create account</>)}
        </motion.button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#4ECDC4', fontWeight: 600, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </>
  )
}
