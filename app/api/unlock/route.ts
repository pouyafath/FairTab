export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_COOKIE, computeAccessToken, timingSafeEqual } from '@/lib/access'
import { createRateLimiter } from '@/lib/rate-limit'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// Slows online brute-force of the PIN: 10 wrong tries per IP within 15 minutes
// then a 15-minute lockout. Module-global so it persists across requests.
const limiter = createRateLimiter()

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const pin = process.env.APP_ACCESS_PIN
  if (!pin) {
    return NextResponse.json({ error: 'Access gate is not enabled' }, { status: 404 })
  }

  const key = clientKey(req)
  const now = Date.now()
  const gate = limiter.check(key, now)
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSeconds) } }
    )
  }

  let body: { pin?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (typeof body.pin !== 'string' || !(await timingSafeEqual(body.pin, pin))) {
    limiter.recordFailure(key, now)
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })
  }

  limiter.reset(key)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ACCESS_COOKIE, await computeAccessToken(pin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
