'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuperAdminLoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login?role=admin')
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#080d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Montserrat, sans-serif' }}>
      Redirecting to unified sign in…
    </div>
  )
}
