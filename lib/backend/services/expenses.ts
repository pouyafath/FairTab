import { calculateSplits } from '@/lib/calculations/split'
import { addExpenseSchema } from '@/lib/validations/expense'
import type { ActionResult, Expense, ExpenseWithParticipants } from '@/types'
import type { BackendServiceDeps } from './types'
import { failure, validationError } from './result'

export function createExpenseService({ repositories, now, storage }: BackendServiceDeps) {
  return {
    async addExpense(
      groupId: number,
      formData: unknown
    ): Promise<ActionResult<Expense>> {
      const parsed = addExpenseSchema.safeParse(formData)
      if (!parsed.success) return validationError<Expense>(parsed.error)

      const data = parsed.data
      let participants
      try {
        participants = calculateSplits(data.amount, data.splitMethod, data.participants)
      } catch (err) {
        return failure<Expense>((err as Error).message)
      }

      const expense = await repositories.expenses.createWithParticipants({
        groupId,
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        paidById: data.paidById,
        date: new Date(data.date),
        category: data.category ?? null,
        notes: data.notes ?? null,
        splitMethod: data.splitMethod,
        createdAt: now(),
        participants,
      })

      return { success: true, data: expense }
    },

    async getGroupExpenses(groupId: number): Promise<ExpenseWithParticipants[]> {
      return repositories.expenses.findForGroup(groupId)
    },

    async getExpense(expenseId: number): Promise<ExpenseWithParticipants | null> {
      return repositories.expenses.findById(expenseId)
    },

    async updateExpense(
      expenseId: number,
      formData: unknown
    ): Promise<ActionResult<Expense>> {
      const parsed = addExpenseSchema.safeParse(formData)
      if (!parsed.success) return validationError<Expense>(parsed.error)

      const existing = await repositories.expenses.findById(expenseId)
      if (!existing) return failure<Expense>('Expense not found')

      const data = parsed.data
      let participants
      try {
        participants = calculateSplits(data.amount, data.splitMethod, data.participants)
      } catch (err) {
        return failure<Expense>((err as Error).message)
      }

      const expense = await repositories.expenses.updateWithParticipants(expenseId, {
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        paidById: data.paidById,
        date: new Date(data.date),
        category: data.category ?? null,
        notes: data.notes ?? null,
        splitMethod: data.splitMethod,
        participants,
      })

      return { success: true, data: expense }
    },

    async deleteExpense(expenseId: number): Promise<ActionResult<void>> {
      const existing = await repositories.expenses.findById(expenseId)
      if (!existing) return failure<void>('Expense not found')

      for (const attachment of existing.attachments) {
        await storage.delete(attachment.storageKey)
      }

      await repositories.expenses.delete(expenseId)
      return { success: true, data: undefined }
    },
  }
}
