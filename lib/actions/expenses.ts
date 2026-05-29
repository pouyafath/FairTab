'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { expenses, expenseParticipants } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { addExpenseSchema } from '@/lib/validations/expense'
import { calculateSplits } from '@/lib/calculations/split'
import type { ActionResult, Expense, ExpenseWithParticipants } from '@/types'

export async function addExpense(
  groupId: number,
  formData: unknown
): Promise<ActionResult<Expense>> {
  const db = getDb()
  const parsed = addExpenseSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data
  let splits
  try {
    splits = calculateSplits(data.amount, data.splitMethod, data.participants)
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const now = new Date()

  const [expense] = await db
    .insert(expenses)
    .values({
      groupId,
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      paidById: data.paidById,
      date: new Date(data.date),
      category: data.category ?? null,
      notes: data.notes ?? null,
      splitMethod: data.splitMethod,
      createdAt: now,
    })
    .returning()

  await db.insert(expenseParticipants).values(
    splits.map((s) => ({
      expenseId: expense.id,
      memberId: s.memberId,
      shareValue: s.shareValue,
      amountCents: s.amountCents,
    }))
  )

  revalidatePath(`/groups`)
  return {
    success: true,
    data: {
      ...expense,
      date: (expense.date as Date).getTime(),
      createdAt: (expense.createdAt as Date).getTime(),
    },
  }
}

export async function getGroupExpenses(groupId: number): Promise<ExpenseWithParticipants[]> {
  const db = getDb()
  const rows = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupId),
    with: {
      participants: { with: { member: true } },
      paidBy: true,
    },
    orderBy: [desc(expenses.date)],
  })

  return rows.map((e) => {
    const expense = e as typeof e & {
      date: Date
      createdAt: Date
      participants: Array<typeof e.participants[number] & { member: typeof e.paidBy }>
      paidBy: { id: number; groupId: number; name: string; email: string | null }
    }
    return {
      ...e,
      date: expense.date.getTime(),
      createdAt: expense.createdAt.getTime(),
      participants: e.participants.map((p) => ({
        ...p,
        member: (p as typeof p & { member: { id: number; groupId: number; name: string; email: string | null } }).member,
      })),
      paidBy: e.paidBy as { id: number; groupId: number; name: string; email: string | null },
    }
  })
}
