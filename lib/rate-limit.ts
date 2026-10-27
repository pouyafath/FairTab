// Best-effort in-memory rate limiter for the single-instance self-hosted app.
// State is per-process (not shared across Cloudflare isolates), which is fine:
// it exists to slow online brute-force of the access PIN, not to be a
// distributed quota. `now` is injected so the logic is deterministic to test.

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export interface RateLimiterOptions {
  maxAttempts?: number
  windowMs?: number
  lockoutMs?: number
}

interface Entry {
  count: number
  firstAt: number
  lockedUntil: number
}

const PRUNE_THRESHOLD = 10_000

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const maxAttempts = options.maxAttempts ?? 10
  const windowMs = options.windowMs ?? 15 * 60 * 1000
  const lockoutMs = options.lockoutMs ?? 15 * 60 * 1000
  const state = new Map<string, Entry>()

  function prune(now: number) {
    for (const [key, entry] of state) {
      if (entry.lockedUntil <= now && now - entry.firstAt > windowMs) {
        state.delete(key)
      }
    }
  }

  function check(key: string, now: number): RateLimitResult {
    const entry = state.get(key)
    if (entry && entry.lockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) }
    }
    return { allowed: true, retryAfterSeconds: 0 }
  }

  function recordFailure(key: string, now: number): void {
    if (state.size > PRUNE_THRESHOLD) prune(now)

    let entry = state.get(key)
    if (!entry || now - entry.firstAt > windowMs) {
      entry = { count: 0, firstAt: now, lockedUntil: 0 }
      state.set(key, entry)
    }
    entry.count += 1
    if (entry.count >= maxAttempts) {
      entry.lockedUntil = now + lockoutMs
    }
  }

  function reset(key: string): void {
    state.delete(key)
  }

  return { check, recordFailure, reset }
}
