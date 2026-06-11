import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dateInputToTimestamp, formatDate } from '@/lib/formatting'

describe('date formatting helpers', () => {
  it('preserves date input calendar days in the local timezone', () => {
    const timestamp = dateInputToTimestamp('2026-05-29')

    assert.equal(formatDate(timestamp), 'May 29, 2026')
  })
})
