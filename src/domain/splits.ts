import { allocate, formatMoney } from './money';

export type SplitMethod = 'equal' | 'exact' | 'percent' | 'shares';

export interface SplitEntry {
  memberId: string;
  /**
   * Meaning depends on the method:
   * - equal: ignored
   * - exact: amount in minor units
   * - percent: percentage, e.g. 33.33
   * - shares: weight, e.g. 2 for "two shares"
   */
  value?: number;
}

export class SplitError extends Error {}

/**
 * Returns how much each member owes (in minor units) for an expense of `total`.
 * Pass the currency to get error messages with formatted amounts.
 */
export function computeOwed(
  total: number,
  method: SplitMethod,
  entries: SplitEntry[],
  currency?: string,
): Record<string, number> {
  const money = (minor: number) => (currency ? formatMoney(minor, currency) : String(minor));
  if (!Number.isInteger(total) || total <= 0) throw new SplitError('Amount must be greater than zero');
  if (entries.length === 0) throw new SplitError('Choose at least one person');
  if (new Set(entries.map((e) => e.memberId)).size !== entries.length) {
    throw new SplitError('A person appears twice in the split');
  }

  let parts: number[];
  switch (method) {
    case 'equal':
      parts = allocate(total, entries.map(() => 1));
      break;
    case 'exact': {
      parts = entries.map((e) => e.value ?? 0);
      if (parts.some((p) => !Number.isInteger(p) || p < 0)) throw new SplitError('Amounts cannot be negative');
      const sum = parts.reduce((a, b) => a + b, 0);
      if (sum !== total) throw new SplitError(`Amounts add up to ${money(sum)}, not ${money(total)}`);
      break;
    }
    case 'percent': {
      const pcts = entries.map((e) => e.value ?? 0);
      if (pcts.some((p) => p < 0)) throw new SplitError('Percentages cannot be negative');
      const sum = pcts.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.001) throw new SplitError(`Percentages add up to ${round2(sum)}%, not 100%`);
      parts = allocate(total, pcts);
      break;
    }
    case 'shares': {
      const weights = entries.map((e) => e.value ?? 0);
      if (weights.some((w) => w < 0)) throw new SplitError('Shares cannot be negative');
      if (weights.reduce((a, b) => a + b, 0) <= 0) throw new SplitError('Add at least one share');
      parts = allocate(total, weights);
      break;
    }
  }

  const owed: Record<string, number> = {};
  entries.forEach((e, i) => {
    if (parts[i] > 0) owed[e.memberId] = parts[i];
  });
  return owed;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
