import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createBackendServices } from '@/lib/backend/services'
import type { BackendServices } from '@/lib/backend/services'
import type { GroupMember } from '@/types'
import { createInMemoryRepositories } from '../support/in-memory-repositories'

const fixedNow = new Date('2026-05-29T10:00:00.000Z')

function createTestBackend() {
  const { repositories, state } = createInMemoryRepositories()
  const backend = createBackendServices({
    repositories,
    createId: () => 'group123',
    now: () => fixedNow,
  })

  return { backend, state }
}

async function createGroupWithMembers(
  backend: BackendServices,
  memberNames: string[]
): Promise<{ groupId: number; members: GroupMember[] }> {
  const groupResult = await backend.groups.createGroup({
    name: 'Montreal Trip',
    currency: 'CAD',
  })
  assert.equal(groupResult.success, true)

  const members: GroupMember[] = []
  for (const name of memberNames) {
    const result = await backend.groups.addGroupMember(groupResult.data.id, { name })
    assert.equal(result.success, true)
    if (result.success) members.push(result.data)
  }

  return { groupId: groupResult.data.id, members }
}

describe('backend services', () => {
  it('creates groups and members without Next.js, a server, or a database', async () => {
    const { backend } = createTestBackend()

    const groupResult = await backend.groups.createGroup({
      name: 'House Expenses',
      currency: 'CAD',
    })

    assert.deepEqual(groupResult, {
      success: true,
      data: {
        id: 1,
        name: 'House Expenses',
        token: 'group123',
        currency: 'CAD',
        createdAt: fixedNow.getTime(),
      },
    })

    if (!groupResult.success) throw new Error('group was not created')

    const memberResult = await backend.groups.addGroupMember(groupResult.data.id, {
      name: 'Sarah',
      email: 'sarah@example.com',
    })

    assert.equal(memberResult.success, true)

    const group = await backend.groups.getGroupByToken('group123')
    assert.equal(group?.members.length, 1)
    assert.deepEqual(
      { name: group?.members[0]?.name, email: group?.members[0]?.email },
      { name: 'Sarah', email: 'sarah@example.com' }
    )
  })

  it('rejects invalid expense splits before writing anything', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    const result = await backend.expenses.addExpense(groupId, {
      title: 'Dinner',
      amount: 5000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'exact',
      participants: [
        { memberId: members[0].id, shareValue: 1000 },
        { memberId: members[1].id, shareValue: 1000 },
      ],
    })

    assert.equal(result.success, false)
    assert.equal(state.expenses.length, 0)
    assert.equal(state.expenseParticipants.length, 0)
  })

  it('returns validation failures for invalid group, member, expense, and transaction input', async () => {
    const { backend } = createTestBackend()

    const groupResult = await backend.groups.createGroup({ name: 'A', currency: 'CAD' })
    assert.equal(groupResult.success, false)
    if (!groupResult.success) assert.match(groupResult.error, /at least 2 characters/)

    const memberResult = await backend.groups.addGroupMember(1, {
      name: '',
      email: 'not-an-email',
    })
    assert.equal(memberResult.success, false)
    if (!memberResult.success) assert.match(memberResult.error, /Name is required/)

    const expenseResult = await backend.expenses.addExpense(1, {
      title: '',
      amount: -1,
      currency: 'CAD',
      paidById: 1,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: [],
    })
    assert.equal(expenseResult.success, false)
    if (!expenseResult.success) assert.match(expenseResult.error, /Title is required/)

    const transactionResult = await backend.personal.addPersonalTransaction({
      type: 'expense',
      title: '',
      amount: 100,
      currency: 'CAD',
      date: fixedNow.getTime(),
    })
    assert.equal(transactionResult.success, false)
    if (!transactionResult.success) assert.match(transactionResult.error, /Title is required/)
  })

  it('adds group expenses and calculates settlement suggestions from stored shares', async () => {
    const { backend } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, [
      'Alice',
      'Bob',
      'Cara',
    ])

    const result = await backend.expenses.addExpense(groupId, {
      title: 'Cabin rental',
      amount: 9000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })

    assert.equal(result.success, true)

    const expenses = await backend.expenses.getGroupExpenses(groupId)
    assert.deepEqual(expenses[0].participants.map((participant) => participant.amountCents), [
      3000,
      3000,
      3000,
    ])

    const settlements = await backend.settlements.getSettlementSuggestions(groupId)
    assert.deepEqual(settlements, [
      { fromMember: members[1], toMember: members[0], amount: 3000 },
      { fromMember: members[2], toMember: members[0], amount: 3000 },
    ])
  })

  it('manages personal transactions without server actions or DB adapters', async () => {
    const { backend } = createTestBackend()

    const income = await backend.personal.addPersonalTransaction({
      type: 'income',
      title: 'Paycheque',
      amount: 250000,
      currency: 'CAD',
      date: fixedNow.getTime(),
      category: 'Salary',
    })

    const expense = await backend.personal.addPersonalTransaction({
      type: 'expense',
      title: 'Groceries',
      amount: 8450,
      currency: 'CAD',
      date: fixedNow.getTime() - 1,
      category: 'Groceries',
    })

    assert.equal(income.success, true)
    assert.equal(expense.success, true)

    const transactions = await backend.personal.getPersonalTransactions()
    assert.deepEqual(transactions.map((tx) => tx.title), ['Paycheque', 'Groceries'])

    if (expense.success) await backend.personal.deletePersonalTransaction(expense.data.id)

    assert.equal((await backend.personal.getPersonalTransactions()).length, 1)
  })
})
