import type { Expense } from '@/lib/types';

/** What the expense list on a group screen is narrowed down to. Empty values mean "everything". */
export interface ExpenseFilter {
  query: string;
  payerId: string | null;
  category: string | null;
}

export const NO_FILTER: ExpenseFilter = { query: '', payerId: null, category: null };

export function isFiltering(filter: ExpenseFilter): boolean {
  return !!filter.query.trim() || !!filter.payerId || !!filter.category;
}

/**
 * Keeps the expenses that match every filter that is set:
 * - query: found in the description, notes or category (ignoring upper/lower case);
 * - payerId: this person paid part of it (expenses can have several payers);
 * - category: exactly this category.
 */
export function filterExpenses(expenses: Expense[], { query, payerId, category }: Partial<ExpenseFilter>): Expense[] {
  const needle = (query ?? '').trim().toLowerCase();
  return expenses.filter(
    (e) =>
      (!needle || [e.description, e.notes, e.category].some((text) => text?.toLowerCase().includes(needle))) &&
      (!payerId || e.expense_shares.some((s) => s.member_id === payerId && s.paid > 0)) &&
      (!category || e.category === category),
  );
}

/** Ids of everyone who paid for at least one of these expenses, for the "Paid by" choices. */
export function payerIds(expenses: Expense[]): Set<string> {
  const ids = new Set<string>();
  for (const e of expenses) for (const s of e.expense_shares) if (s.paid > 0) ids.add(s.member_id);
  return ids;
}

/** The categories used in these expenses, sorted by name, for the "Category" choices. */
export function usedCategories(expenses: Expense[]): string[] {
  const set = new Set<string>();
  for (const e of expenses) if (e.category) set.add(e.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}
