'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { personalTransactions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { addTransactionSchema } from '@/lib/validations/personal'
import type { ActionResult, PersonalTransaction } from '@/types'

export async function addPersonalTransaction(
  formData: unknown
): Promise<ActionResult<PersonalTransaction>> {
  const parsed = addTransactionSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data
  const now = new Date()

  const [tx] = await db
    .insert(personalTransactions)
    .values({
      type: data.type,
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      date: new Date(data.date),
      category: data.category ?? null,
      note: data.note ?? null,
      accountLabel: data.accountLabel ?? null,
      createdAt: now,
    })
    .returning()

  revalidatePath('/personal')
  return {
    success: true,
    data: {
      ...tx,
      date: tx.date.getTime(),
      createdAt: tx.createdAt.getTime(),
    },
  }
}

export async function getPersonalTransactions(): Promise<PersonalTransaction[]> {
  const txs = await db
    .select()
    .from(personalTransactions)
    .orderBy(desc(personalTransactions.date))

  return txs.map((t) => ({
    ...t,
    date: t.date.getTime(),
    createdAt: t.createdAt.getTime(),
  }))
}

export async function deletePersonalTransaction(id: number): Promise<ActionResult<void>> {
  await db.delete(personalTransactions).where(eq(personalTransactions.id, id))
  revalidatePath('/personal')
  return { success: true, data: undefined }
}
