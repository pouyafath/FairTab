import { calculateMemberBalances, calculateSettlements } from '@/lib/calculations/balances'
import type { ActionResult, MemberBalance, Settlement, SettlementSuggestion } from '@/types'
import type { BackendServiceDeps } from './types'
import { failure } from './result'

export function createSettlementService({ repositories, now }: BackendServiceDeps) {
  return {
    async getGroupBalances(groupId: number): Promise<MemberBalance[]> {
      const data = await repositories.expenses.getBalanceData(groupId)
      return calculateMemberBalances(data.members, data.expenses)
    },

    async getSettlementSuggestions(groupId: number): Promise<SettlementSuggestion[]> {
      const [data, paid] = await Promise.all([
        repositories.expenses.getBalanceData(groupId),
        repositories.settlements.findPaidForGroup(groupId),
      ])
      const balances = calculateMemberBalances(data.members, data.expenses)
      const suggestions = calculateSettlements(balances)
      const paidKeys = new Set(paid.map((s) => `${s.fromMemberId}-${s.toMemberId}`))
      return suggestions.filter((s) => !paidKeys.has(`${s.fromMember.id}-${s.toMember.id}`))
    },

    async getPaidSettlements(groupId: number): Promise<Settlement[]> {
      return repositories.settlements.findPaidForGroup(groupId)
    },

    async markSettlementPaid(
      groupId: number,
      fromMemberId: number,
      toMemberId: number,
      amount: number
    ): Promise<ActionResult<void>> {
      if (!Number.isInteger(amount) || amount <= 0) {
        return failure<void>('Settlement amount must be a positive amount in cents')
      }
      if (fromMemberId === toMemberId) {
        return failure<void>('A member cannot settle with themselves')
      }

      await repositories.settlements.recordPaid({
        groupId,
        fromMemberId,
        toMemberId,
        amount,
        paidAt: now(),
      })

      return { success: true, data: undefined }
    },

    async undoSettlement(settlementId: number): Promise<ActionResult<void>> {
      await repositories.settlements.undo(settlementId)
      return { success: true, data: undefined }
    },
  }
}
