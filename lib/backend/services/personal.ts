import { addTransactionSchema } from '@/lib/validations/personal'
import type { ActionResult, PersonalTransaction } from '@/types'
import type { BackendServiceDeps } from './types'
import { failure, validationError } from './result'

export function createPersonalService({ repositories, now }: BackendServiceDeps) {
  return {
    async addPersonalTransaction(
      formData: unknown
    ): Promise<ActionResult<PersonalTransaction>> {
      const parsed = addTransactionSchema.safeParse(formData)
      if (!parsed.success) return validationError<PersonalTransaction>(parsed.error)

      const data = parsed.data
      const tx = await repositories.personal.create({
        type: data.type,
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        date: new Date(data.date),
        category: data.category ?? null,
        note: data.note ?? null,
        accountLabel: data.accountLabel ?? null,
        sourceRuleId: null,
        createdAt: now(),
      })

      return { success: true, data: tx }
    },

    async getPersonalTransaction(id: number): Promise<PersonalTransaction | null> {
      return repositories.personal.findById(id)
    },

    async getPersonalTransactions(): Promise<PersonalTransaction[]> {
      return repositories.personal.findAll()
    },

    async updatePersonalTransaction(
      id: number,
      formData: unknown
    ): Promise<ActionResult<PersonalTransaction>> {
      const parsed = addTransactionSchema.safeParse(formData)
      if (!parsed.success) return validationError<PersonalTransaction>(parsed.error)

      const existing = await repositories.personal.findById(id)
      if (!existing) return { success: false, error: 'Transaction not found' }

      const data = parsed.data
      const tx = await repositories.personal.update(id, {
        type: data.type,
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        date: new Date(data.date),
        category: data.category ?? null,
        note: data.note ?? null,
        accountLabel: data.accountLabel ?? null,
      })

      return { success: true, data: tx }
    },

    async deletePersonalTransaction(id: number): Promise<ActionResult<void>> {
      const existing = await repositories.personal.findById(id)
      if (!existing) return failure<void>('Transaction not found')

      await repositories.personal.delete(id)
      return { success: true, data: undefined }
    },
  }
}
