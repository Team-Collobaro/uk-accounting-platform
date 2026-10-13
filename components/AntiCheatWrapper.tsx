'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ShieldAlert, AlertTriangle, Monitor, Smartphone, Laptop } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProctoringConfig } from '@/lib/proctoringConfig'

export interface SecurityIncidentItem {
  source: 'laptop' | 'mobile' | 'system' | string
  message: string
  severity?: 'warning' | 'soft' | 'hard' | 'technical' | string
}

interface AntiCheatWrapperProps {
  children: React.ReactNode
  isViolatingProctoring?: boolean
  proctoringWarning?: string
  isViolatingMobile?: boolean
  mobileWarning?: string
  sessionId?: string
  lockedIncidents?: SecurityIncidentItem[]
  warningIncidents?: SecurityIncidentItem[]
}

export default function AntiCheatWrapper({
  children,
  isViolatingProctoring = false,
  proctoringWarning = '',
  isViolatingMobile = false,
  mobileWarning = '',
  sessionId,
  lockedIncidents = [],
  warningIncidents = [],
}: AntiCheatWrapperProps) {
  const { config } = useProctoringConfig()
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const [isBlurredBySystem, setIsBlurredBySystem] = useState(false)
  const [systemWarning, setSystemWarning] = useState('')

  // Build combined locked list
  const activeLockedList: SecurityIncidentItem[] = [...lockedIncidents]

  if (isBlurredBySystem && systemWarning) {
    activeLockedList.push({
      source: 'system',
      message: systemWarning,
      severity: 'technical',
    })
  }

  if (isViolatingProctoring && config.laptop.cameraFeed && proctoringWarning) {
    if (!activeLockedList.some((i) => i.source === 'laptop' && i.message === proctoringWarning)) {
      activeLockedList.push({
        source: 'laptop',
        message: proctoringWarning,
        severity: 'hard',
      })
    }
  }

  if (isViolatingMobile && config.mobile.cameraFeed && mobileWarning) {
    if (!activeLockedList.some((i) => i.source === 'mobile' && i.message === mobileWarning)) {
      activeLockedList.push({
        source: 'mobile',
        message: mobileWarning,
        severity: 'hard',
      })
    }
  }

  const isLocked = activeLockedList.length > 0
  const hasSoftWarnings = warningIncidents.length > 0 && !isLocked

  useEffect(() => {
    // 1. Handle window blur (switching tabs, DevTools)
    const handleBlur = () => {
      if (!configRef.current.browserGuards.tabSwitchBlur) return
      setIsBlurredBySystem(true)
      setSystemWarning('Content hidden. Please return to the window to continue.')
    }

    const handleFocus = () => {
      setIsBlurredBySystem(false)
      setSystemWarning('')
    }

    // 2. Handle screenshot shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!configRef.current.browserGuards.screenshotProtection) return

      if (e.metaKey && e.shiftKey) {
        setIsBlurredBySystem(true)
        setSystemWarning('Screenshot shortcut detected.')
      }

      if (e.key === 'PrintScreen') {
        setIsBlurredBySystem(true)
        setSystemWarning('Screenshots are not permitted on Knowledge Checks.')
        e.preventDefault()
        navigator.clipboard?.writeText('')
      }

      if (configRef.current.browserGuards.clipboardCopyProtection) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          e.preventDefault()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!configRef.current.browserGuards.screenshotProtection) return
      if (!e.metaKey || !e.shiftKey) {
        if (systemWarning === 'Screenshot shortcut detected.') {
          setTimeout(() => {
            if (document.hasFocus()) {
              setIsBlurredBySystem(false)
              setSystemWarning('')
            }
          }, 1000)
        }
      }
    }

    // 3. Clipboard and Context menu guards
    const handleCopy = (e: ClipboardEvent) => {
      if (!configRef.current.browserGuards.clipboardCopyProtection) return
      e.preventDefault()
      e.clipboardData?.setData('text/plain', 'Copying is disabled.')
    }

    const handleContextMenu = (e: MouseEvent) => {
      if (!configRef.current.browserGuards.clipboardCopyProtection) return
      e.preventDefault()
    }

    // 4. Multiple monitor guard
    const checkMultipleMonitors = () => {
      if (!configRef.current.browserGuards.multiMonitorDetection) return false
      if (typeof window !== 'undefined' && window.screen) {
        if ((window.screen as any).isExtended) {
          setIsBlurredBySystem(true)
          setSystemWarning('Multiple monitors detected. Please disconnect secondary displays.')
          return true
        } else {
          setSystemWarning((prev) => {
            if (prev.includes('monitor') || prev.includes('display')) {
              setIsBlurredBySystem(false)
              return ''
            }
            return prev
          })
        }
      }
      return false
    }

    const hasMultipleMonitors = checkMultipleMonitors()
    if (typeof window !== 'undefined' && window.screen) {
      ;(window.screen as any).addEventListener('change', checkMultipleMonitors)
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('contextmenu', handleContextMenu)
      if (typeof window !== 'undefined' && window.screen) {
        ;(window.screen as any).removeEventListener('change', checkMultipleMonitors)
      }
    }
  }, [systemWarning])

  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'laptop':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Laptop className="w-3 h-3" /> Laptop Camera
          </span>
        )
      case 'mobile':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Smartphone className="w-3 h-3" /> Mobile Camera
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Monitor className="w-3 h-3" /> System Guard
          </span>
        )
    }
  }

  return (
    <div className="anti-cheat-container no-copy relative">
      {/* ── Soft / Provisional Warning Banner (Non-blurring) ── */}
      <AnimatePresence>
        {hasSoftWarnings && (
          <motion.div
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -30, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.95)',
              backdropFilter: 'blur(12px)',
              color: '#0f172a',
              padding: '12px 20px',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              maxWidth: '90vw',
              width: '480px',
            }}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-950 flex-shrink-0 animate-bounce" />
              <span>Provisional Warning</span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-amber-950 font-medium">
              {warningIncidents.map((incident, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <span>{incident.message}</span>
                  {renderSourceBadge(incident.source)}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hard / Technical Locked Screen Blur Overlay ── */}
      {isLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-6 select-none">
          <div className="text-center p-8 max-w-lg w-full bg-slate-900/90 rounded-2xl border border-red-500/40 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center mb-5">
              <ShieldAlert className="w-9 h-9 text-red-400 animate-pulse" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              Assessment Locked
            </h2>
            <p className="text-slate-300 text-xs mb-5">
              Security protocol active. Resolve the conditions below to automatically unlock.
            </p>

            <div className="w-full flex flex-col gap-2.5 mb-6 text-left">
              {activeLockedList.map((inc, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-200"
                >
                  <span className="font-medium">{inc.message}</span>
                  {renderSourceBadge(inc.source)}
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Continuous clean view for ~2 seconds will automatically resume.
            </div>
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div
        className={`transition-all duration-300 ${
          isLocked
            ? 'opacity-0 blur-lg select-none pointer-events-none'
            : 'opacity-100 blur-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
