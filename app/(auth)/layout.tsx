'use client'

import { motion } from 'framer-motion'
import WatchSpinner from '@/components/WatchSpinner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#060a12',
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
          -webkit-box-shadow: 0 0 0 1000px #0e1525 inset !important;
          -webkit-text-fill-color: #e8f0fc !important;
          caret-color: #e8f0fc;
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
            <span style={{ fontWeight: 700, fontSize: 20, color: '#e8f0fc', letterSpacing: '-0.02em' }}>
              UK Accounting <span style={{ color: '#4ECDC4' }}>Pro</span>
            </span>
          </div>
          <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(78,205,196,0.55)', letterSpacing: '0.2em' }}>
            AI-POWERED · PROFESSIONAL LEARNING
          </p>
        </div>

        {/* Glass card */}
        <div style={{
          background: 'rgba(9,13,26,0.75)',
          border: '1px solid rgba(78,205,196,0.18)',
          borderRadius: 24,
          padding: '36px 32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(78,205,196,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}
