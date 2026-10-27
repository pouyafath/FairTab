'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import { findGroupForToken } from '@/lib/actions/authorize'
import type { ActionResult, Expense } from '@/types'

const GROUP_NOT_FOUND = { success: false as const, error: 'Group not found' }
const EXPENSE_NOT_FOUND = { success: false as const, error: 'Expense not found' }

function revalidateGroup(token: string) {
  revalidatePath('/groups')
  revalidatePath(`/groups/${token}`)
}

export async function addExpense(
  token: string,
  formData: unknown
): Promise<ActionResult<Expense>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const result = await getBackend().expenses.addExpense(group.id, formData)
  if (result.success) revalidateGroup(token)
  return result
}

export async function updateExpense(
  token: string,
  expenseId: number,
  formData: unknown
): Promise<ActionResult<Expense>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const expense = await getBackend().expenses.getExpense(expenseId)
  if (!expense || expense.groupId !== group.id) return EXPENSE_NOT_FOUND

  const result = await getBackend().expenses.updateExpense(expenseId, formData)
  if (result.success) revalidateGroup(token)
  return result
}

export async function deleteExpense(
  token: string,
  expenseId: number
): Promise<ActionResult<void>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const expense = await getBackend().expenses.getExpense(expenseId)
  if (!expense || expense.groupId !== group.id) return EXPENSE_NOT_FOUND

  const result = await getBackend().expenses.deleteExpense(expenseId)
  if (result.success) revalidateGroup(token)
  return result
}
