'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, Expense, ExpenseWithParticipants } from '@/types'

export async function addExpense(
  groupId: number,
  formData: unknown
): Promise<ActionResult<Expense>> {
  const result = await getBackend().expenses.addExpense(groupId, formData)
  if (result.success) revalidatePath('/groups')
  return result
}

export async function getGroupExpenses(groupId: number): Promise<ExpenseWithParticipants[]> {
  return getBackend().expenses.getGroupExpenses(groupId)
}
