'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import { ShieldAlert } from 'lucide-react'

function parseSessionId(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return (json.session_id as string) ?? (json.sub as string) ?? null
  } catch {
    return null
  }
}

export default function SessionGuard() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const isKickingOutRef = useRef(false)

  useEffect(() => {
    let heartbeatTimer: NodeJS.Timeout | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function initGuard() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      // Single active session enforcement is exclusively for students (never kick out employers or admins)
      const userRole = session.user?.user_metadata?.role ?? session.user?.app_metadata?.role
      const userEmail = session.user?.email?.toLowerCase() ?? ''
      if (
        userRole === 'employer' ||
        userRole === 'superadmin' ||
        userEmail.startsWith('admin') ||
        userEmail.startsWith('superadmin') ||
        userEmail.endsWith('@teamcollaboro.com')
      ) {
        return
      }

      const mySessionId = parseSessionId(session.access_token)
      if (!mySessionId) return

      async function kickOut(reason: string) {
        if (isKickingOutRef.current) return
        isKickingOutRef.current = true

        setWarningMessage('Your account was logged in from another device or location. Only one active student session is allowed.')

        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // ignore error
        }

        setTimeout(() => {
          router.push(`/login?reason=${encodeURIComponent(reason)}`)
          router.refresh()
        }, 2200)
      }

      // 1. Supabase Realtime subscription for immediate push notification
      try {
        channel = supabase
          .channel(`guard:${session.user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'active_sessions',
              filter: `user_id=eq.${session.user.id}`,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (payload: any) => {
              const updated = payload.new
              if (
                updated &&
                updated.platform === 'web' &&
                updated.session_id &&
                updated.session_id !== mySessionId
              ) {
                kickOut('signed_in_elsewhere')
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.warn('[SessionGuard] Realtime subscribe error:', err)
      }

      // 2. Periodic heartbeat (every 60s) to update last_seen, track IP/location, and verify session validity
      async function sendHeartbeat() {
        if (isKickingOutRef.current) return
        try {
          const res = await fetch('/api/session/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'web', sessionId: mySessionId }),
          })

          if (res.status === 409) {
            const data = await res.json().catch(() => ({}))
            if (data.reason === 'superseded') {
              kickOut('signed_in_elsewhere')
            }
          }
        } catch {
          // Network hiccup — keep running
        }
      }

      // Initial heartbeat + 60s recurring
      sendHeartbeat()
      heartbeatTimer = setInterval(sendHeartbeat, 60000)
    }

    initGuard()

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [router, supabase])

  if (!warningMessage) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: 32,
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #fecaca',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#fef2f2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <ShieldAlert size={32} />
        </div>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#1a1a1a',
            margin: '0 0 8px 0',
          }}
        >
          Session Ended
        </h3>
        <p
          style={{
            fontSize: 14,
            color: '#4b5563',
            lineHeight: 1.5,
            margin: '0 0 20px 0',
          }}
        >
          {warningMessage}
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: '#9ca3af',
          }}
        >
          Redirecting to sign in page…
        </div>
      </div>
    </div>
  )
}
