import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createBackendServices } from '@/lib/backend/services'
import type { BackendServices } from '@/lib/backend/services'
import { REPLACE_BACKUP_CONFIRMATION } from '@/lib/backups/types'
import { createInMemoryRepositories } from '../support/in-memory-repositories'

const fixedNow = new Date('2026-05-29T10:00:00.000Z')
const populatedSummary = {
  groups: 1,
  groupMembers: 2,
  expenses: 1,
  expenseParticipants: 2,
  settlements: 1,
  personalTransactions: 1,
}
const emptySummary = {
  groups: 0,
  groupMembers: 0,
  expenses: 0,
  expenseParticipants: 0,
  settlements: 0,
  personalTransactions: 0,
}

function createTestBackend(createId: () => string = () => 'backup01') {
  const { repositories, state } = createInMemoryRepositories()
  const backend = createBackendServices({
    repositories,
    createId,
    now: () => fixedNow,
  })

  return { backend, state }
}

async function seedBackupData(backend: BackendServices) {
  const group = await backend.groups.createGroup({ name: 'Backup Trip', currency: 'CAD' })
  assert.equal(group.success, true)
  if (!group.success) throw new Error('group was not created')

  const alice = await backend.groups.addGroupMember(group.data.id, { name: 'Alice' })
  const bob = await backend.groups.addGroupMember(group.data.id, { name: 'Bob' })
  assert.equal(alice.success, true)
  assert.equal(bob.success, true)
  if (!alice.success || !bob.success) throw new Error('members were not created')

  const expense = await backend.expenses.addExpense(group.data.id, {
    title: 'Dinner',
    amount: 4200,
    currency: 'CAD',
    paidById: alice.data.id,
    date: fixedNow.getTime(),
    splitMethod: 'equal',
    participants: [
      { memberId: alice.data.id, shareValue: 1 },
      { memberId: bob.data.id, shareValue: 1 },
    ],
  })
  assert.equal(expense.success, true)

  const settlement = await backend.settlements.markSettlementPaid(
    group.data.id,
    bob.data.id,
    alice.data.id,
    2100
  )
  assert.equal(settlement.success, true)

  const transaction = await backend.personal.addPersonalTransaction({
    type: 'expense',
    title: 'Groceries',
    amount: 2500,
    currency: 'CAD',
    date: fixedNow.getTime(),
    category: 'Food & Dining',
  })
  assert.equal(transaction.success, true)

  return { groupId: group.data.id, groupToken: group.data.token }
}

describe('backup service', () => {
  it('exports all persisted tables and validates a clean restore target', async () => {
    const { backend } = createTestBackend()
    await seedBackupData(backend)

    const backup = await backend.backups.createBackup()

    assert.equal(backup.format, 'fairtab.backup')
    assert.equal(backup.version, 1)
    assert.equal(backup.exportedAt, fixedNow.toISOString())
    assert.deepEqual(backup.rowCounts, populatedSummary)

    const emptyTarget = createTestBackend()
    const cleanValidation = await emptyTarget.backend.backups.validateBackup(backup)
    assert.equal(cleanValidation.valid, true)
    assert.equal(cleanValidation.canRestore, true)
    assert.equal(cleanValidation.conflicts.length, 0)
    assert.deepEqual(cleanValidation.currentSummary, emptySummary)

    const currentValidation = await backend.backups.validateBackup(backup)
    assert.equal(currentValidation.valid, true)
    assert.equal(currentValidation.canRestore, false)
    assert.ok(currentValidation.conflicts.length > 0)
    assert.deepEqual(currentValidation.currentSummary, populatedSummary)
  })

  it('rejects backups with broken references before restore', async () => {
    const { backend } = createTestBackend()
    await seedBackupData(backend)

    const backup = await backend.backups.createBackup()
    backup.data.expenses[0].paidById = 999

    const emptyTarget = createTestBackend()
    const validation = await emptyTarget.backend.backups.validateBackup(backup)

    assert.equal(validation.valid, false)
    assert.equal(validation.canRestore, false)
    assert.match(validation.errors.map((error) => error.code).join(','), /missing_member/)
  })

  it('warns about future timestamps without blocking restore', async () => {
    const { backend: source } = createTestBackend()
    await seedBackupData(source)
    const backup = await source.backups.createBackup()
    backup.data.personalTransactions[0].date = fixedNow.getTime() + 3 * 24 * 60 * 60 * 1000

    const { backend: target } = createTestBackend(() => 'target01')
    const validation = await target.backups.validateBackup(backup)

    assert.equal(validation.valid, true)
    assert.equal(validation.canRestore, true)
    assert.ok(validation.warnings.some((warning) => warning.code === 'future_timestamp'))

    const result = await target.backups.restoreBackup(backup, { mode: 'empty' })
    assert.equal(result.restored, true)
    assert.ok(result.validation.warnings.some((warning) => warning.code === 'future_timestamp'))
  })

  it('restores a valid backup into an empty target', async () => {
    const { backend: source } = createTestBackend()
    await seedBackupData(source)
    const backup = await source.backups.createBackup()

    const { backend: target } = createTestBackend(() => 'target01')
    const result = await target.backups.restoreBackup(backup, { mode: 'empty' })

    assert.equal(result.restored, true)
    assert.equal(result.restoredAt, fixedNow.toISOString())
    assert.deepEqual(result.summary, backup.rowCounts)

    const restoredGroup = await target.groups.getGroupByToken('backup01')
    assert.equal(restoredGroup?.name, 'Backup Trip')
    assert.equal(restoredGroup?.members.length, 2)

    const restoredTransactions = await target.personal.getPersonalTransactions()
    assert.equal(restoredTransactions.length, 1)
    assert.equal(restoredTransactions[0].title, 'Groceries')

    const restoredSettlements = await target.settlements.getPaidSettlements(backup.data.groups[0].id)
    assert.equal(restoredSettlements.length, 1)
  })

  it('blocks empty restore when the target already contains data', async () => {
    const { backend: source } = createTestBackend()
    await seedBackupData(source)
    const backup = await source.backups.createBackup()

    const { backend: target } = createTestBackend(() => 'existing01')
    const existing = await seedBackupData(target)

    const result = await target.backups.restoreBackup(backup, { mode: 'empty' })

    assert.equal(result.restored, false)
    assert.match(result.error ?? '', /Current database is not empty/)
    assert.equal(await target.groups.getGroupByToken(existing.groupToken).then(Boolean), true)
    assert.equal(await target.groups.getGroupByToken('backup01').then(Boolean), false)
  })

  it('blocks replace restore without exact confirmation', async () => {
    const { backend: source } = createTestBackend()
    await seedBackupData(source)
    const backup = await source.backups.createBackup()

    const { backend: target } = createTestBackend(() => 'existing01')
    const existing = await seedBackupData(target)

    const result = await target.backups.restoreBackup(backup, {
      mode: 'replace',
      confirmation: 'replace',
    })

    assert.equal(result.restored, false)
    assert.match(result.error ?? '', /REPLACE ALL FAIRTAB DATA/)
    assert.equal(await target.groups.getGroupByToken(existing.groupToken).then(Boolean), true)
    assert.equal(await target.groups.getGroupByToken('backup01').then(Boolean), false)
  })

  it('replaces existing data when destructive restore is confirmed', async () => {
    const { backend: source } = createTestBackend()
    await seedBackupData(source)
    const backup = await source.backups.createBackup()

    const { backend: target } = createTestBackend(() => 'existing01')
    const existing = await seedBackupData(target)

    const result = await target.backups.restoreBackup(backup, {
      mode: 'replace',
      confirmation: REPLACE_BACKUP_CONFIRMATION,
    })

    assert.equal(result.restored, true)
    assert.deepEqual(result.summary, backup.rowCounts)
    assert.equal(await target.groups.getGroupByToken(existing.groupToken).then(Boolean), false)
    assert.equal(await target.groups.getGroupByToken('backup01').then(Boolean), true)

    const transaction = await target.personal.addPersonalTransaction({
      type: 'income',
      title: 'Post-restore income',
      amount: 5000,
      currency: 'CAD',
      date: fixedNow.getTime(),
    })
    assert.equal(transaction.success, true)
    assert.equal(transaction.success ? transaction.data.id : null, 2)
  })
})
