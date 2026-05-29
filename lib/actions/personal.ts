'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, PersonalTransaction } from '@/types'

export async function addPersonalTransaction(
  formData: unknown
): Promise<ActionResult<PersonalTransaction>> {
  const result = await getBackend().personal.addPersonalTransaction(formData)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function getPersonalTransactions(): Promise<PersonalTransaction[]> {
  return getBackend().personal.getPersonalTransactions()
}

export async function deletePersonalTransaction(id: number): Promise<ActionResult<void>> {
  const result = await getBackend().personal.deletePersonalTransaction(id)
  if (result.success) revalidatePath('/personal')
  return result
}
