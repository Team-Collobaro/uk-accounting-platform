'use client'

import React, { useEffect, useRef, useState } from 'react'

type Status = 'not_linked' | 'paired' | 'reconnecting' | 'live' | 'degraded' | 'technical_issue'

interface MobileDeviceStatusProps {
  sessionId: string
  onStatusChange?: (status: Status) => void
  onViolation?: (isViolating: boolean, message: string) => void
}

export default function MobileDeviceStatus({ sessionId, onStatusChange, onViolation }: MobileDeviceStatusProps) {
  const [status, setStatus] = useState<Status>('not_linked')
  const [reconnectingSeconds, setReconnectingSeconds] = useState(0)

  // Shared state between closure and component
  const lastHeartbeatRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pausedTimerRef = useRef<NodeJS.Timeout | null>(null)

  const updateStatus = (s: Status) => {
    setStatus(s)
    onStatusChange?.(s)
  }

  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | undefined

    const run = async () => {
      const { createClientComponentClient } = await import('@/lib/supabase')
      if (disposed) return
      const supabase = createClientComponentClient()

      const channel = supabase.channel(`proctor:${sessionId}`, { config: { private: true } })

      channel
        .on('broadcast', { event: 'paired' }, () => {
          lastHeartbeatRef.current = Date.now()
          updateStatus('paired')
        })
        .on('broadcast', { event: 'heartbeat' }, () => {
          lastHeartbeatRef.current = Date.now()
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
            setReconnectingSeconds(0)
          }
          updateStatus('live')
        })
        .on('broadcast', { event: 'tier2_unavailable' }, () => {
          updateStatus('degraded')
        })
        .on('broadcast', { event: 'error' }, () => {
          updateStatus('technical_issue')
        })
        .on('broadcast', { event: 'second_phone' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Secondary phone detected')
        })
        .on('broadcast', { event: 'second_monitor' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Secondary monitor detected')
        })
        .on('broadcast', { event: 'suspicious_object' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Suspicious object detected')
        })
        .on('broadcast', { event: 'second_person' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Another person detected')
        })
        .on('broadcast', { event: 'student_missing' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Student not visible or camera blocked')
        })
        .on('broadcast', { event: 'static_image_spoof' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Static image spoofing detected')
        })
        .on('broadcast', { event: 'clear' }, () => {
          onViolation?.(false, '')
        })
        .on('broadcast', { event: 'paused' }, () => {
          if (pausedTimerRef.current) clearTimeout(pausedTimerRef.current)
          onViolation?.(true, 'Mobile app moved to background. Please return to the LMS app on your phone within 30s.')
          pausedTimerRef.current = setTimeout(() => {
            onViolation?.(true, 'Mobile app was closed or sent to background for too long.')
          }, 30000)
        })
        .on('broadcast', { event: 'resumed' }, () => {
          if (pausedTimerRef.current) {
            clearTimeout(pausedTimerRef.current)
            pausedTimerRef.current = null
          }
          onViolation?.(false, '')
        })
        .subscribe()

      // BUG 3 FIX: Poll session status on mount to catch 'paired' before first heartbeat
      const pollForPairing = async () => {
        try {
          const res = await fetch(`/api/proctor-session?sessionId=${sessionId}`)
          const data = await res.json()
          if (data.status === 'paired' || data.status === 'active') {
            updateStatus('paired')
          }
        } catch (_) {}
      }
      pollForPairing()

      // Heartbeat watchdog — check every 5 seconds
      const watchdog = setInterval(() => {
        if (lastHeartbeatRef.current === null) return // Wait for initial connection

        const elapsed = Date.now() - lastHeartbeatRef.current
        if (elapsed > 10_000 && elapsed < 60_000) {
          updateStatus('reconnecting')
          setReconnectingSeconds(Math.floor(elapsed / 1000))
        } else if (elapsed >= 60_000) {
          updateStatus('technical_issue')
        }
      }, 5_000)

      cleanup = () => {
        clearInterval(watchdog)
        if (pausedTimerRef.current) clearTimeout(pausedTimerRef.current)
        supabase.removeChannel(channel)
      }
    }

    run()
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [sessionId])

  const config: Record<Status, { color: string; bg: string; border: string; icon: string; label: string; sub: string }> = {
    not_linked: {
      color: '#E8507A', bg: 'rgba(232,80,122,0.08)', border: 'rgba(232,80,122,0.25)',
      icon: '📵', label: 'Mobile Not Linked', sub: 'Scan QR code to continue',
    },
    paired: {
      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',
      icon: '🔗', label: 'Phone Paired', sub: 'Waiting for camera to go live',
    },
    reconnecting: {
      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',
      icon: '🔄', label: `Reconnecting... (${reconnectingSeconds}s)`, sub: 'Exam paused',
    },
    live: {
      color: '#52D98B', bg: 'rgba(82,217,139,0.08)', border: 'rgba(82,217,139,0.25)',
      icon: '📱', label: 'Mobile Camera Live', sub: 'Room monitoring active',
    },
    degraded: {
      color: '#4ECDC4', bg: 'rgba(78,205,196,0.08)', border: 'rgba(78,205,196,0.25)',
      icon: '⚠️', label: 'AI Monitoring Reduced', sub: 'Basic detection still active',
    },
    technical_issue: {
      color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)',
      icon: '🔵', label: 'Technical Issue', sub: 'Flagged for instructor review',
    },
  }

  const c = config[status]

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '7px 12px',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <span style={{ fontSize: 14 }}>{c.icon}</span>
      <div>
        <div style={{ color: c.color, fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
          {c.label}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>
          {c.sub}
        </div>
      </div>
      {(status === 'live' || status === 'paired') && (
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: status === 'live' ? '#52D98B' : '#F59E0B',
          animation: 'pulse 1.5s infinite',
          flexShrink: 0,
        }} />
      )}
    </div>
  )
}
