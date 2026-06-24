import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInMemoryRepositories } from '../support/in-memory-repositories'
import { createInMemoryStorage } from '../support/in-memory-storage'
import { createLegacyBackupService } from '@/lib/backend/services/backup'
import type { InMemoryRepositoryState } from '../support/in-memory-repositories'

const NOW = new Date('2026-06-01T00:00:00Z').getTime()

// Deliberately non-contiguous ids so a restore must remap every reference.
const seeded: Partial<InMemoryRepositoryState> = {
  groups: [{ id: 7, name: 'Ski trip', token: 'skitoken', currency: 'CAD', isArchived: false, createdAt: NOW }],
  members: [
    { id: 30, groupId: 7, name: 'Alice', email: 'alice@example.com' },
    { id: 31, groupId: 7, name: 'Bob', email: null },
  ],
  expenses: [
    {
      id: 100, groupId: 7, title: 'Cabin', amount: 40000, currency: 'CAD',
      paidById: 30, date: NOW, category: 'Lodging', notes: null, splitMethod: 'equal', createdAt: NOW,
    },
  ],
  expenseParticipants: [
    { id: 200, expenseId: 100, memberId: 30, shareValue: 1, amountCents: 20000 },
    { id: 201, expenseId: 100, memberId: 31, shareValue: 1, amountCents: 20000 },
  ],
  settlements: [
    { id: 50, groupId: 7, fromMemberId: 31, toMemberId: 30, amount: 20000, isPaid: true, paidAt: NOW },
  ],
  recurringRules: [
    {
      id: 9, type: 'expense', title: 'Rent', amount: 150000, currency: 'CAD',
      category: 'Housing', note: null, accountLabel: null, frequency: 'monthly',
      intervalCount: 1, nextRunDate: NOW, lastRunDate: null, active: true, createdAt: NOW,
    },
  ],
  personalTransactions: [
    {
      id: 70, type: 'expense', title: 'Rent', amount: 150000, currency: 'CAD',
      date: NOW, category: 'Housing', note: null, accountLabel: null, sourceRuleId: 9, createdAt: NOW,
    },
  ],
  savingsGoals: [
    { id: 4, name: 'Emergency fund', targetAmount: 500000, currentAmount: 100000, currency: 'CAD', targetDate: null, createdAt: NOW },
  ],
  attachments: [
    {
      id: 12, groupId: 7, expenseId: 100, storageKey: '7/abc123.jpg',
      filename: 'receipt.jpg', contentType: 'image/jpeg', size: 1234, createdAt: NOW,
    },
  ],
}

function createService(initial?: Partial<InMemoryRepositoryState>) {
  const { repositories, state } = createInMemoryRepositories(initial)
  const service = createLegacyBackupService({
    repositories,
    storage: createInMemoryStorage(),
    createId: () => 'x',
    now: () => new Date('2026-06-04T12:00:00Z'),
  })
  return { service, state }
}

describe('backup and restore', () => {
  it('round-trips all entities with remapped but consistent references', async () => {
    const source = createService(seeded)
    const doc = await source.service.exportBackup()

    assert.equal(doc.format, 'fairtab-backup')
    assert.equal(doc.version, 1)

    const target = createService()
    const result = await target.service.importBackup(doc)

    assert.equal(result.success, true)
    if (!result.success) return
    assert.deepEqual(result.data, {
      groups: 1,
      members: 2,
      expenses: 1,
      settlements: 1,
      personalTransactions: 1,
      recurringRules: 1,
      savingsGoals: 1,
      attachments: 1,
    })

    const s = target.state
    const group = s.groups[0]
    assert.equal(group.token, 'skitoken')

    // Every foreign key must point at the freshly assigned ids
    for (const member of s.members) assert.equal(member.groupId, group.id)
    const expense = s.expenses[0]
    assert.equal(expense.groupId, group.id)
    assert.equal(expense.paidById, s.members.find((m) => m.name === 'Alice')!.id)
    for (const p of s.expenseParticipants) assert.equal(p.expenseId, expense.id)
    assert.equal(s.settlements[0].groupId, group.id)
    assert.equal(s.personalTransactions[0].sourceRuleId, s.recurringRules[0].id)
    assert.equal(s.attachments[0].expenseId, expense.id)
    assert.equal(s.attachments[0].groupId, group.id)
    // Storage keys survive verbatim so existing files are found after restore
    assert.equal(s.attachments[0].storageKey, '7/abc123.jpg')

    // A second export carries the same content
    const doc2 = await target.service.exportBackup()
    assert.equal(doc2.data.groups[0].name, 'Ski trip')
    assert.equal(doc2.data.expenses[0].amount, 40000)
    assert.equal(doc2.data.savingsGoals[0].currentAmount, 100000)
  })

  it('replaces existing data instead of merging', async () => {
    const source = createService(seeded)
    const doc = await source.service.exportBackup()

    const target = createService({
      groups: [{ id: 1, name: 'Old group', token: 'oldtoken', currency: 'USD', isArchived: false, createdAt: NOW }],
      personalTransactions: [
        {
          id: 1, type: 'income', title: 'Old salary', amount: 1, currency: 'USD',
          date: NOW, category: null, note: null, accountLabel: null, sourceRuleId: null, createdAt: NOW,
        },
      ],
    })

    const result = await target.service.importBackup(doc)
    assert.equal(result.success, true)
    assert.equal(target.state.groups.length, 1)
    assert.equal(target.state.groups[0].token, 'skitoken')
    assert.equal(target.state.personalTransactions[0].title, 'Rent')
  })

  it('rejects documents with the wrong format or version', async () => {
    const { service } = createService()

    const wrongFormat = await service.importBackup({ format: 'other-app', version: 1, generatedAt: '', data: {} })
    assert.equal(wrongFormat.success, false)

    const wrongVersion = await service.importBackup({
      format: 'fairtab-backup', version: 2, generatedAt: '', data: {},
    })
    assert.equal(wrongVersion.success, false)

    const garbage = await service.importBackup('not even an object')
    assert.equal(garbage.success, false)
  })

  it('rejects documents with broken references', async () => {
    const { service, state } = createService()
    const doc = {
      format: 'fairtab-backup' as const,
      version: 1 as const,
      generatedAt: new Date().toISOString(),
      data: {
        groups: [],
        members: [{ id: 1, groupId: 99, name: 'Orphan', email: null }],
        expenses: [],
        expenseParticipants: [],
        settlements: [],
        personalTransactions: [],
        recurringRules: [],
        savingsGoals: [],
        attachments: [],
      },
    }

    const result = await service.importBackup(doc)
    assert.equal(result.success, false)
    assert.equal(state.members.length, 0)
  })
})
