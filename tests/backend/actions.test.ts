import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { addExpense, updateExpense } from '@/lib/actions/expenses'
import { addGroupMember, archiveGroup, createGroup, removeGroupMember } from '@/lib/actions/groups'
import { markSettlementPaid } from '@/lib/actions/settlements'
import { createBackendServices } from '@/lib/backend/services'
import { setBackendForTesting } from '@/lib/backend/runtime'
import type { Group, GroupMember } from '@/types'
import {
  getRevalidatedPaths,
  resetRevalidatedPaths,
} from '../support/next-cache'
import { createInMemoryRepositories } from '../support/in-memory-repositories'

const fixedNow = new Date('2026-05-29T10:00:00.000Z')

function createActionTestBackend() {
  const { repositories, state } = createInMemoryRepositories()
  let id = 0
  const backend = createBackendServices({
    repositories,
    createId: () => `group${++id}`,
    now: () => fixedNow,
  })
  setBackendForTesting(backend)

  return { backend, state }
}

async function createGroupWithMembers(
  name: string,
  memberNames: string[]
): Promise<{ group: Group; members: GroupMember[] }> {
  const groupResult = await createGroup({ name, currency: 'CAD' })
  assert.equal(groupResult.success, true)
  if (!groupResult.success) throw new Error('group was not created')

  const members: GroupMember[] = []
  for (const memberName of memberNames) {
    const memberResult = await addGroupMember(groupResult.data.token, { name: memberName })
    assert.equal(memberResult.success, true)
    if (memberResult.success) members.push(memberResult.data)
  }

  return { group: groupResult.data, members }
}

afterEach(() => {
  setBackendForTesting(null)
  resetRevalidatedPaths()
})

describe('server actions', () => {
  it('revalidates group routes after successful group mutations', async () => {
    createActionTestBackend()
    const { group } = await createGroupWithMembers('Trip', ['Alice'])

    resetRevalidatedPaths()
    const result = await addGroupMember(group.token, { name: 'Bob' })

    assert.equal(result.success, true)
    assert.deepEqual(getRevalidatedPaths(), ['/groups', `/groups/${group.token}`])
  })

  it('rejects cross-group member ids in expense actions without revalidating', async () => {
    const { state } = createActionTestBackend()
    const { group, members } = await createGroupWithMembers('Trip', ['Alice', 'Bob'])
    const { members: otherMembers } = await createGroupWithMembers('Other', ['Mallory'])

    resetRevalidatedPaths()
    const result = await addExpense(group.token, {
      title: 'Dinner',
      amount: 4000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: [
        { memberId: members[0].id, shareValue: 1 },
        { memberId: otherMembers[0].id, shareValue: 1 },
      ],
    })

    assert.equal(result.success, false)
    if (!result.success) assert.match(result.error, /belong/)
    assert.equal(state.expenses.length, 0)
    assert.deepEqual(getRevalidatedPaths(), [])
  })

  it('prevents editing an expense through the wrong group token', async () => {
    createActionTestBackend()
    const { group, members } = await createGroupWithMembers('Trip', ['Alice', 'Bob'])
    const { group: otherGroup, members: otherMembers } = await createGroupWithMembers(
      'Other',
      ['Mallory', 'Oscar']
    )

    const created = await addExpense(otherGroup.token, {
      title: 'Other dinner',
      amount: 4000,
      currency: 'CAD',
      paidById: otherMembers[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: otherMembers.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })
    assert.equal(created.success, true)
    if (!created.success) return

    resetRevalidatedPaths()
    const result = await updateExpense(group.token, created.data.id, {
      title: 'Wrong group edit',
      amount: 5000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })

    assert.equal(result.success, false)
    if (!result.success) assert.match(result.error, /Expense not found/)
    assert.deepEqual(getRevalidatedPaths(), [])
  })

  it('rejects archived-group mutations through server actions', async () => {
    const { state } = createActionTestBackend()
    const { group, members } = await createGroupWithMembers('Trip', ['Alice', 'Bob'])

    const archived = await archiveGroup(group.token, true)
    assert.equal(archived.success, true)

    resetRevalidatedPaths()
    const result = await addExpense(group.token, {
      title: 'Dinner',
      amount: 4000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })

    assert.equal(result.success, false)
    if (!result.success) assert.match(result.error, /read-only/)
    assert.equal(state.expenses.length, 0)
    assert.deepEqual(getRevalidatedPaths(), [])
  })

  it('rejects cross-group member ids in member and settlement actions', async () => {
    const { state } = createActionTestBackend()
    const { group, members } = await createGroupWithMembers('Trip', ['Alice', 'Bob'])
    const { members: otherMembers } = await createGroupWithMembers('Other', ['Mallory'])

    const removeResult = await removeGroupMember(group.token, otherMembers[0].id)
    assert.equal(removeResult.success, false)
    if (!removeResult.success) assert.match(removeResult.error, /not found in this group/)

    const settlementResult = await markSettlementPaid(
      group.token,
      members[1].id,
      otherMembers[0].id,
      2000
    )
    assert.equal(settlementResult.success, false)
    if (!settlementResult.success) assert.match(settlementResult.error, /not found in this group/)

    assert.equal(state.members.some((member) => member.id === otherMembers[0].id), true)
    assert.equal(state.settlements.length, 0)
  })
})
