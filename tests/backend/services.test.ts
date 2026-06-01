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

  it('edits an expense and recalculates participant shares', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob', 'Cara'])

    const created = await backend.expenses.addExpense(groupId, {
      title: 'Cabin rental',
      amount: 9000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })
    assert.equal(created.success, true)
    if (!created.success) return

    // Change amount and drop Cara from the split
    const updated = await backend.expenses.updateExpense(created.data.id, {
      title: 'Cabin rental (updated)',
      amount: 10000,
      currency: 'CAD',
      paidById: members[1].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: [
        { memberId: members[0].id, shareValue: 1 },
        { memberId: members[1].id, shareValue: 1 },
      ],
    })
    assert.equal(updated.success, true)

    const expenses = await backend.expenses.getGroupExpenses(groupId)
    assert.equal(expenses.length, 1)
    assert.equal(expenses[0].title, 'Cabin rental (updated)')
    assert.equal(expenses[0].amount, 10000)
    assert.equal(expenses[0].paidById, members[1].id)
    assert.deepEqual(
      expenses[0].participants.map((p) => p.amountCents),
      [5000, 5000]
    )
    // Old participant rows replaced, not appended
    assert.equal(state.expenseParticipants.length, 2)
  })

  it('rejects edits with invalid splits and reports missing expenses', async () => {
    const { backend } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    const created = await backend.expenses.addExpense(groupId, {
      title: 'Dinner',
      amount: 5000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })
    assert.equal(created.success, true)
    if (!created.success) return

    // Exact split that doesn't sum to the total must fail and leave data intact
    const badEdit = await backend.expenses.updateExpense(created.data.id, {
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
    assert.equal(badEdit.success, false)

    const stillThere = await backend.expenses.getGroupExpenses(groupId)
    assert.equal(stillThere[0].amount, 5000)
    assert.deepEqual(
      stillThere[0].participants.map((p) => p.amountCents),
      [2500, 2500]
    )

    const missing = await backend.expenses.updateExpense(99999, {
      title: 'Nope',
      amount: 100,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: [{ memberId: members[0].id, shareValue: 1 }],
    })
    assert.equal(missing.success, false)
    if (!missing.success) assert.match(missing.error, /not found/)
  })

  it('deletes an expense and its participant rows', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    const created = await backend.expenses.addExpense(groupId, {
      title: 'Taxi',
      amount: 2000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((member) => ({ memberId: member.id, shareValue: 1 })),
    })
    assert.equal(created.success, true)
    if (!created.success) return

    assert.equal(state.expenseParticipants.length, 2)

    const deleted = await backend.expenses.deleteExpense(created.data.id)
    assert.equal(deleted.success, true)
    assert.equal((await backend.expenses.getGroupExpenses(groupId)).length, 0)
    assert.equal(state.expenseParticipants.length, 0)

    const deleteAgain = await backend.expenses.deleteExpense(created.data.id)
    assert.equal(deleteAgain.success, false)
  })

  it('renames a group', async () => {
    const { backend } = createTestBackend()
    const { groupId } = await createGroupWithMembers(backend, ['Alice'])

    const result = await backend.groups.renameGroup(groupId, { name: 'Updated Name' })
    assert.equal(result.success, true)
    if (!result.success) return

    assert.equal(result.data.name, 'Updated Name')

    const group = await backend.groups.getGroupByToken('group123')
    assert.equal(group?.name, 'Updated Name')
  })

  it('rejects rename with invalid name', async () => {
    const { backend } = createTestBackend()
    const { groupId } = await createGroupWithMembers(backend, ['Alice'])

    const result = await backend.groups.renameGroup(groupId, { name: 'X' })
    assert.equal(result.success, false)
    if (!result.success) assert.match(result.error, /at least 2 characters/)
  })

  it('deletes a group and cascades members, expenses, and participants', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    await backend.expenses.addExpense(groupId, {
      title: 'Lunch',
      amount: 2000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((m) => ({ memberId: m.id, shareValue: 1 })),
    })

    assert.equal(state.expenses.length, 1)
    assert.equal(state.expenseParticipants.length, 2)

    const result = await backend.groups.deleteGroup(groupId)
    assert.equal(result.success, true)

    assert.equal(state.groups.length, 0)
    assert.equal(state.members.length, 0)
    assert.equal(state.expenses.length, 0)
    assert.equal(state.expenseParticipants.length, 0)
  })

  it("updates a member's name and email", async () => {
    const { backend } = createTestBackend()
    const { members } = await createGroupWithMembers(backend, ['Alice'])

    const result = await backend.groups.updateMember(members[0].id, {
      name: 'Alicia',
      email: 'alicia@example.com',
    })
    assert.equal(result.success, true)
    if (!result.success) return

    assert.equal(result.data.name, 'Alicia')
    assert.equal(result.data.email, 'alicia@example.com')
  })

  it('removes a member who has no expenses', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    const result = await backend.groups.removeMember(groupId, members[1].id)
    assert.equal(result.success, true)
    assert.equal(state.members.length, 1)
    assert.equal(state.members[0].name, 'Alice')
  })

  it('blocks removing a member who is referenced in expenses', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    await backend.expenses.addExpense(groupId, {
      title: 'Dinner',
      amount: 4000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((m) => ({ memberId: m.id, shareValue: 1 })),
    })

    // Alice is paidBy — blocked
    const paidByBlock = await backend.groups.removeMember(groupId, members[0].id)
    assert.equal(paidByBlock.success, false)
    if (!paidByBlock.success) assert.match(paidByBlock.error, /Cannot remove/)

    // Bob is a participant — also blocked
    const participantBlock = await backend.groups.removeMember(groupId, members[1].id)
    assert.equal(participantBlock.success, false)
    if (!participantBlock.success) assert.match(participantBlock.error, /Cannot remove/)

    assert.equal(state.members.length, 2)
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

  it('edits a personal transaction and updates all fields', async () => {
    const { backend } = createTestBackend()

    const created = await backend.personal.addPersonalTransaction({
      type: 'expense',
      title: 'Coffee',
      amount: 500,
      currency: 'CAD',
      date: fixedNow.getTime(),
    })
    assert.equal(created.success, true)
    if (!created.success) return

    const updated = await backend.personal.updatePersonalTransaction(created.data.id, {
      type: 'expense',
      title: 'Coffee (updated)',
      amount: 650,
      currency: 'USD',
      date: fixedNow.getTime(),
      category: 'Food',
    })

    assert.equal(updated.success, true)
    if (!updated.success) return

    assert.equal(updated.data.title, 'Coffee (updated)')
    assert.equal(updated.data.amount, 650)
    assert.equal(updated.data.currency, 'USD')
    assert.equal(updated.data.category, 'Food')
  })

  it('returns not-found for editing a missing personal transaction', async () => {
    const { backend } = createTestBackend()

    const result = await backend.personal.updatePersonalTransaction(99999, {
      type: 'expense',
      title: 'Ghost',
      amount: 100,
      currency: 'CAD',
      date: fixedNow.getTime(),
    })

    assert.equal(result.success, false)
    if (!result.success) assert.match(result.error, /not found/)
  })

  it('filters paid settlements out of suggestions and supports undo', async () => {
    const { backend, state } = createTestBackend()
    const { groupId, members } = await createGroupWithMembers(backend, ['Alice', 'Bob'])

    await backend.expenses.addExpense(groupId, {
      title: 'Dinner',
      amount: 4000,
      currency: 'CAD',
      paidById: members[0].id,
      date: fixedNow.getTime(),
      splitMethod: 'equal',
      participants: members.map((m) => ({ memberId: m.id, shareValue: 1 })),
    })

    // Before marking paid: suggestion present
    const before = await backend.settlements.getSettlementSuggestions(groupId)
    assert.equal(before.length, 1)
    assert.equal(before[0].fromMember.id, members[1].id)

    // Mark the settlement as paid
    await backend.settlements.markSettlementPaid(
      groupId,
      members[1].id,
      members[0].id,
      2000
    )

    // After marking paid: suggestion filtered out
    const after = await backend.settlements.getSettlementSuggestions(groupId)
    assert.equal(after.length, 0)

    const paid = await backend.settlements.getPaidSettlements(groupId)
    assert.equal(paid.length, 1)

    // Undo: settlement reappears
    await backend.settlements.undoSettlement(paid[0].id)
    const restored = await backend.settlements.getSettlementSuggestions(groupId)
    assert.equal(restored.length, 1)
    assert.equal(state.settlements.length, 0)
  })
})
