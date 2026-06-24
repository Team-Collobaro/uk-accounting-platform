'use client'

import { motion } from 'framer-motion'
import WatchSpinner from '@/components/WatchSpinner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--auth-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,0.02) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px var(--input-bg) inset !important;
          -webkit-text-fill-color: var(--text-primary) !important;
          caret-color: var(--text-primary);
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <WatchSpinner size={36} />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }} className="text-xl">
              UK Accounting <span style={{ color: 'var(--ac-cyan)' }}>Pro</span>
            </span>
          </div>
          <p style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', letterSpacing: '0.2em' }} className="text-xs">
            AI-POWERED · PROFESSIONAL LEARNING
          </p>
        </div>

        {/* Glass card */}
        <div style={{
          background: 'var(--auth-card-bg)',
          border: '1px solid var(--auth-card-border)',
          borderRadius: 24,
          padding: '36px 32px',
          backdropFilter: 'blur(24px)',
          boxShadow: 'var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}
