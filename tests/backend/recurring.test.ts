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

  it('does not duplicate a transaction already materialized for the same date', async () => {
    const { repositories, state } = createInMemoryRepositories()
    const now = () => new Date('2026-06-04T12:00:00Z')
    const service = createRecurringService({
      repositories,
      storage: createInMemoryStorage(),
      createId: () => 'x',
      now,
    })

    // Rule set 2 months ago — should generate 2 more transactions (May + Jun)
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
    const rule = state.recurringRules[0]

    // Simulate a prior interrupted run that inserted Apr's transaction but crashed
    // before advancing nextRunDate, so the rule still reports Apr 1 as due.
    await repositories.personal.create({
      type: 'expense',
      title: 'Rent',
      amount: 150000,
      currency: 'CAD',
      date: new Date(rule.nextRunDate),
      category: 'Housing',
      note: null,
      accountLabel: null,
      sourceRuleId: rule.id,
      createdAt: now(),
    })

    const count = await service.materializeDueRecurring(new Date('2026-06-04T12:00:00Z'))

    // Only May 1 and Jun 1 are newly created; Apr 1 already existed.
    assert.equal(count, 2)
    assert.equal(state.personalTransactions.length, 3)

    const updatedRule = state.recurringRules[0]
    assert.equal(iso(new Date(updatedRule.nextRunDate)), '2026-07-01')
  })

  it('caps occurrences per run and resumes from where it stopped', async () => {
    const { repositories, state } = createInMemoryRepositories()
    const service = createRecurringService({
      repositories,
      storage: createInMemoryStorage(),
      createId: () => 'x',
      now: () => new Date('2026-06-04T12:00:00Z'),
    })

    // Weekly rule starting ~6 years back: far more than one run's cap of 200.
    await service.addRecurringRule({
      type: 'expense',
      title: 'Coffee',
      amount: 500,
      currency: 'CAD',
      frequency: 'weekly',
      intervalCount: 1,
      startDate: new Date('2020-06-04T12:00:00Z').getTime(),
    })

    const firstRun = await service.materializeDueRecurring(new Date('2026-06-04T12:00:00Z'))
    assert.equal(firstRun, 200)
    assert.equal(state.personalTransactions.length, 200)

    // The rule's nextRunDate advanced past the capped batch, so a second run
    // continues instead of duplicating.
    const secondRun = await service.materializeDueRecurring(new Date('2026-06-04T12:00:00Z'))
    assert.ok(secondRun > 0)
    assert.equal(state.personalTransactions.length, 200 + secondRun)
    const dates = new Set(state.personalTransactions.map((tx) => tx.date))
    assert.equal(dates.size, state.personalTransactions.length)
  })

  it('rejects a start date with a typo far in the past', async () => {
    const { repositories } = createInMemoryRepositories()
    const service = createRecurringService({
      repositories,
      storage: createInMemoryStorage(),
      createId: () => 'x',
      now: () => new Date('2026-06-04T12:00:00Z'),
    })

    const result = await service.addRecurringRule({
      type: 'expense',
      title: 'Rent',
      amount: 150000,
      currency: 'CAD',
      frequency: 'monthly',
      intervalCount: 1,
      startDate: new Date('1996-06-04T12:00:00Z').getTime(),
    })

    assert.equal(result.success, false)
    if (!result.success) assert.match(result.error, /2000 or later/)
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
