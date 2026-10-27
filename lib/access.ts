// Shared-PIN access gate helpers. Edge-safe: Web Crypto only, no Node imports,
// because middleware.ts runs on the Edge runtime.

export const ACCESS_COOKIE = 'fairtab_access'

const TOKEN_CONTEXT = 'fairtab-access-v1'

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * The cookie value proving the holder knew the PIN. Deterministic per PIN, so
 * changing APP_ACCESS_PIN invalidates every existing session — no server-side
 * session store needed.
 */
export function computeAccessToken(pin: string): Promise<string> {
  return hmacHex(pin, TOKEN_CONTEXT)
}

/**
 * Compares two strings without leaking position-of-first-difference timing.
 * Both inputs are HMAC'd with the same ephemeral key first (double-HMAC
 * pattern), so the final comparison runs on digests an attacker cannot
 * predict.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const key = crypto.getRandomValues(new Uint8Array(32)).join(',')
  const [da, db] = await Promise.all([hmacHex(key, a), hmacHex(key, b)])
  return da === db
}

export async function verifyAccessCookie(cookieValue: string, pin: string): Promise<boolean> {
  const expected = await computeAccessToken(pin)
  return timingSafeEqual(cookieValue, expected)
}
