import { allocate } from './money';

/** One person's part of an expense or payment. */
export interface Share {
  memberId: string;
  paid: number;
  owed: number;
}

/** An expense or a payment. Payments are just entries where one person paid and another "owed". */
export interface LedgerEntry {
  currency: string;
  shares: Share[];
}

export interface Transfer {
  from: string;
  to: string;
  currency: string;
  amount: number;
}

/** currency -> memberId -> net balance (positive = others owe them, negative = they owe). */
export type NetBalances = Map<string, Map<string, number>>;

export function netBalances(entries: LedgerEntry[]): NetBalances {
  const result: NetBalances = new Map();
  for (const entry of entries) {
    let byMember = result.get(entry.currency);
    if (!byMember) result.set(entry.currency, (byMember = new Map()));
    for (const s of entry.shares) {
      byMember.set(s.memberId, (byMember.get(s.memberId) ?? 0) + s.paid - s.owed);
    }
  }
  return result;
}

/**
 * Turns net balances into a short list of payments that settles everyone.
 * Greedy: the biggest debtor pays the biggest creditor. This needs at most n-1 payments.
 */
export function simplifyDebts(balances: NetBalances): Transfer[] {
  const transfers: Transfer[] = [];
  for (const [currency, byMember] of balances) {
    const creditors = [...byMember].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
    const debtors = [...byMember].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
    const byAmount = (a: { id: string; v: number }, b: { id: string; v: number }) => b.v - a.v || a.id.localeCompare(b.id);
    while (creditors.length && debtors.length) {
      creditors.sort(byAmount);
      debtors.sort(byAmount);
      const c = creditors[0];
      const d = debtors[0];
      const amount = Math.min(c.v, d.v);
      transfers.push({ from: d.id, to: c.id, currency, amount });
      c.v -= amount;
      d.v -= amount;
      if (c.v === 0) creditors.shift();
      if (d.v === 0) debtors.shift();
    }
  }
  return transfers;
}

/**
 * Who owes whom without simplification: inside each entry, every person who owes money
 * owes the people who paid, proportionally to how much they paid. Results are netted per pair,
 * so between two people there is at most one transfer per currency.
 * Groups with "simplify debts" turned off use this (see groupTransfers in lib/ledger.ts).
 */
export function pairwiseDebts(entries: LedgerEntry[]): Transfer[] {
  // key "from\u0000to\u0000currency" -> amount, kept with from < to; negative means reversed.
  const pairs = new Map<string, number>();
  const add = (from: string, to: string, currency: string, amount: number) => {
    const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1];
    const key = `${a}\u0000${b}\u0000${currency}`;
    pairs.set(key, (pairs.get(key) ?? 0) + sign * amount);
  };

  for (const entry of entries) {
    const nets = new Map<string, number>();
    for (const s of entry.shares) nets.set(s.memberId, (nets.get(s.memberId) ?? 0) + s.paid - s.owed);
    const creditors = [...nets].filter(([, v]) => v > 0);
    const debtors = [...nets].filter(([, v]) => v < 0);
    if (!creditors.length) continue;
    const weights = creditors.map(([, v]) => v);
    for (const [debtor, v] of debtors) {
      const parts = allocate(-v, weights);
      creditors.forEach(([creditor], i) => {
        if (parts[i] > 0) add(debtor, creditor, entry.currency, parts[i]);
      });
    }
  }

  const result: Transfer[] = [];
  for (const [key, amount] of pairs) {
    if (amount === 0) continue;
    const [a, b, currency] = key.split('\u0000');
    result.push(amount > 0 ? { from: a, to: b, currency, amount } : { from: b, to: a, currency, amount: -amount });
  }
  return result;
}

/** Checks the basic invariant every entry must satisfy: total paid equals total owed. */
export function isBalanced(shares: Share[]): boolean {
  const paid = shares.reduce((a, s) => a + s.paid, 0);
  const owed = shares.reduce((a, s) => a + s.owed, 0);
  return paid === owed && paid > 0 && shares.every((s) => s.paid >= 0 && s.owed >= 0);
}
