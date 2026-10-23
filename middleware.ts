import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Public paths — no auth required
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/verify') ||
    pathname.startsWith('/api/webhook') ||
    pathname.startsWith('/api/proctor-session') ||
    pathname.startsWith('/api/session') ||
    pathname.startsWith('/api/dev-config') ||
    pathname.startsWith('/api/proctor-analyze') ||
    pathname.startsWith('/api/inngest') ||
    pathname.startsWith('/downloads/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/employers') ||
    pathname.startsWith('/api/employers/public') ||
    pathname.startsWith('/superadmin/login') ||
    pathname.startsWith('/api/superadmin')

  if (isPublic) {
    return supabaseResponse
  }

  // Refresh session & authenticate user with Supabase server
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    if (pathname.startsWith('/superadmin')) {
      loginUrl.searchParams.set('role', 'admin')
    }
    return NextResponse.redirect(loginUrl)
  }

  // Single active session enforcement: applies to students only
  const role = user.user_metadata?.role ?? user.app_metadata?.role
  const isStudent = role !== 'employer' && role !== 'superadmin' && !user.email?.toLowerCase().startsWith('superadmin') && !user.email?.toLowerCase().startsWith('admin')

  if (isStudent) {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    let sessionId: string | null = null

    if (accessToken) {
      try {
        const tokenPart = accessToken.split('.')[1]
        if (tokenPart) {
          const payload = JSON.parse(Buffer.from(tokenPart, 'base64').toString('utf-8'))
          sessionId = (payload.session_id as string) ?? (payload.sub as string) ?? null
        }
      } catch {
        // ignore decode error
      }
    }

    if (sessionId) {
      try {
        const { data: activeRow, error: sessionErr } = await supabase
          .from('active_sessions')
          .select('session_id')
          .eq('user_id', user.id)
          .eq('platform', 'web')
          .maybeSingle()

        if (!sessionErr && activeRow) {
          if (activeRow.session_id !== sessionId) {
            // A newer web login occurred elsewhere. Invalidate this session!
            const loginUrl = request.nextUrl.clone()
            loginUrl.pathname = '/login'
            loginUrl.searchParams.set('reason', 'signed_in_elsewhere')
            const redirectResponse = NextResponse.redirect(loginUrl)
            // Clear session cookies on redirect
            request.cookies.getAll().forEach(c => {
              if (c.name.includes('supabase') || c.name.includes('sb-')) {
                redirectResponse.cookies.delete(c.name)
              }
            })
            return redirectResponse
          }
        } else if (!sessionErr && !activeRow) {
          // Rollout migration: Register existing active session automatically
          const forwarded = request.headers.get('x-forwarded-for')
          const ip = (forwarded ? forwarded.split(',')[0].trim() : null) ?? request.headers.get('x-real-ip') ?? '127.0.0.1'
          const country = request.headers.get('x-vercel-ip-country') ?? null
          const city = request.headers.get('x-vercel-ip-city') ?? null
          const userAgent = request.headers.get('user-agent') ?? 'unknown'

          await supabase.from('active_sessions').insert({
            user_id: user.id,
            platform: 'web',
            session_id: sessionId,
            current_ip: ip,
            current_country: country,
            current_city: city,
            user_agent: userAgent,
          })
        }
      } catch {
        // If table is not migrated yet or network transient error, fail open to avoid student lockout
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
