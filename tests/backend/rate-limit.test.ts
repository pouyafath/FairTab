import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRateLimiter } from '@/lib/rate-limit'

describe('createRateLimiter', () => {
  it('allows attempts until the cap, then locks out', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 1000, lockoutMs: 5000 })
    const key = '1.2.3.4'

    assert.equal(limiter.check(key, 0).allowed, true)
    limiter.recordFailure(key, 0)
    limiter.recordFailure(key, 10)
    assert.equal(limiter.check(key, 20).allowed, true)

    // Third failure hits the cap and locks out.
    limiter.recordFailure(key, 20)
    const locked = limiter.check(key, 30)
    assert.equal(locked.allowed, false)
    assert.ok(locked.retryAfterSeconds > 0)
  })

  it('lets attempts through again after the lockout expires', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 1000, lockoutMs: 5000 })
    const key = 'ip'
    limiter.recordFailure(key, 0)
    limiter.recordFailure(key, 0)
    assert.equal(limiter.check(key, 100).allowed, false)
    assert.equal(limiter.check(key, 5001).allowed, true)
  })

  it('resets the counter on success', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 1000, lockoutMs: 5000 })
    const key = 'ip'
    limiter.recordFailure(key, 0)
    limiter.reset(key)
    limiter.recordFailure(key, 10)
    // Only one failure is counted post-reset, so still allowed.
    assert.equal(limiter.check(key, 20).allowed, true)
  })

  it('starts a fresh window once the old one lapses', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 1000, lockoutMs: 5000 })
    const key = 'ip'
    limiter.recordFailure(key, 0)
    // Past the window, so this counts as the first attempt of a new window.
    limiter.recordFailure(key, 2000)
    assert.equal(limiter.check(key, 2001).allowed, true)
  })

  it('keys are independent', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 1000, lockoutMs: 5000 })
    limiter.recordFailure('a', 0)
    assert.equal(limiter.check('a', 1).allowed, false)
    assert.equal(limiter.check('b', 1).allowed, true)
  })
})
