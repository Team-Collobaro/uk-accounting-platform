'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa', // Clean corporate background
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Montserrat, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative background shapes */}
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'rgba(26,54,93,0.02)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'rgba(186,146,58,0.03)', pointerEvents: 'none' }} />

      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
          -webkit-text-fill-color: #1a1a1a !important;
          caret-color: #1a1a1a;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Image src="/ukati-logo.jpg" alt="UKATI Logo" width={80} height={80} style={{ objectFit: 'contain', marginBottom: 16, mixBlendMode: 'multiply' }} />
          <h2 style={{ fontWeight: 800, color: '#1A365D', letterSpacing: '-0.02em', fontSize: 22, margin: '0 0 4px 0' }}>
            UKATI Learning Portal
          </h2>
          <p style={{ color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 12, margin: 0 }}>
            By Team Collaboro
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 24,
          padding: '40px 32px',
          boxShadow: '0 20px 40px rgba(26,54,93,0.06)',
        }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}
