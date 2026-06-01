'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, MemberBalance, Settlement, SettlementSuggestion } from '@/types'

export async function getGroupBalances(groupId: number): Promise<MemberBalance[]> {
  return getBackend().settlements.getGroupBalances(groupId)
}

export async function getSettlementSuggestions(
  groupId: number
): Promise<SettlementSuggestion[]> {
  return getBackend().settlements.getSettlementSuggestions(groupId)
}

export async function getPaidSettlements(groupId: number): Promise<Settlement[]> {
  return getBackend().settlements.getPaidSettlements(groupId)
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

export async function undoSettlement(settlementId: number): Promise<ActionResult<void>> {
  const result = await getBackend().settlements.undoSettlement(settlementId)
  if (result.success) revalidatePath('/groups')
  return result
}
