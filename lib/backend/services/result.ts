import type { ActionResult } from '@/types'
import type { ZodError } from 'zod'

export function validationError<T>(error: ZodError): ActionResult<T> {
  return { success: false, error: error.issues[0]?.message ?? 'Invalid input' }
}

export function failure<T>(error: string): ActionResult<T> {
  return { success: false, error }
}
