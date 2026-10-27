import type { GroupMember, MemberBalance, RawExpenseData, SettlementSuggestion } from '@/types'

export type { RawExpenseData }

export interface PaidSettlementData {
  fromMemberId: number
  toMemberId: number
  amount: number // cents
}

/**
 * Compute net balance for each member.
 * Positive = group owes them; negative = they owe the group.
 * A recorded settlement (from → to) raises the payer's net and lowers the
 * recipient's net, so settled debt stops appearing as owed.
 */
export function calculateMemberBalances(
  members: GroupMember[],
  expenses: RawExpenseData[],
  paidSettlements: PaidSettlementData[] = []
): MemberBalance[] {
  const paid = new Map<number, number>()
  const owed = new Map<number, number>()
  const settledNet = new Map<number, number>()

  for (const m of members) {
    paid.set(m.id, 0)
    owed.set(m.id, 0)
    settledNet.set(m.id, 0)
  }

  for (const expense of expenses) {
    // paidBy gets credited for the full expense amount
    paid.set(expense.paidById, (paid.get(expense.paidById) ?? 0) + expense.totalAmount)

    // each participant is debited their share
    for (const share of expense.participantShares) {
      owed.set(share.memberId, (owed.get(share.memberId) ?? 0) + share.amountCents)
    }
  }

  for (const settlement of paidSettlements) {
    settledNet.set(
      settlement.fromMemberId,
      (settledNet.get(settlement.fromMemberId) ?? 0) + settlement.amount
    )
    settledNet.set(
      settlement.toMemberId,
      (settledNet.get(settlement.toMemberId) ?? 0) - settlement.amount
    )
  }

  return members.map((member) => {
    const totalPaid = paid.get(member.id) ?? 0
    const totalOwed = owed.get(member.id) ?? 0
    return {
      member,
      totalPaid,
      totalOwed,
      netBalance: totalPaid - totalOwed + (settledNet.get(member.id) ?? 0),
    }
  })
}

/**
 * Greedy debt simplification: produces the minimum number of settlements.
 */
export function calculateSettlements(balances: MemberBalance[]): SettlementSuggestion[] {
  const nets = balances.map((b) => ({ member: b.member, balance: b.netBalance }))

  const creditors = nets.filter((n) => n.balance > 0).sort((a, b) => b.balance - a.balance)
  const debtors = nets.filter((n) => n.balance < 0).sort((a, b) => a.balance - b.balance)

  const settlements: SettlementSuggestion[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debt = debtors[di]
    const amount = Math.min(credit.balance, Math.abs(debt.balance))

    if (amount > 0) {
      settlements.push({ fromMember: debt.member, toMember: credit.member, amount })
    }

    credit.balance -= amount
    debt.balance += amount

    if (credit.balance <= 0) ci++
    if (debt.balance >= 0) di++
  }

  return settlements
}
