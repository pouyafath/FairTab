'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, MemberBalance, SettlementSuggestion } from '@/types'

export async function getGroupBalances(groupId: number): Promise<MemberBalance[]> {
  return getBackend().settlements.getGroupBalances(groupId)
}

export async function getSettlementSuggestions(
  groupId: number
): Promise<SettlementSuggestion[]> {
  return getBackend().settlements.getSettlementSuggestions(groupId)
}

export async function markSettlementPaid(
  groupId: number,
  fromMemberId: number,
  toMemberId: number,
  amount: number
): Promise<ActionResult<void>> {
  const result = await getBackend().settlements.markSettlementPaid(
    groupId,
    fromMemberId,
    toMemberId,
    amount
  )
  if (result.success) revalidatePath('/groups')
  return result
}
