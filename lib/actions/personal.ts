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

export async function getPersonalTransaction(id: number): Promise<PersonalTransaction | null> {
  return getBackend().personal.getPersonalTransaction(id)
}

export async function getPersonalTransactions(): Promise<PersonalTransaction[]> {
  return getBackend().personal.getPersonalTransactions()
}

export async function updatePersonalTransaction(
  id: number,
  formData: unknown
): Promise<ActionResult<PersonalTransaction>> {
  const result = await getBackend().personal.updatePersonalTransaction(id, formData)
  if (result.success) revalidatePath('/personal')
  return result
}

export async function deletePersonalTransaction(id: number): Promise<ActionResult<void>> {
  const result = await getBackend().personal.deletePersonalTransaction(id)
  if (result.success) revalidatePath('/personal')
  return result
}
