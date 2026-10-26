import { netBalances, pairwiseDebts, simplifyDebts, type LedgerEntry, type Transfer } from '@/domain';
import type { Expense, Group, Member } from '@/lib/types';

export function toLedger(expenses: Expense[]): LedgerEntry[] {
  return expenses.map((e) => ({
    currency: e.currency,
    shares: e.expense_shares.map((s) => ({ memberId: s.member_id, paid: s.paid, owed: s.owed })),
  }));
}

/** Who should pay whom in a group, respecting the group's "simplify debts" setting. */
export function groupTransfers(group: Group, expenses: Expense[]): Transfer[] {
  const ledger = toLedger(expenses);
  return group.simplify_debts ? simplifyDebts(netBalances(ledger)) : pairwiseDebts(ledger);
}

/** Money per currency; positive means you are owed. */
export type Amounts = Record<string, number>;

export function addAmount(target: Amounts, currency: string, amount: number) {
  target[currency] = (target[currency] ?? 0) + amount;
  if (target[currency] === 0) delete target[currency];
}

export interface FriendBalance {
  /** "u:<user id>" for people with an account, "m:<member id>" for guests. */
  key: string;
  name: string;
  total: Amounts;
  byGroup: { group: Group; amounts: Amounts }[];
}

/**
 * Balances between me and every person I share a group with, added up across groups.
 * Positive = they owe me.
 */
export function friendBalances(
  userId: string,
  groups: Group[],
  members: Member[],
  expenses: Expense[],
  profileNames: Record<string, string>,
): FriendBalance[] {
  const membersById = new Map(members.map((m) => [m.id, m]));
  const friends = new Map<string, FriendBalance>();

  for (const group of groups) {
    const me = members.find((m) => m.group_id === group.id && m.user_id === userId);
    if (!me) continue;
    const groupExpenses = expenses.filter((e) => e.group_id === group.id);
    for (const t of groupTransfers(group, groupExpenses)) {
      if (t.from !== me.id && t.to !== me.id) continue;
      const otherId = t.from === me.id ? t.to : t.from;
      const other = membersById.get(otherId);
      if (!other) continue;
      const key = other.user_id ? `u:${other.user_id}` : `m:${other.id}`;
      const signed = t.to === me.id ? t.amount : -t.amount;

      let friend = friends.get(key);
      if (!friend) {
        friend = {
          key,
          name: (other.user_id && profileNames[other.user_id]) || other.display_name,
          total: {},
          byGroup: [],
        };
        friends.set(key, friend);
      }
      addAmount(friend.total, t.currency, signed);
      let entry = friend.byGroup.find((g) => g.group.id === group.id);
      if (!entry) friend.byGroup.push((entry = { group, amounts: {} }));
      addAmount(entry.amounts, t.currency, signed);
    }
  }
  return [...friends.values()]
    .filter((f) => Object.keys(f.total).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** My net position in each currency for a list of expenses. */
export function myNet(memberId: string | undefined, expenses: Expense[]): Amounts {
  const result: Amounts = {};
  if (!memberId) return result;
  for (const e of expenses) {
    for (const s of e.expense_shares) {
      if (s.member_id === memberId) addAmount(result, e.currency, s.paid - s.owed);
    }
  }
  return result;
}
