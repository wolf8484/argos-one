import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEVICE_COOKIE = 'argos_device'
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5

/**
 * Mint the device identity on the way past, before anything needs it.
 *
 * It has to happen here rather than in a route handler because the pairing
 * screen runs signed out -- the tablet has to be identifiable before any human
 * authenticates on it, which is the only way a brand-new branch with no staff
 * accounts yet can have its hardware set up at all. httpOnly so no script can
 * read or forge it; Postgres only ever sees a hash of it (see lib/server/device).
 */
function mintDeviceToken(request: NextRequest) {
  if (request.cookies.get(DEVICE_COOKIE)?.value) return null
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  // So the rest of THIS request already sees the device it is about to be given.
  request.cookies.set(DEVICE_COOKIE, token)
  return token
}

// Stamped onto whichever response actually leaves, because there are three of
// them: the pass-through, a rebuilt one if Supabase refreshed the session, and
// either redirect. Setting it once up front would be silently dropped by the
// NextResponse.next() inside setAll.
function withDeviceCookie(response: NextResponse, token: string | null) {
  if (token) {
    response.cookies.set(DEVICE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: DEVICE_COOKIE_MAX_AGE,
    })
  }
  return response
}

export async function proxy(request: NextRequest) {
  const deviceToken = mintDeviceToken(request)
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return withDeviceCookie(response, deviceToken)

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const authRequired = process.env.REQUIRE_AUTH === 'true' || process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true'
  if (authRequired && request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return withDeviceCookie(NextResponse.redirect(loginUrl), deviceToken)
  }
  if (user && request.nextUrl.pathname === '/login') {
    return withDeviceCookie(NextResponse.redirect(new URL('/dashboard', request.url)), deviceToken)
  }
  return withDeviceCookie(response, deviceToken)
}

export const config = { matcher: ['/dashboard/:path*', '/login'] }
