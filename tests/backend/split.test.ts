import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateSplits } from '@/lib/calculations/split'

const participants = [
  { memberId: 1, shareValue: 1 },
  { memberId: 2, shareValue: 1 },
  { memberId: 3, shareValue: 1 },
]

describe('split calculations', () => {
  it('splits equal amounts and distributes remainder cents in member order', () => {
    assert.deepEqual(
      calculateSplits(10000, 'equal', participants).map((share) => share.amountCents),
      [3334, 3333, 3333]
    )
  })

  it('accepts exact splits only when participant amounts match the total', () => {
    const shares = calculateSplits(7500, 'exact', [
      { memberId: 1, shareValue: 2500 },
      { memberId: 2, shareValue: 5000 },
    ])

    assert.deepEqual(
      shares.map((share) => share.amountCents),
      [2500, 5000]
    )
    assert.throws(
      () =>
        calculateSplits(7500, 'exact', [
          { memberId: 1, shareValue: 2500 },
          { memberId: 2, shareValue: 4999 },
        ]),
      /must sum to total/
    )
  })

  it('splits percentages and gives remainder cents to largest fractional parts', () => {
    const shares = calculateSplits(10001, 'percentage', [
      { memberId: 1, shareValue: 50 },
      { memberId: 2, shareValue: 25 },
      { memberId: 3, shareValue: 25 },
    ])

    assert.deepEqual(
      shares.map((share) => share.amountCents),
      [5001, 2500, 2500]
    )
    assert.throws(
      () =>
        calculateSplits(10000, 'percentage', [
          { memberId: 1, shareValue: 60 },
          { memberId: 2, shareValue: 30 },
        ]),
      /Percentages must sum to 100/
    )
  })

  it('splits by shares and rejects zero total shares', () => {
    const shares = calculateSplits(10000, 'shares', [
      { memberId: 1, shareValue: 2 },
      { memberId: 2, shareValue: 1 },
      { memberId: 3, shareValue: 1 },
    ])

    assert.deepEqual(
      shares.map((share) => share.amountCents),
      [5000, 2500, 2500]
    )
    assert.throws(
      () =>
        calculateSplits(10000, 'shares', [
          { memberId: 1, shareValue: 0 },
          { memberId: 2, shareValue: 0 },
        ]),
      /Total shares must be greater than 0/
    )
  })
})
