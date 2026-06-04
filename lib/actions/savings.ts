'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, SavingsGoal } from '@/types'

export async function addSavingsGoal(formData: unknown): Promise<ActionResult<SavingsGoal>> {
  const result = await getBackend().savings.addSavingsGoal(formData)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function updateSavingsGoal(
  id: number,
  formData: unknown
): Promise<ActionResult<SavingsGoal>> {
  const result = await getBackend().savings.updateSavingsGoal(id, formData)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function contributeSavingsGoal(
  id: number,
  amount: number
): Promise<ActionResult<SavingsGoal>> {
  const result = await getBackend().savings.contributeSavingsGoal(id, { amount })
  if (result.success) revalidatePath('/personal')
  return result
}

export async function deleteSavingsGoal(id: number): Promise<ActionResult<void>> {
  const result = await getBackend().savings.deleteSavingsGoal(id)
  if (result.success) revalidatePath('/personal')
  return result
}
