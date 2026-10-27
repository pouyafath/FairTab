import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeAccessToken, timingSafeEqual, verifyAccessCookie } from '@/lib/access'

describe('access gate helpers', () => {
  it('derives a stable token per PIN and a different one per PIN', async () => {
    const a1 = await computeAccessToken('hunter2-but-long')
    const a2 = await computeAccessToken('hunter2-but-long')
    const b = await computeAccessToken('other-passphrase')

    assert.equal(a1, a2)
    assert.notEqual(a1, b)
    assert.match(a1, /^[0-9a-f]{64}$/)
  })

  it('verifies only the matching cookie', async () => {
    const pin = 'correct-horse-battery'
    const token = await computeAccessToken(pin)

    assert.equal(await verifyAccessCookie(token, pin), true)
    assert.equal(await verifyAccessCookie(token, 'wrong-pin'), false)
    assert.equal(await verifyAccessCookie('forged-value', pin), false)
  })

  it('timingSafeEqual compares correctly', async () => {
    assert.equal(await timingSafeEqual('same', 'same'), true)
    assert.equal(await timingSafeEqual('same', 'different'), false)
    assert.equal(await timingSafeEqual('', ''), true)
  })
})
