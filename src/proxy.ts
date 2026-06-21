import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function withSessionCookies(
  redirectResponse: NextResponse,
  supabaseResponse: NextResponse
): NextResponse {
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
  })
  return redirectResponse
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // ── /panel/* ───────────────────────────────────────────────
  if (pathname.startsWith('/panel') && pathname !== '/panel/login') {
    if (!user) {
      const redirectUrl = new URL('/panel/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return withSessionCookies(NextResponse.redirect(redirectUrl), supabaseResponse)
    }
  }

  if (pathname === '/panel/login' && user) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/panel'
    return withSessionCookies(
      NextResponse.redirect(new URL(redirectTo, request.url)),
      supabaseResponse
    )
  }

  // ── /tablet/* ──────────────────────────────────────────────
  if (pathname.startsWith('/tablet') && pathname !== '/tablet/login') {
    if (!user) {
      const redirectUrl = new URL('/tablet/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return withSessionCookies(NextResponse.redirect(redirectUrl), supabaseResponse)
    }
  }

  if (pathname === '/tablet/login' && user) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/tablet/pos'
    return withSessionCookies(
      NextResponse.redirect(new URL(redirectTo, request.url)),
      supabaseResponse
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/panel/:path*', '/tablet/:path*'],
}
