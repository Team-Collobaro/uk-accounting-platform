'use client'

import React, { useEffect, useRef, useState } from 'react'

type Status = 'not_linked' | 'paired' | 'reconnecting' | 'live' | 'degraded' | 'technical_issue'

interface MobileDeviceStatusProps {
  sessionId: string
  onStatusChange?: (status: Status) => void
  onViolation?: (isViolating: boolean, message: string, incidentType: string, severity: string) => void
  onSessionInvalid?: (message: string) => void
  onMonitoringStarted?: () => void
}

export default function MobileDeviceStatus({ sessionId, onStatusChange, onViolation, onSessionInvalid, onMonitoringStarted }: MobileDeviceStatusProps) {
  const [status, setStatus] = useState<Status>('not_linked')
  const [reconnectingSeconds, setReconnectingSeconds] = useState(0)
  const [setupCheck, setSetupCheck] = useState<{ state: 'idle' | 'checking' | 'passed' | 'failed'; message: string }>({
    state: 'idle',
    message: '',
  })
  const [monitoringStart, setMonitoringStart] = useState<'idle' | 'starting' | 'started' | 'failed'>('idle')
  const [mobilePreview, setMobilePreview] = useState<string | null>(null)
  const [mobilePreviewUpdatedAt, setMobilePreviewUpdatedAt] = useState<number | null>(null)
  const [mobilePreviewMessage, setMobilePreviewMessage] = useState('Waiting for the phone to start setup preview…')
  const [phoneSetupReady, setPhoneSetupReady] = useState(false)

  const [setupTrace, setSetupTrace] = useState<{ requestId: string; stage: string; webMs: number; phoneMs?: number }[]>([])
  const [setupElapsed, setSetupElapsed] = useState(0)
  const setupStartedRef = useRef<number | null>(null)
  const traceSetup = (stage: string, requestId: string, phoneMs?: number) => {
    const webMs = setupStartedRef.current === null ? 0 : Math.round(performance.now() - setupStartedRef.current)
    console.info('[SetupTiming]', { requestId, sessionId, stage, webMs, phoneMs })
    setSetupTrace(rows => [...rows, { requestId, stage, webMs, phoneMs }])
  }
  useEffect(() => {
    if (setupCheck.state !== 'checking') return
    const timer = setInterval(() => {
      if (setupStartedRef.current !== null) setSetupElapsed(Math.round((performance.now() - setupStartedRef.current) / 1000))
    }, 250)
    return () => clearInterval(timer)
  }, [setupCheck.state])

  // Shared state between closure and component
  const lastHeartbeatRef = useRef<number | null>(null)
  const monitoringRequestedAtRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pausedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const setupCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  const setupRequestIdRef = useRef<string | null>(null)
  const setupRequestRetryRef = useRef<NodeJS.Timeout | null>(null)
  const lastSetupReadyAtRef = useRef<number | null>(null)
  const channelRef = useRef<any>(null)
  const restoredIncidentTypesRef = useRef<Set<string>>(new Set())
  const incidentPollingStoppedRef = useRef(false)
  const sessionInvalidatedRef = useRef(false)
  const startAfterSetupRef = useRef(false)
  const startMonitoringRef = useRef<(() => Promise<void>) | null>(null)
  const previewControlEnabledRef = useRef(true)
  const realtimeStatusRef = useRef<'connecting' | 'subscribed' | 'error' | 'closed'>('connecting')
  const lastPhoneSetupStatusRef = useRef<{ state: string; message: string } | null>(null)
  const setupStageRef = useRef<{ requestId: string; stage: string; message: string } | null>(null)

  const updateStatus = (s: Status) => {
    setStatus(s)
    onStatusChange?.(s)
  }

  useEffect(() => {
    setSetupCheck({ state: 'idle', message: '' })
    setSetupTrace([])
    setSetupElapsed(0)
    setupStartedRef.current = null
    setMonitoringStart('idle')
    setMobilePreview(null)
    setMobilePreviewUpdatedAt(null)
    setMobilePreviewMessage('Waiting for the phone to start setup preview…')
    previewControlEnabledRef.current = true
    incidentPollingStoppedRef.current = false
    sessionInvalidatedRef.current = false
    lastHeartbeatRef.current = null
    monitoringRequestedAtRef.current = null
    realtimeStatusRef.current = 'connecting'
    lastPhoneSetupStatusRef.current = null
    setupStageRef.current = null
    lastSetupReadyAtRef.current = null
    setPhoneSetupReady(false)
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
          // Incident history is supplementary. The authoritative session poll
          // below owns invalidation so an event-store or query failure cannot
          // replace a session that is still paired to the phone.
          if ([400, 403, 404, 410].includes(res.status)) {
            incidentPollingStoppedRef.current = true
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
        .on('broadcast', { event: 'monitoring_starting' }, () => {
          stopPairingPoller()
          setMonitoringStart('starting')
          setMobilePreview(null)
          setMobilePreviewUpdatedAt(null)
          onMonitoringStarted?.()
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
          onMonitoringStarted?.()
          setMonitoringStart('started')
        })
        .on('broadcast', { event: 'tier2_unavailable' }, () => {
          updateStatus('degraded')
        })
        .on('broadcast', { event: 'error' }, () => {
          if (monitoringRequestedAtRef.current || lastHeartbeatRef.current) {
            updateStatus('technical_issue')
          } else {
            setMobilePreviewMessage('The phone reported a setup camera problem. Keep the setup screen open and retry the preview.')
          }
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
          const event = payload.payload || payload
          onViolation?.(true, event?.description || 'Notes or written material detected', 'notes_visible', 'hard')
        })
        .on('broadcast', { event: 'static_image_spoof' }, (payload: any) => {
          const event = payload.payload || payload
          onViolation?.(true, event?.description || 'Static image detected. Liveness check failed.', 'static_image_spoof', 'hard')
        })
        .on('broadcast', { event: 'student_returned' }, () => {
          onViolation?.(false, '', 'student_missing', 'info')
        })
        .on('broadcast', { event: 'second_person_cleared' }, () => {
          onViolation?.(false, '', 'second_person', 'info')
        })
        .on('broadcast', { event: 'clear' }, () => {
          onViolation?.(false, '', '*', 'info')
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
            traceSetup('result_received', payload.requestId, typeof payload.durationMs === 'number' ? payload.durationMs : undefined)
            setupRequestIdRef.current = null
            setupStageRef.current = null
            if (setupRequestRetryRef.current) clearInterval(setupRequestRetryRef.current)
            setupRequestRetryRef.current = null
          }
          setSetupCheck({
            state: payload.passed ? 'passed' : 'failed',
            message: payload.message || (payload.passed ? 'Setup looks good.' : 'Setup check failed.'),
          })
          if (payload.passed && lastHeartbeatRef.current === null) updateStatus('paired')
          if (payload.passed && startAfterSetupRef.current) {
            startAfterSetupRef.current = false
            void startMonitoringRef.current?.()
          } else if (!payload.passed) {
            startAfterSetupRef.current = false
          }
        })
        .on('broadcast', { event: 'setup_ready' }, (message: any) => {
          const payload = message.payload || message
          if (payload?.sessionId !== sessionId || payload?.protocolVersion !== 2) return
          lastSetupReadyAtRef.current = Date.now()
          setPhoneSetupReady(true)
          if (!monitoringRequestedAtRef.current && lastHeartbeatRef.current === null) {
            updateStatus('paired')
          }
          if (payload.cameraReady === false) {
            setMobilePreviewMessage('Phone connected. Waiting for its camera to become ready…')
          }
        })
        .on('broadcast', { event: 'setup_check_status' }, (message: any) => {
          const payload = message.payload || message
          if (
            payload?.sessionId !== sessionId ||
            payload?.requestId !== setupRequestIdRef.current ||
            typeof payload?.stage !== 'string'
          ) return
          const setupStatus = {
            requestId: payload.requestId,
            stage: payload.stage,
            message: typeof payload.message === 'string' ? payload.message : 'Phone setup is processing.',
          }
          traceSetup(payload.stage, payload.requestId, typeof payload.elapsedMs === 'number' ? payload.elapsedMs : undefined)
          setupStageRef.current = setupStatus
          if (setupRequestRetryRef.current) clearInterval(setupRequestRetryRef.current)
          setupRequestRetryRef.current = null
          setSetupCheck({ state: 'checking', message: setupStatus.message })
        })
        .on('broadcast', { event: 'preview_frame' }, (message: any) => {
          const payload = message.payload || message
          if (payload?.sessionId !== sessionId || payload?.mimeType !== 'image/jpeg') return
          if (typeof payload?.data !== 'string' || payload.data.length > 140_000) return
          setMobilePreview(`data:image/jpeg;base64,${payload.data}`)
          setMobilePreviewUpdatedAt(Date.now())
          setMobilePreviewMessage('Low-rate mobile setup preview connected.')
        })
        .on('broadcast', { event: 'preview_status' }, (message: any) => {
          const payload = message.payload || message
          if (payload?.sessionId !== sessionId || typeof payload?.message !== 'string') return
          lastPhoneSetupStatusRef.current = {
            state: typeof payload.state === 'string' ? payload.state : 'unknown',
            message: payload.message,
          }
          setMobilePreviewMessage(payload.message)
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
            realtimeStatusRef.current = 'subscribed'
            setMobilePreviewMessage('Secure phone channel connected. Requesting camera preview…')
            void channel.send({
              type: 'broadcast',
              event: 'preview_start',
              payload: { sessionId, timestamp: new Date().toISOString() },
            })
            void restoreOpenIncidents()
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(subscriptionStatus)) {
            realtimeStatusRef.current = subscriptionStatus === 'CLOSED' ? 'closed' : 'error'
            setMobilePreviewMessage('The secure phone channel disconnected. Reconnecting…')
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
        const readyAt = lastSetupReadyAtRef.current
        if (readyAt && Date.now() - readyAt > 10_000) setPhoneSetupReady(false)
        if (lastHeartbeatRef.current === null) {
          // Placement/setup can legitimately take several minutes and the
          // phone does not emit monitoring heartbeats until the website starts
          // the session. Only begin heartbeat enforcement after that handoff.
          const monitoringRequestedAt = monitoringRequestedAtRef.current
          if (monitoringRequestedAt) {
            const elapsed = Date.now() - monitoringRequestedAt
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

      // Preview requests are idempotent. Repeating the small control message
      // allows the phone to join after the browser observed database pairing.
      const previewRequester = setInterval(() => {
        if (!previewControlEnabledRef.current) return
        void channel.send({
          type: 'broadcast',
          event: 'preview_start',
          payload: { sessionId, timestamp: new Date().toISOString() },
        })
      }, 5_000)

      cleanup = () => {
        previewControlEnabledRef.current = false
        clearInterval(watchdog)
        clearInterval(incidentPoller)
        clearInterval(previewRequester)
        void channel.send({
          type: 'broadcast',
          event: 'preview_stop',
          payload: { sessionId, timestamp: new Date().toISOString() },
        })
        stopPairingPoller()
        if (pausedTimerRef.current) clearTimeout(pausedTimerRef.current)
        if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
        if (setupRequestRetryRef.current) clearInterval(setupRequestRetryRef.current)
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
    if (realtimeStatusRef.current !== 'subscribed') {
      setSetupCheck({
        state: 'failed',
        message: 'The secure phone channel is reconnecting. Check both devices\' internet connection and try again.',
      })
      return
    }
    if (!phoneSetupReady || !lastSetupReadyAtRef.current || Date.now() - lastSetupReadyAtRef.current > 10_000) {
      setSetupCheck({
        state: 'failed',
        message: `The phone setup screen is not ready for session …${sessionId.slice(-4)}. Keep that screen open until it shows connected.`,
      })
      return
    }
    if (setupRequestIdRef.current) {
      setSetupCheck({ state: 'checking', message: 'A phone camera check is already in progress…' })
      return
    }

    const requestId = crypto.randomUUID()
    setupStartedRef.current = performance.now()
    setSetupTrace([])
    setSetupElapsed(0)
    traceSetup('request_sent', requestId)
    startAfterSetupRef.current = startWhenPassed
    setupRequestIdRef.current = requestId
    setupStageRef.current = null
    setMonitoringStart('idle')
    setSetupCheck({ state: 'checking', message: 'Waiting for the phone camera analysis…' })

    if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
    setupCheckTimerRef.current = setTimeout(() => {
      if (setupRequestIdRef.current !== requestId) return
      setupRequestIdRef.current = null
      if (setupRequestRetryRef.current) clearInterval(setupRequestRetryRef.current)
      setupRequestRetryRef.current = null
      startAfterSetupRef.current = false
      traceSetup('timeout', requestId)
      const phoneStatus = lastPhoneSetupStatusRef.current
      const setupStage = setupStageRef.current
      const message = realtimeStatusRef.current !== 'subscribed'
        ? 'The secure phone channel disconnected during the setup check. Reconnect the phone and try again.'
        : !setupStage
          ? 'No setup acknowledgement returned within 30 seconds. The command or its reply may not have arrived; an updating preview does not confirm setup-command delivery.'
          : setupStage.stage === 'app_background'
            ? 'The LMS mobile app was backgrounded during the check. Return to the setup screen, keep the phone unlocked, and try again.'
            : setupStage.stage === 'capturing'
              ? 'The phone camera could not finish capturing a frame. Check camera permission, close other camera apps, and try again.'
              : setupStage.stage === 'analyzing'
                ? 'The phone received and captured the frame, but on-device analysis did not finish. Keep the phone still, close other apps, and retry.'
                : setupStage.stage === 'syncing'
                  ? 'The phone completed camera analysis, but the result did not synchronize back to the website. Check both internet connections and retry.'
                  : setupStage.stage === 'received' || setupStage.stage === 'resumed'
                    ? 'The phone received the request but did not start camera capture. Keep the setup screen open and restart the mobile setup screen if this repeats.'
        : phoneStatus?.state === 'error'
          ? `The phone reported a camera problem: ${phoneStatus.message}`
          : 'The phone setup check did not complete. Keep the setup screen open and try again.'
      setSetupCheck({
        state: 'failed',
        message,
      })
    }, 30_000)

    const sendRequest = async () => channel.send({
        type: 'broadcast',
        event: 'setup_check_request',
        payload: { requestId, sessionId, timestamp: new Date().toISOString() },
      })
    setupRequestRetryRef.current = setInterval(() => {
      if (setupRequestIdRef.current === requestId && !setupStageRef.current) void sendRequest()
    }, 2_000)

    try {
      const response = await sendRequest()
      if (response === 'ok') return

      if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
      setupCheckTimerRef.current = null
      setupRequestIdRef.current = null
      if (setupRequestRetryRef.current) clearInterval(setupRequestRetryRef.current)
      setupRequestRetryRef.current = null
      setupStageRef.current = null
      startAfterSetupRef.current = false
      setSetupCheck({
        state: 'failed',
        message: response === 'timed out'
          ? 'Supabase timed out while sending the setup request. Check both devices\' internet connection and try again.'
          : 'Supabase rejected the setup request. Reopen the phone setup screen and try again.',
      })
    } catch (error) {
      if (setupCheckTimerRef.current) clearTimeout(setupCheckTimerRef.current)
      setupCheckTimerRef.current = null
      setupRequestIdRef.current = null
      if (setupRequestRetryRef.current) clearInterval(setupRequestRetryRef.current)
      setupRequestRetryRef.current = null
      setupStageRef.current = null
      startAfterSetupRef.current = false
      setSetupCheck({
        state: 'failed',
        message: error instanceof Error
          ? `Could not contact the phone: ${error.message}`
          : 'Could not contact the phone because the secure channel failed.',
      })
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
      previewControlEnabledRef.current = false
      await channel.send({
        type: 'broadcast',
        event: 'preview_stop',
        payload: { sessionId, timestamp: new Date().toISOString() },
      })
      setMobilePreview(null)
      setMobilePreviewUpdatedAt(null)
      monitoringRequestedAtRef.current = Date.now()
      // Notify parent that monitoring has been successfully started so the
      // quiz gate opens immediately, before the first heartbeat arrives.
      onMonitoringStarted?.()

      // Retry sending start_monitoring_request every 2 seconds until first heartbeat arrives
      let startRetryCount = 0
      const startInterval = setInterval(() => {
        startRetryCount++
        if (lastHeartbeatRef.current || startRetryCount > 5 || !channelRef.current) {
          clearInterval(startInterval)
          if (!lastHeartbeatRef.current && startRetryCount > 5) {
            setMonitoringStart('idle')
          }
          return
        }
        void channelRef.current.send({
          type: 'broadcast',
          event: 'start_monitoring_request',
          payload: { sessionId, timestamp: new Date().toISOString() },
        })
      }, 2000)
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

      {['paired', 'reconnecting', 'technical_issue'].includes(status) && (
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden',
          borderRadius: 10, border: '1px solid rgba(15,118,110,0.35)', background: '#07131b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {mobilePreview ? (
            <img
              src={mobilePreview}
              alt="Live setup view from the linked mobile camera"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 16 }}>
              {mobilePreviewMessage}
            </div>
          )}
          <div style={{
            position: 'absolute', left: 8, bottom: 7, borderRadius: 999, padding: '3px 7px',
            background: 'rgba(2,6,23,0.78)', color: '#5eead4', fontSize: 9, fontWeight: 800,
          }}>
            MOBILE SETUP PREVIEW{mobilePreviewUpdatedAt ? ' · LOW RATE' : ''}
          </div>
        </div>
      )}

      {status === 'paired' && (
        <div style={{ color: '#5eead4', fontSize: 11, textAlign: 'center' }}>
          Mobile device connected · Starting monitoring…
        </div>
      )}

      {status === 'live' ? (
        <div style={{
          width: '100%', borderRadius: 9, padding: '10px 12px',
          background: '#16a34a', color: '#fff', textAlign: 'center',
          fontSize: 12, fontWeight: 800,
        }}>
          ✓ Monitoring Active
        </div>
      ) : status === 'paired' ? (
        <button
          type="button"
          onClick={handleStartMonitoring}
          disabled={monitoringStart === 'starting'}
          style={{
            width: '100%', border: 'none', borderRadius: 9, padding: '10px 12px',
            background: '#0f766e', color: '#fff',
            fontSize: 12, fontWeight: 800,
            cursor: monitoringStart === 'starting' ? 'wait' : 'pointer',
            opacity: monitoringStart === 'starting' ? 0.75 : 1,
          }}
        >
          {monitoringStart === 'starting'
            ? 'Starting Monitoring… (Click to re-send)'
            : '▶ Start Monitoring'}
        </button>
      ) : null}

      {setupTrace.length > 0 && (
        <details style={{ borderRadius: 8, padding: '8px 10px', background: '#f1f5f9', color: '#0f172a', fontSize: 11 }} open={setupCheck.state === 'checking'}>
          <summary>Setup progress{setupCheck.state === 'checking' ? ` · ${setupElapsed}s elapsed` : ''}</summary>
          <div style={{ marginTop: 6, overflowWrap: 'anywhere' }}>Request: {setupTrace[0]?.requestId}</div>
          {setupTrace.map((row, index) => <div key={index} style={{ marginTop: 4 }}>
            {row.stage.replace(/_/g, ' ')} · web +{(row.webMs / 1000).toFixed(1)}s
            {row.phoneMs !== undefined && ` · phone +${(row.phoneMs / 1000).toFixed(1)}s`}
          </div>)}
        </details>
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
