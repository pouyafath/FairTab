import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInMemoryRepositories } from '../support/in-memory-repositories'
import { createInMemoryStorage } from '../support/in-memory-storage'
import { createSavingsService } from '@/lib/backend/services/savings'

function createService() {
  const { repositories, state } = createInMemoryRepositories()
  const service = createSavingsService({
    repositories,
    storage: createInMemoryStorage(),
    createId: () => 'x',
    now: () => new Date('2026-06-04T12:00:00Z'),
  })
  return { service, state }
}

describe('savings goals', () => {
  it('creates a goal starting at zero saved', async () => {
    const { service } = createService()

    const result = await service.addSavingsGoal({
      name: 'Emergency fund',
      targetAmount: 500000,
      currency: 'CAD',
      targetDate: null,
    })

    assert.equal(result.success, true)
    if (!result.success) return
    assert.equal(result.data.currentAmount, 0)
    assert.equal(result.data.targetAmount, 500000)
  })

  it('rejects a non-positive target', async () => {
    const { service } = createService()

    const result = await service.addSavingsGoal({
      name: 'Bad goal',
      targetAmount: 0,
      currency: 'CAD',
    })

    assert.equal(result.success, false)
  })

  it('contributes and withdraws without going below zero', async () => {
    const { service, state } = createService()

    await service.addSavingsGoal({ name: 'Trip', targetAmount: 100000, currency: 'CAD' })
    const id = state.savingsGoals[0].id

    const afterAdd = await service.contributeSavingsGoal(id, { amount: 25000 })
    assert.equal(afterAdd.success && afterAdd.data.currentAmount, 25000)

    const afterWithdraw = await service.contributeSavingsGoal(id, { amount: -40000 })
    assert.equal(afterWithdraw.success && afterWithdraw.data.currentAmount, 0)
  })

  it('rejects a zero contribution', async () => {
    const { service, state } = createService()

    await service.addSavingsGoal({ name: 'Trip', targetAmount: 100000, currency: 'CAD' })

    const result = await service.contributeSavingsGoal(state.savingsGoals[0].id, { amount: 0 })
    assert.equal(result.success, false)
  })

  it('updates name, target, and date while preserving progress', async () => {
    const { service, state } = createService()

    await service.addSavingsGoal({ name: 'Car', targetAmount: 2000000, currency: 'CAD' })
    const id = state.savingsGoals[0].id
    await service.contributeSavingsGoal(id, { amount: 120000 })

    const result = await service.updateSavingsGoal(id, {
      name: 'New car',
      targetAmount: 2500000,
      currency: 'CAD',
      targetDate: new Date('2027-01-01').getTime(),
    })

    assert.equal(result.success, true)
    if (!result.success) return
    assert.equal(result.data.name, 'New car')
    assert.equal(result.data.targetAmount, 2500000)
    assert.equal(result.data.currentAmount, 120000)
  })

  it('deletes a goal', async () => {
    const { service, state } = createService()

    await service.addSavingsGoal({ name: 'Gone', targetAmount: 1000, currency: 'CAD' })
    const result = await service.deleteSavingsGoal(state.savingsGoals[0].id)

    assert.equal(result.success, true)
    assert.equal(state.savingsGoals.length, 0)
  })
})
