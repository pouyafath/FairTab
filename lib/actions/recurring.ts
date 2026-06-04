'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, RecurringRule } from '@/types'

export async function addRecurringRule(
  formData: unknown
): Promise<ActionResult<RecurringRule>> {
  const result = await getBackend().recurring.addRecurringRule(formData)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function updateRecurringRule(
  id: number,
  formData: unknown
): Promise<ActionResult<RecurringRule>> {
  const result = await getBackend().recurring.updateRecurringRule(id, formData)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function toggleRecurringRule(
  id: number,
  active: boolean
): Promise<ActionResult<RecurringRule>> {
  const result = await getBackend().recurring.toggleRecurringRule(id, active)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function deleteRecurringRule(id: number): Promise<ActionResult<void>> {
  const result = await getBackend().recurring.deleteRecurringRule(id)
  if (result.success) revalidatePath('/personal')
  return result
}

/** Materializes any overdue recurring transactions. Returns count generated. */
export async function runRecurringAction(): Promise<number> {
  return getBackend().recurring.materializeDueRecurring(new Date())
}
