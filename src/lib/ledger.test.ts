import { describe, expect, it } from 'vitest';

import { friendBalances, groupTransfers, myNet } from './ledger';
import type { Expense, Group, Member } from './types';

const group = (id: string, simplify = true): Group => ({
  id, name: id, default_currency: 'EUR', simplify_debts: simplify, invite_code: 'x', created_by: null, created_at: '',
});
const member = (id: string, group_id: string, user_id: string | null, display_name = id): Member => ({
  id, group_id, user_id, display_name, left_at: null,
});
let n = 0;
const expense = (group_id: string, currency: string, shares: [string, number, number][]): Expense => ({
  id: `e${n++}`, group_id, kind: 'expense', description: 'x', category: null, notes: null, currency,
  amount: shares.reduce((a, s) => a + s[1], 0), spent_on: '2026-01-01', created_by: null, created_at: '',
  expense_shares: shares.map(([member_id, paid, owed]) => ({ member_id, paid, owed })),
});

describe('friendBalances', () => {
  // Group A: me, Bob (user), Guest. Group B: me, Bob.
  const groups = [group('A'), group('B', false)];
  const members = [
    member('a-me', 'A', 'me'), member('a-bob', 'A', 'bob'), member('a-guest', 'A', null, 'Guest'),
    member('b-me', 'B', 'me'), member('b-bob', 'B', 'bob'),
  ];
  const expenses = [
    // I pay 30 for three people in A.
    expense('A', 'EUR', [['a-me', 3000, 1000], ['a-bob', 0, 1000], ['a-guest', 0, 1000]]),
    // Bob pays 10 for both of us in B.
    expense('B', 'EUR', [['b-bob', 1000, 500], ['b-me', 0, 500]]),
    // Bob pays 8 USD for me in B.
    expense('B', 'USD', [['b-bob', 800, 0], ['b-me', 0, 800]]),
  ];

  it('adds up balances per person across groups and currencies', () => {
    const result = friendBalances('me', groups, members, expenses, { bob: 'Bob B.' });
    expect(result.map((f) => [f.name, f.total])).toEqual([
      ['Bob B.', { EUR: 500, USD: -800 }],
      ['Guest', { EUR: 1000 }],
    ]);
    const bob = result[0];
    expect(bob.byGroup.map((g) => [g.group.id, g.amounts])).toEqual([
      ['A', { EUR: 1000 }],
      ['B', { EUR: -500, USD: -800 }],
    ]);
  });

  it('computes my net per group', () => {
    expect(myNet('a-me', expenses.filter((e) => e.group_id === 'A'))).toEqual({ EUR: 2000 });
    expect(myNet(undefined, expenses)).toEqual({});
  });

  it('uses pairwise debts when simplification is off', () => {
    // Bob owes me 10, I owe Carol 10. Simplified: Bob pays Carol. Pairwise: two debts.
    const g = [member('m', 'C', 'me'), member('b', 'C', 'bob'), member('c', 'C', 'carol')];
    const ex = [
      expense('C', 'EUR', [['m', 1000, 0], ['b', 0, 1000]]),
      expense('C', 'EUR', [['c', 1000, 0], ['m', 0, 1000]]),
    ];
    expect(groupTransfers(group('C', true), ex)).toEqual([{ from: 'b', to: 'c', currency: 'EUR', amount: 1000 }]);
    expect(groupTransfers(group('C', false), ex)).toHaveLength(2);
    expect(friendBalances('me', [group('C', true)], g, ex, {})).toHaveLength(0);
  });
});
