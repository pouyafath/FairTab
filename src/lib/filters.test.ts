import { describe, expect, it } from 'vitest';

import { filterExpenses, isFiltering, NO_FILTER, payerIds, usedCategories } from './filters';
import type { Expense } from './types';

function expense(id: string, fields: Partial<Expense>, payers: string[], owers: string[] = []): Expense {
  return {
    id, group_id: 'g', kind: 'expense', description: id, category: null, notes: null, amount: 100, currency: 'USD',
    spent_on: '2024-01-01', created_by: null, created_at: '2024-01-01T00:00:00Z',
    expense_shares: [
      ...payers.map((member_id) => ({ member_id, paid: 100 / payers.length, owed: 0 })),
      ...owers.map((member_id) => ({ member_id, paid: 0, owed: 100 })),
    ],
    ...fields,
  };
}

const expenses = [
  expense('dinner', { description: 'Dinner at Luigi’s', category: 'Food & Dining' }, ['a'], ['b']),
  expense('taxi', { description: 'Taxi', notes: 'Airport ride after DINNER', category: 'Transport' }, ['b'], ['a']),
  expense('hotel', { description: 'Hotel', category: 'Accommodation' }, ['a', 'b'], ['c']),
  expense('pay', { kind: 'payment', description: 'Payment' }, ['c'], ['a']),
];
const ids = (list: Expense[]) => list.map((e) => e.id);

describe('filterExpenses', () => {
  it('returns everything when no filter is set', () => {
    expect(ids(filterExpenses(expenses, NO_FILTER))).toEqual(['dinner', 'taxi', 'hotel', 'pay']);
    expect(ids(filterExpenses(expenses, { query: '   ', payerId: '', category: '' }))).toHaveLength(4);
  });

  it('searches description, notes and category, ignoring case and extra spaces', () => {
    expect(ids(filterExpenses(expenses, { query: '  dinner ' }))).toEqual(['dinner', 'taxi']);
    expect(ids(filterExpenses(expenses, { query: 'TRANSPORT' }))).toEqual(['taxi']);
    expect(ids(filterExpenses(expenses, { query: 'luigi’s' }))).toEqual(['dinner']);
    expect(ids(filterExpenses(expenses, { query: 'nothing like this' }))).toEqual([]);
  });

  it('finds every expense a person paid for, including ones with several payers', () => {
    expect(ids(filterExpenses(expenses, { payerId: 'a' }))).toEqual(['dinner', 'hotel']);
    expect(ids(filterExpenses(expenses, { payerId: 'b' }))).toEqual(['taxi', 'hotel']);
    // Owing money is not paying.
    expect(ids(filterExpenses(expenses, { payerId: 'c' }))).toEqual(['pay']);
  });

  it('matches a category exactly', () => {
    expect(ids(filterExpenses(expenses, { category: 'Transport' }))).toEqual(['taxi']);
    expect(ids(filterExpenses(expenses, { category: 'Trans' }))).toEqual([]);
    expect(ids(filterExpenses(expenses, { category: null }))).toHaveLength(4);
  });

  it('combines filters', () => {
    expect(ids(filterExpenses(expenses, { query: 'dinner', payerId: 'b', category: 'Transport' }))).toEqual(['taxi']);
    expect(ids(filterExpenses(expenses, { query: 'dinner', payerId: 'c' }))).toEqual([]);
  });
});

describe('filter helpers', () => {
  it('knows when a filter is active', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: '  ' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: 'x' })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, payerId: 'a' })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, category: 'Other' })).toBe(true);
  });

  it('lists the people who paid and the categories in use', () => {
    expect([...payerIds(expenses)].sort()).toEqual(['a', 'b', 'c']);
    expect(usedCategories(expenses)).toEqual(['Accommodation', 'Food & Dining', 'Transport']);
  });
});
