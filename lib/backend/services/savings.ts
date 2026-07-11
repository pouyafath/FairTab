import { savingsGoalSchema, contributeSchema } from '@/lib/validations/savings'
import { failure, validationError } from './result'
import type { ActionResult, SavingsGoal } from '@/types'
import type { BackendServiceDeps } from './types'

export function createSavingsService({ repositories, now }: BackendServiceDeps) {
  async function findGoal(id: number): Promise<SavingsGoal | undefined> {
    const goals = await repositories.savings.findAll()
    return goals.find((goal) => goal.id === id)
  }

  return {
    async addSavingsGoal(formData: unknown): Promise<ActionResult<SavingsGoal>> {
      const parsed = savingsGoalSchema.safeParse(formData)
      if (!parsed.success) return validationError<SavingsGoal>(parsed.error)

      const data = parsed.data
      const goal = await repositories.savings.create({
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: 0,
        currency: data.currency,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        createdAt: now(),
      })

      return { success: true, data: goal }
    },

    async getSavingsGoals(): Promise<SavingsGoal[]> {
      return repositories.savings.findAll()
    },

    async updateSavingsGoal(
      id: number,
      formData: unknown
    ): Promise<ActionResult<SavingsGoal>> {
      const parsed = savingsGoalSchema.safeParse(formData)
      if (!parsed.success) return validationError<SavingsGoal>(parsed.error)

      if (!(await findGoal(id))) return failure<SavingsGoal>('Savings goal not found')

      const data = parsed.data
      const goal = await repositories.savings.update(id, {
        name: data.name,
        targetAmount: data.targetAmount,
        currency: data.currency,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      })

      return { success: true, data: goal }
    },

    async contributeSavingsGoal(
      id: number,
      formData: unknown
    ): Promise<ActionResult<SavingsGoal>> {
      const parsed = contributeSchema.safeParse(formData)
      if (!parsed.success) return validationError<SavingsGoal>(parsed.error)

      if (!(await findGoal(id))) return failure<SavingsGoal>('Savings goal not found')

      const goal = await repositories.savings.contribute(id, parsed.data.amount)
      return { success: true, data: goal }
    },

    async deleteSavingsGoal(id: number): Promise<ActionResult<void>> {
      if (!(await findGoal(id))) return failure<void>('Savings goal not found')

      await repositories.savings.delete(id)
      return { success: true, data: undefined }
    },
  }
}
