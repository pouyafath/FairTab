import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_COOKIE, verifyAccessCookie } from '@/lib/access'

// Site-wide access gate (Next.js proxy convention, formerly middleware).
// Paths that must stay reachable while locked: the unlock flow itself,
// the health probe (Docker/uptime monitors), and PWA bootstrap assets.
const PUBLIC_PATHS = ['/unlock', '/api/unlock', '/api/health', '/manifest.json', '/sw.js']

export async function proxy(req: NextRequest) {
  const pin = process.env.APP_ACCESS_PIN
  if (!pin) return NextResponse.next() // gate disabled — default behavior

  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/icons/')) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(ACCESS_COOKIE)?.value
  if (cookie && (await verifyAccessCookie(cookie, pin))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 })
  }

  const unlockUrl = req.nextUrl.clone()
  unlockUrl.pathname = '/unlock'
  unlockUrl.search = ''
  if (pathname !== '/') {
    unlockUrl.searchParams.set('next', pathname + req.nextUrl.search)
  }
  return NextResponse.redirect(unlockUrl)
}

export const config = {
  // Skip Next.js internals and the favicon; everything else goes through the gate
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
