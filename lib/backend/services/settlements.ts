import { calculateMemberBalances, calculateSettlements } from '@/lib/calculations/balances'
import type { ActionResult, MemberBalance, SettlementSuggestion } from '@/types'
import type { BackendServiceDeps } from './types'

export function createSettlementService({ repositories, now }: BackendServiceDeps) {
  return {
    async getGroupBalances(groupId: number): Promise<MemberBalance[]> {
      const data = await repositories.expenses.getBalanceData(groupId)
      return calculateMemberBalances(data.members, data.expenses)
    },

    async getSettlementSuggestions(groupId: number): Promise<SettlementSuggestion[]> {
      const data = await repositories.expenses.getBalanceData(groupId)
      const balances = calculateMemberBalances(data.members, data.expenses)
      return calculateSettlements(balances)
    },

    async markSettlementPaid(
      groupId: number,
      fromMemberId: number,
      toMemberId: number,
      amount: number
    ): Promise<ActionResult<void>> {
      await repositories.settlements.recordPaid({
        groupId,
        fromMemberId,
        toMemberId,
        amount,
        paidAt: now(),
      })

      return { success: true, data: undefined }
    },
  }
}
