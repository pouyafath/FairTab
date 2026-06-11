'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import { findGroupForToken } from '@/lib/actions/authorize'
import type { ActionResult } from '@/types'

const GROUP_NOT_FOUND = { success: false as const, error: 'Group not found' }

function revalidateGroup(token: string) {
  revalidatePath('/groups')
  revalidatePath(`/groups/${token}`)
}

export async function markSettlementPaid(
  token: string,
  fromMemberId: number,
  toMemberId: number,
  amount: number
): Promise<ActionResult<void>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const memberIds = new Set(group.members.map((member) => member.id))
  if (!memberIds.has(fromMemberId) || !memberIds.has(toMemberId)) {
    return { success: false, error: 'Member not found in this group' }
  }

  const result = await getBackend().settlements.markSettlementPaid(
    group.id,
    fromMemberId,
    toMemberId,
    amount
  )
  if (result.success) revalidateGroup(token)
  return result
}

export async function undoSettlement(
  token: string,
  settlementId: number
): Promise<ActionResult<void>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const paid = await getBackend().settlements.getPaidSettlements(group.id)
  if (!paid.some((settlement) => settlement.id === settlementId)) {
    return { success: false, error: 'Settlement not found' }
  }

  const result = await getBackend().settlements.undoSettlement(settlementId)
  if (result.success) revalidateGroup(token)
  return result
}
