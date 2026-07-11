import { calculateSplits } from '@/lib/calculations/split'
import { addExpenseSchema } from '@/lib/validations/expense'
import type { ActionResult, Expense, ExpenseWithParticipants, GroupMember } from '@/types'
import type { BackendServiceDeps } from './types'
import { failure, validationError } from './result'

const ARCHIVED_GROUP_ERROR = 'Archived groups are read-only. Unarchive the group to make changes.'

function validateExpenseMembers(
  members: GroupMember[],
  paidById: number,
  participants: { memberId: number }[]
): string | null {
  const memberIds = new Set(members.map((member) => member.id))
  if (!memberIds.has(paidById)) return 'Paid-by member must belong to this group'

  const participantIds = participants.map((participant) => participant.memberId)
  if (new Set(participantIds).size !== participantIds.length) {
    return 'Each participant can only appear once'
  }

  if (participantIds.some((memberId) => !memberIds.has(memberId))) {
    return 'All participants must belong to this group'
  }

  return null
}

export function createExpenseService({ repositories, now, storage }: BackendServiceDeps) {
  return {
    async addExpense(
      groupId: number,
      formData: unknown
    ): Promise<ActionResult<Expense>> {
      const parsed = addExpenseSchema.safeParse(formData)
      if (!parsed.success) return validationError<Expense>(parsed.error)

      const data = parsed.data
      const group = await repositories.groups.findById(groupId)
      if (!group) return failure<Expense>('Group not found')
      if (group.isArchived) return failure<Expense>(ARCHIVED_GROUP_ERROR)

      const membershipError = validateExpenseMembers(
        group.members,
        data.paidById,
        data.participants
      )
      if (membershipError) return failure<Expense>(membershipError)

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
      const group = await repositories.groups.findById(existing.groupId)
      if (!group) return failure<Expense>('Group not found')
      if (group.isArchived) return failure<Expense>(ARCHIVED_GROUP_ERROR)

      const membershipError = validateExpenseMembers(
        group.members,
        data.paidById,
        data.participants
      )
      if (membershipError) return failure<Expense>(membershipError)

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

      const group = await repositories.groups.findById(existing.groupId)
      if (!group) return failure<void>('Group not found')
      if (group.isArchived) return failure<void>(ARCHIVED_GROUP_ERROR)

      for (const attachment of existing.attachments) {
        await storage.delete(attachment.storageKey)
      }

      await repositories.expenses.delete(expenseId)
      return { success: true, data: undefined }
    },
  }
}
