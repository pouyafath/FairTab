import { addTransactionSchema } from '@/lib/validations/personal'
import type { ActionResult, PersonalTransaction } from '@/types'
import type { BackendServiceDeps } from './types'
import { validationError } from './result'

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
        createdAt: now(),
      })

      return { success: true, data: tx }
    },

    async getPersonalTransactions(): Promise<PersonalTransaction[]> {
      return repositories.personal.findAll()
    },

    async deletePersonalTransaction(id: number): Promise<ActionResult<void>> {
      await repositories.personal.delete(id)
      return { success: true, data: undefined }
    },
  }
}
