import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextDate } from '@/lib/calculations/recurring'
import { createInMemoryRepositories } from '../support/in-memory-repositories'
import { createInMemoryStorage } from '../support/in-memory-storage'
import { createRecurringService } from '@/lib/backend/services/recurring'

function d(iso: string) {
  return new Date(iso + 'T12:00:00Z')
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10)
}

describe('nextDate', () => {
  it('advances weekly by 7 days', () => {
    assert.equal(iso(nextDate(d('2026-06-01'), 'weekly', 1)), '2026-06-08')
  })

  it('advances biweekly by 14 days', () => {
    assert.equal(iso(nextDate(d('2026-06-01'), 'biweekly', 1)), '2026-06-15')
  })

  it('advances weekly by interval', () => {
    assert.equal(iso(nextDate(d('2026-06-01'), 'weekly', 3)), '2026-06-22')
  })

  it('advances monthly by 1 month', () => {
    assert.equal(iso(nextDate(d('2026-03-15'), 'monthly', 1)), '2026-04-15')
  })

  it('clamps Jan 31 → Feb 28 (non-leap)', () => {
    assert.equal(iso(nextDate(d('2026-01-31'), 'monthly', 1)), '2026-02-28')
  })

  it('clamps Jan 31 → Feb 29 (leap year)', () => {
    assert.equal(iso(nextDate(d('2024-01-31'), 'monthly', 1)), '2024-02-29')
  })

  it('advances monthly by interval > 1', () => {
    assert.equal(iso(nextDate(d('2026-01-15'), 'monthly', 2)), '2026-03-15')
  })

  it('advances yearly by 1 year', () => {
    assert.equal(iso(nextDate(d('2026-06-04'), 'yearly', 1)), '2027-06-04')
  })

  it('clamps Feb 29 → Feb 28 on non-leap year', () => {
    assert.equal(iso(nextDate(d('2024-02-29'), 'yearly', 1)), '2025-02-28')
  })
})

describe('materializeDueRecurring', () => {
  it('generates missing transactions and advances nextRunDate', async () => {
    const { repositories, state } = createInMemoryRepositories()
    const now = () => new Date('2026-06-04T12:00:00Z')
    const service = createRecurringService({
      repositories,
      storage: createInMemoryStorage(),
      createId: () => 'x',
      now,
    })

    // Rule set 2 months ago — should generate 2 transactions (Apr + May)
    await service.addRecurringRule({
      type: 'expense',
      title: 'Rent',
      amount: 150000,
      currency: 'CAD',
      category: 'Housing',
      note: null,
      accountLabel: null,
      frequency: 'monthly',
      intervalCount: 1,
      startDate: new Date('2026-04-01T12:00:00Z').getTime(),
    })

    const count = await service.materializeDueRecurring(new Date('2026-06-04T12:00:00Z'))

    // Apr 1, May 1, Jun 1 — all <= Jun 4
    assert.equal(count, 3)
    assert.equal(state.personalTransactions.length, 3)
    assert.equal(state.personalTransactions[0].sourceRuleId, state.recurringRules[0].id)

    // nextRunDate should be July 1
    const rule = state.recurringRules[0]
    assert.equal(iso(new Date(rule.nextRunDate)), '2026-07-01')
    assert.notEqual(rule.lastRunDate, null)
  })

  it('does not generate for inactive rules', async () => {
    const { repositories, state } = createInMemoryRepositories()
    const service = createRecurringService({
      repositories,
      storage: createInMemoryStorage(),
      createId: () => 'x',
      now: () => new Date(),
    })

    await service.addRecurringRule({
      type: 'income',
      title: 'Salary',
      amount: 500000,
      currency: 'CAD',
      frequency: 'monthly',
      intervalCount: 1,
      startDate: new Date('2026-01-01').getTime(),
    })

    await service.toggleRecurringRule(state.recurringRules[0].id, false)

    const count = await service.materializeDueRecurring(new Date('2026-06-04'))
    assert.equal(count, 0)
    assert.equal(state.personalTransactions.length, 0)
  })
})
