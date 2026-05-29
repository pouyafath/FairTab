'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { settlements, groupMembers, expenses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { calculateMemberBalances, calculateSettlements } from '@/lib/calculations/balances'
import type { ActionResult, MemberBalance, SettlementSuggestion } from '@/types'

export async function getGroupBalances(groupId: number): Promise<MemberBalance[]> {
  const db = getDb()
  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
  })

  const expenseRows = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupId),
    with: { participants: true },
  })

  const rawExpenses = expenseRows.map((e) => ({
    paidById: e.paidById,
    totalAmount: e.amount,
    participantShares: e.participants.map((p) => ({
      memberId: p.memberId,
      amountCents: p.amountCents,
    })),
  }))

  return calculateMemberBalances(members, rawExpenses)
}

export async function getSettlementSuggestions(
  groupId: number
): Promise<SettlementSuggestion[]> {
  const balances = await getGroupBalances(groupId)
  return calculateSettlements(balances)
}

export async function markSettlementPaid(
  groupId: number,
  fromMemberId: number,
  toMemberId: number,
  amount: number
): Promise<ActionResult<void>> {
  const db = getDb()
  await db.insert(settlements).values({
    groupId,
    fromMemberId,
    toMemberId,
    amount,
    isPaid: true,
    paidAt: new Date(),
  })

  revalidatePath(`/groups`)
  return { success: true, data: undefined }
}
