export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_COOKIE, computeAccessToken, timingSafeEqual } from '@/lib/access'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function POST(req: NextRequest) {
  const pin = process.env.APP_ACCESS_PIN
  if (!pin) {
    return NextResponse.json({ error: 'Access gate is not enabled' }, { status: 404 })
  }

  let body: { pin?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (typeof body.pin !== 'string' || !(await timingSafeEqual(body.pin, pin))) {
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })
  }

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
