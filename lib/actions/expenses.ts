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

export async function getExpense(expenseId: number): Promise<ExpenseWithParticipants | null> {
  return getBackend().expenses.getExpense(expenseId)
}

export async function updateExpense(
  expenseId: number,
  formData: unknown
): Promise<ActionResult<Expense>> {
  const result = await getBackend().expenses.updateExpense(expenseId, formData)
  if (result.success) revalidatePath('/groups')
  return result
}

export async function deleteExpense(expenseId: number): Promise<ActionResult<void>> {
  const result = await getBackend().expenses.deleteExpense(expenseId)
  if (result.success) revalidatePath('/groups')
  return result
}
