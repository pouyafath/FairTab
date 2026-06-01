import type { GroupMember, MemberBalance, RawExpenseData, SettlementSuggestion } from '@/types'

export type { RawExpenseData }

/**
 * Compute net balance for each member.
 * Positive = group owes them; negative = they owe the group.
 */
export function calculateMemberBalances(
  members: GroupMember[],
  expenses: RawExpenseData[]
): MemberBalance[] {
  const paid = new Map<number, number>()
  const owed = new Map<number, number>()

  for (const m of members) {
    paid.set(m.id, 0)
    owed.set(m.id, 0)
  }

  for (const expense of expenses) {
    // paidBy gets credited for the full expense amount
    paid.set(expense.paidById, (paid.get(expense.paidById) ?? 0) + expense.totalAmount)

    // each participant is debited their share
    for (const share of expense.participantShares) {
      owed.set(share.memberId, (owed.get(share.memberId) ?? 0) + share.amountCents)
    }
  }

  return members.map((member) => {
    const totalPaid = paid.get(member.id) ?? 0
    const totalOwed = owed.get(member.id) ?? 0
    return {
      member,
      totalPaid,
      totalOwed,
      netBalance: totalPaid - totalOwed,
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

    if (credit.balance < 1) ci++
    if (Math.abs(debt.balance) < 1) di++
  }

  return settlements
}
