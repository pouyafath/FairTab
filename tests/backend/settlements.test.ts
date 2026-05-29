import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateMemberBalances, calculateSettlements } from '@/lib/calculations/balances'
import type { GroupMember, MemberBalance } from '@/types'

const members: GroupMember[] = [
  { id: 1, groupId: 1, name: 'Alice', email: null },
  { id: 2, groupId: 1, name: 'Bob', email: null },
  { id: 3, groupId: 1, name: 'Cara', email: null },
  { id: 4, groupId: 1, name: 'Dev', email: null },
]

function balancesFromNet(netBalances: number[]): MemberBalance[] {
  return netBalances.map((netBalance, index) => ({
    member: members[index],
    totalPaid: Math.max(netBalance, 0),
    totalOwed: Math.max(-netBalance, 0),
    netBalance,
  }))
}

describe('settlement calculations', () => {
  it('returns zero balances and no settlements when there are no expenses', () => {
    const balances = calculateMemberBalances(members.slice(0, 2), [])

    assert.deepEqual(
      balances.map((balance) => balance.netBalance),
      [0, 0]
    )
    assert.deepEqual(calculateSettlements(balances), [])
  })

  it('does not create settlements for a single member group', () => {
    const balances = calculateMemberBalances([members[0]], [
      {
        paidById: members[0].id,
        totalAmount: 999,
        participantShares: [{ memberId: members[0].id, amountCents: 999 }],
      },
    ])

    assert.deepEqual(
      balances.map((balance) => balance.netBalance),
      [0]
    )
    assert.deepEqual(calculateSettlements(balances), [])
  })

  it('preserves uneven cents exactly when calculating member balances', () => {
    const balances = calculateMemberBalances(members.slice(0, 3), [
      {
        paidById: members[0].id,
        totalAmount: 10000,
        participantShares: [
          { memberId: members[0].id, amountCents: 3334 },
          { memberId: members[1].id, amountCents: 3333 },
          { memberId: members[2].id, amountCents: 3333 },
        ],
      },
    ])

    assert.deepEqual(
      balances.map((balance) => balance.netBalance),
      [6666, -3333, -3333]
    )
    assert.deepEqual(calculateSettlements(balances), [
      { fromMember: members[1], toMember: members[0], amount: 3333 },
      { fromMember: members[2], toMember: members[0], amount: 3333 },
    ])
  })

  it('matches multiple debtors to multiple creditors using minimal transfers', () => {
    const settlements = calculateSettlements(balancesFromNet([5000, 2000, -3000, -4000]))

    assert.deepEqual(settlements, [
      { fromMember: members[3], toMember: members[0], amount: 4000 },
      { fromMember: members[2], toMember: members[0], amount: 1000 },
      { fromMember: members[2], toMember: members[1], amount: 2000 },
    ])
  })
})
