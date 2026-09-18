'use client'

import React, { useEffect, useRef, useState } from 'react'

type Status = 'not_linked' | 'paired' | 'reconnecting' | 'live' | 'degraded' | 'technical_issue'

interface MobileDeviceStatusProps {
  sessionId: string
  onStatusChange?: (status: Status) => void
  onViolation?: (isViolating: boolean, message: string, incidentType: string, severity: string) => void
  onSessionInvalid?: (message: string) => void
}

export default function MobileDeviceStatus({ sessionId, onStatusChange, onViolation, onSessionInvalid }: MobileDeviceStatusProps) {
  const [status, setStatus] = useState<Status>('not_linked')
  const [reconnectingSeconds, setReconnectingSeconds] = useState(0)
  const [setupCheck, setSetupCheck] = useState<{ state: 'idle' | 'checking' | 'passed' | 'failed'; message: string }>({
    state: 'idle',
    message: '',
  })
  const [monitoringStart, setMonitoringStart] = useState<'idle' | 'starting' | 'started' | 'failed'>('idle')

  // Shared state between closure and component
  const lastHeartbeatRef = useRef<number | null>(null)
  const subscribedAtRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pausedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const setupCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  const setupRequestIdRef = useRef<string | null>(null)
  const channelRef = useRef<any>(null)
  const restoredIncidentTypesRef = useRef<Set<string>>(new Set())
  const incidentPollingStoppedRef = useRef(false)
  const sessionInvalidatedRef = useRef(false)
  const startAfterSetupRef = useRef(false)
  const startMonitoringRef = useRef<(() => Promise<void>) | null>(null)

  const updateStatus = (s: Status) => {
    setStatus(s)
    onStatusChange?.(s)
  }

  useEffect(() => {
    setSetupCheck({ state: 'idle', message: '' })
    setMonitoringStart('idle')
    incidentPollingStoppedRef.current = false
    sessionInvalidatedRef.current = false
    let disposed = false
    let cleanup: (() => void) | undefined

    const run = async () => {
      const { createClientComponentClient } = await import('@/lib/supabase')
      if (disposed) return
      const supabase = createClientComponentClient()

      const invalidateSession = (message: string) => {
        if (disposed || sessionInvalidatedRef.current) return
        sessionInvalidatedRef.current = true
        incidentPollingStoppedRef.current = true
        updateStatus('not_linked')
        onSessionInvalid?.(message)
      }

      // Reconcile persisted incidents whenever Realtime first connects or
      // reconnects, so events raised during an outage still reach the UI.
      const restoreOpenIncidents = async () => {
        if (incidentPollingStoppedRef.current) return
        try {
          const res = await fetch(`/api/proctor-session/event?sessionId=${encodeURIComponent(sessionId)}`)
          if ([403, 404, 410].includes(res.status)) {
            invalidateSession('The previous mobile monitoring session expired. A new QR code has been generated.')
            return
          }
          if (res.status === 400) {
            incidentPollingStoppedRef.current = true
            updateStatus('technical_issue')
            return
          }
          if (!res.ok) return
          const data = await res.json()
          const openTypes = new Set<string>()
          for (const incident of data.incidents || []) {
            const incidentType = incident.event_type || 'mobile_violation'
            openTypes.add(incidentType)
            onViolation?.(
              true,
              incident.metadata?.description || 'Mobile camera violation detected',
              incidentType,
              incident.severity || 'soft',
            )
          }
          for (const incidentType of restoredIncidentTypesRef.current) {
            if (!openTypes.has(incidentType)) onViolation?.(false, '', incidentType, 'info')
          }
          restoredIncidentTypesRef.current = openTypes
        } catch (_) {}
      }

      const channel = supabase.channel(`proctor:${sessionId}`, { config: { private: true } })
      channelRef.current = channel
      let pairingPoller: NodeJS.Timeout | null = null

      const stopPairingPoller = () => {
        if (pairingPoller) {
          clearInterval(pairingPoller)
          pairingPoller = null
        }
      }

      channel
        .on('broadcast', { event: 'paired' }, () => {
          stopPairingPoller()
          updateStatus('paired')
        })
        .on('broadcast', { event: 'heartbeat' }, () => {
          stopPairingPoller()
          lastHeartbeatRef.current = Date.now()
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
            setReconnectingSeconds(0)
          }
          updateStatus('live')
          setMonitoringStart('started')
        })
        .on('broadcast', { event: 'tier2_unavailable' }, () => {
          updateStatus('degraded')
        })
        .on('broadcast', { event: 'error' }, () => {
          updateStatus('technical_issue')
        })
        .on('broadcast', { event: 'second_phone' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Secondary phone detected', 'second_phone', 'hard')
        })
        .on('broadcast', { event: 'second_monitor' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Secondary monitor detected', 'second_monitor', 'hard')
        })
        .on('broadcast', { event: 'suspicious_object' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Suspicious object detected', 'suspicious_object', 'hard')
        })
        .on('broadcast', { event: 'second_person' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Another person detected', 'second_person', 'hard')
        })
        .on('broadcast', { event: 'student_missing' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Student not visible or camera blocked', 'student_missing', 'hard')
        })
        .on('broadcast', { event: 'student_mismatch' }, (payload: any) => {
          const event = payload.payload || payload
          onViolation?.(true, event?.description || 'Visible student changed', 'student_mismatch', event?.severity || 'soft')
        })
        .on('broadcast', { event: 'distance_invalid' }, (payload: any) => {
          const event = payload.payload || payload
          onViolation?.(true, event?.description || 'Phone distance is outside the approved range', 'distance_invalid', event?.severity || 'soft')
        })
        .on('broadcast', { event: 'camera_moved' }, (payload: any) => {
          const event = payload.payload || payload
          onViolation?.(true, event?.description || 'Phone position changed', 'camera_moved', event?.severity || 'soft')
        })
        .on('broadcast', { event: 'camera_obstructed' }, (payload: any) => {
          const event = payload.payload || payload
          onViolation?.(true, event?.description || 'Mobile camera view is blocked', 'camera_obstructed', event?.severity || 'hard')
        })
        .on('broadcast', { event: 'notes_visible' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Notes or written material detected', 'notes_visible', 'hard')
        })
        .on('broadcast', { event: 'violation' }, (message: any) => {
          const payload = message.payload || message
          onViolation?.(true, payload?.description || 'Mobile camera violation detected', payload?.type || 'mobile_violation', payload?.severity || 'soft')
        })
        .on('broadcast', { event: 'resolved' }, (message: any) => {
          const payload = message.payload || message
          onViolation?.(false, '', payload?.resolvesType || '*', 'info')
        })
        .on('broadcast', { event: 'setup_check_result' }, (message: any) => {
          const payload = message.payload || message
          const requestedResult = Boolean(
            payload?.requestId && payload.requestId === setupRequestIdRef.current,
          )
          const phoneInitiatedResult = Boolean(
            !payload?.requestId && payload?.sessionId === sessionId,
          )
          if (!requestedResult && !phoneInitiatedResult) return
          if (requestedResult) {
            if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
            setupCheckTimerRef.current = null
            setupRequestIdRef.current = null
          }
          setSetupCheck({
            state: payload.passed ? 'passed' : 'failed',
            message: payload.message || (payload.passed ? 'Setup looks good.' : 'Setup check failed.'),
          })
          if (payload.passed && startAfterSetupRef.current) {
            startAfterSetupRef.current = false
            void startMonitoringRef.current?.()
          } else if (!payload.passed) {
            startAfterSetupRef.current = false
          }
        })
        .on('broadcast', { event: 'ended' }, () => {
          updateStatus('technical_issue')
          onViolation?.(true, 'Mobile monitoring session ended.', 'mobile_session_ended', 'technical')
        })
        .on('broadcast', { event: 'static_image_spoof' }, (payload: any) => {
          onViolation?.(true, payload.payload?.description || 'Static image spoofing detected', 'static_image_spoof', 'hard')
        })
        .on('broadcast', { event: 'clear' }, () => {
          onViolation?.(false, '', '*', 'info')
        })
        .on('broadcast', { event: 'paused' }, () => {
          if (pausedTimerRef.current) clearTimeout(pausedTimerRef.current)
          onViolation?.(true, 'Mobile app moved to background. Please return to the LMS app on your phone within 30s.', 'mobile_paused', 'technical')
          pausedTimerRef.current = setTimeout(() => {
            onViolation?.(true, 'Mobile app was closed or sent to background for too long.', 'mobile_paused', 'hard')
          }, 30000)
        })
        .on('broadcast', { event: 'resumed' }, () => {
          if (pausedTimerRef.current) {
            clearTimeout(pausedTimerRef.current)
            pausedTimerRef.current = null
          }
          onViolation?.(false, '', 'mobile_paused', 'info')
        })
        .subscribe((subscriptionStatus) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            subscribedAtRef.current = Date.now()
            void restoreOpenIncidents()
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(subscriptionStatus)) {
            updateStatus('reconnecting')
          }
        })

      // BUG 3 FIX: Poll session status on mount to catch 'paired' before first heartbeat
      const pollForPairing = async () => {
        try {
          const res = await fetch(`/api/proctor-session?sessionId=${encodeURIComponent(sessionId)}`)
          if ([403, 404, 410].includes(res.status)) {
            stopPairingPoller()
            invalidateSession('The previous mobile monitoring session expired. A new QR code has been generated.')
            return
          }
          if (!res.ok) return
          const data = await res.json()
          if (data.status === 'paired' || data.status === 'active') {
            stopPairingPoller()
            updateStatus('paired')
          }
        } catch (_) {}
      }
      void pollForPairing()
      pairingPoller = setInterval(() => void pollForPairing(), 2_000)

      // Heartbeat watchdog — check every 5 seconds
      const watchdog = setInterval(() => {
        if (lastHeartbeatRef.current === null) {
          const subscribedAt = subscribedAtRef.current
          if (subscribedAt) {
            const elapsed = Date.now() - subscribedAt
            if (elapsed >= 60_000) {
              updateStatus('technical_issue')
            } else if (elapsed > 15_000) {
              updateStatus('reconnecting')
              setReconnectingSeconds(Math.floor(elapsed / 1000))
            }
          }
          return
        }

        const elapsed = Date.now() - lastHeartbeatRef.current
        if (elapsed > 10_000 && elapsed < 60_000) {
          updateStatus('reconnecting')
          setReconnectingSeconds(Math.floor(elapsed / 1000))
        } else if (elapsed >= 60_000) {
          updateStatus('technical_issue')
        }
      }, 5_000)

      const incidentPoller = setInterval(() => {
        void restoreOpenIncidents()
      }, 5_000)

      cleanup = () => {
        clearInterval(watchdog)
        clearInterval(incidentPoller)
        stopPairingPoller()
        if (pausedTimerRef.current) clearTimeout(pausedTimerRef.current)
        if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
        channelRef.current = null
        supabase.removeChannel(channel)
      }
    }

    run()
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [sessionId, onSessionInvalid])

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

  const runSetupCheck = async (startWhenPassed = false) => {
    const channel = channelRef.current
    if (!channel || !['paired', 'live'].includes(status)) {
      setSetupCheck({ state: 'failed', message: 'Link the phone and open its setup screen first.' })
      return
    }

    const requestId = crypto.randomUUID()
    startAfterSetupRef.current = startWhenPassed
    setupRequestIdRef.current = requestId
    setMonitoringStart('idle')
    setSetupCheck({ state: 'checking', message: 'Waiting for the phone camera analysis…' })

    if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
    setupCheckTimerRef.current = setTimeout(() => {
      if (setupRequestIdRef.current !== requestId) return
      setupRequestIdRef.current = null
      startAfterSetupRef.current = false
      setSetupCheck({
        state: 'failed',
        message: 'No response from the phone. Keep the LMS Mobile setup screen open and try again.',
      })
    }, 15_000)

    const response = await channel.send({
      type: 'broadcast',
      event: 'setup_check_request',
      payload: { requestId, timestamp: new Date().toISOString() },
    })
    if (response !== 'ok') {
      if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
      setupRequestIdRef.current = null
      startAfterSetupRef.current = false
      setSetupCheck({ state: 'failed', message: 'Could not send the setup request to the phone.' })
    }
  }

  const startMonitoring = async () => {
    const channel = channelRef.current
    if (!channel) return

    setMonitoringStart('starting')
    try {
      const response = await fetch('/api/proctor-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', sessionId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'The monitoring session could not be started.')
      }

      const realtimeResponse = await channel.send({
        type: 'broadcast',
        event: 'start_monitoring_request',
        payload: { sessionId, timestamp: new Date().toISOString() },
      })
      if (realtimeResponse !== 'ok') {
        throw new Error('The start request did not reach the phone.')
      }
    } catch (error) {
      setMonitoringStart('failed')
      setSetupCheck({
        state: 'failed',
        message: error instanceof Error ? error.message : 'Could not start monitoring.',
      })
    }
  }
  startMonitoringRef.current = startMonitoring

  const handleStartMonitoring = () => {
    if (setupCheck.state === 'passed') {
      void startMonitoring()
      return
    }
    void runSetupCheck(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: '"Montserrat", system-ui, sans-serif' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: '7px 12px',
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

      <button
        type="button"
        onClick={() => void runSetupCheck(false)}
        disabled={setupCheck.state === 'checking' || !['paired', 'live'].includes(status)}
        style={{
          width: '100%', border: 'none', borderRadius: 9, padding: '9px 12px',
          background: setupCheck.state === 'passed' ? '#16a34a' : '#2563eb', color: '#fff',
          fontSize: 12, fontWeight: 800, cursor: setupCheck.state === 'checking' ? 'wait' : 'pointer',
          opacity: !['paired', 'live'].includes(status) ? 0.45 : 1,
        }}
      >
        {setupCheck.state === 'checking' ? 'Checking Phone Setup…' : setupCheck.state === 'passed' ? '✓ Setup Passed — Check Again' : '📷 Check Setup'}
      </button>

      {['paired', 'live'].includes(status) && (
        <button
          type="button"
          onClick={handleStartMonitoring}
          disabled={setupCheck.state === 'checking' || monitoringStart === 'starting' || monitoringStart === 'started'}
          style={{
            width: '100%', border: 'none', borderRadius: 9, padding: '10px 12px',
            background: monitoringStart === 'started' ? '#16a34a' : '#0f766e', color: '#fff',
            fontSize: 12, fontWeight: 800,
            cursor: setupCheck.state === 'checking' || monitoringStart === 'starting' ? 'wait' : 'pointer',
            opacity: setupCheck.state === 'checking' || monitoringStart === 'starting' ? 0.75 : 1,
          }}
        >
          {monitoringStart === 'starting'
              ? 'Starting Monitoring…'
            : monitoringStart === 'started'
              ? '✓ Monitoring Active'
              : setupCheck.state === 'passed'
                ? '▶ Start Monitoring'
                : '▶ Verify Setup & Start Monitoring'}
        </button>
      )}

      {setupCheck.message && (
        <div
          role="status"
          aria-live="polite"
          style={{
            borderRadius: 8, padding: '8px 10px', fontSize: 11, lineHeight: 1.4,
            color: setupCheck.state === 'passed' ? '#166534' : setupCheck.state === 'failed' ? '#991b1b' : '#1e40af',
            background: setupCheck.state === 'passed' ? '#dcfce7' : setupCheck.state === 'failed' ? '#fee2e2' : '#dbeafe',
          }}
        >
          {setupCheck.message}
        </div>
      )}
    </div>
  )
}
