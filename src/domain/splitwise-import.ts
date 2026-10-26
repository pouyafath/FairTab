import { allocate, parseAmount } from './money';
import type { Share } from './balances';

/**
 * Parses the CSV that Splitwise exports for a group ("Export as spreadsheet").
 * Format: Date,Description,Category,Cost,Currency,<Member 1>,<Member 2>,...
 * Each member column holds (paid - owed) for that row. The last row is "Total balance".
 */

export interface ImportedEntry {
  date: string;
  description: string;
  category: string;
  currency: string;
  amount: number;
  kind: 'expense' | 'payment';
  /** Shares keyed by member name. */
  shares: { name: string; paid: number; owed: number }[];
}

export interface ImportResult {
  members: string[];
  entries: ImportedEntry[];
  /** Rows that were skipped, with the reason, so the user can be told. */
  skipped: { line: number; reason: string }[];
}

const FIXED_COLUMNS = ['date', 'description', 'category', 'cost', 'currency'];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseSplitwiseCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((r) =>
    FIXED_COLUMNS.every((c, i) => (r[i] ?? '').trim().toLowerCase() === c),
  );
  if (headerIndex === -1) {
    throw new Error('This does not look like a Splitwise export. Expected columns: Date, Description, Category, Cost, Currency.');
  }
  const members = rows[headerIndex].slice(FIXED_COLUMNS.length).map((m) => m.trim()).filter(Boolean);
  if (members.length === 0) throw new Error('No members found in the Splitwise export.');

  const entries: ImportedEntry[] = [];
  const skipped: ImportResult['skipped'] = [];

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    const [date = '', description = '', category = '', costText = '', currencyRaw = ''] = row.map((c) => c.trim());
    if (row.every((c) => c.trim() === '')) continue;
    if (!date && /total balance/i.test(description)) continue;
    if (!date) {
      skipped.push({ line, reason: 'missing date' });
      continue;
    }
    const currency = currencyRaw.toUpperCase();
    const amount = parseSignedAmount(costText, currency);
    if (amount === null || !/^[A-Z]{3}$/.test(currency)) {
      skipped.push({ line, reason: 'invalid cost or currency' });
      continue;
    }

    const nets: { name: string; net: number }[] = [];
    let invalid = false;
    members.forEach((name, i) => {
      const value = parseSignedAmount(row[FIXED_COLUMNS.length + i] ?? '0', currency);
      if (value === null) invalid = true;
      else nets.push({ name, net: value });
    });
    if (invalid) {
      skipped.push({ line, reason: 'invalid member amount' });
      continue;
    }

    // Rounding in the export can leave the nets off by a cent; absorb it into the largest value.
    const drift = nets.reduce((a, n) => a + n.net, 0);
    if (Math.abs(drift) > members.length) {
      skipped.push({ line, reason: 'member amounts do not add up' });
      continue;
    }
    if (drift !== 0) {
      const target = [...nets].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0];
      target.net -= drift;
    }

    const shares = reconstructShares(Math.abs(amount), nets);
    if (!shares) {
      skipped.push({ line, reason: 'does not change any balance' });
      continue;
    }
    entries.push({
      date,
      description: description || '(no description)',
      category,
      currency,
      // Use the rebuilt total (normally equal to the cost) so paid = owed = amount always holds,
      // even when the export's rounding leaves the member columns a cent away from the cost.
      amount: shares.reduce((a, s) => a + s.paid, 0),
      kind: category.toLowerCase() === 'payment' ? 'payment' : 'expense',
      shares,
    });
  }

  return { members, entries, skipped };
}

/**
 * Splitwise only exports each person's net (paid - owed). We rebuild paid/owed so that
 * the real cost is kept: people with a positive net are treated as the payers, splitting
 * the cost in proportion to their net. For the usual single-payer expense this is exact.
 */
function reconstructShares(cost: number, nets: { name: string; net: number }[]): ImportedEntry['shares'] | null {
  const positives = nets.filter((n) => n.net > 0);
  if (positives.length === 0) return null;
  const totalPositive = positives.reduce((a, n) => a + n.net, 0);
  const total = Math.max(cost, totalPositive);
  const paidParts = allocate(total, positives.map((n) => n.net));
  const paid = new Map(positives.map((n, i) => [n.name, paidParts[i]]));

  const shares = nets.map((n) => {
    const p = paid.get(n.name) ?? 0;
    return { name: n.name, paid: p, owed: p - n.net };
  });
  // Rounding may leave a payer owing -1; move that cent to the person owing the most.
  for (const s of shares) {
    if (s.owed < 0) {
      const biggest = shares.reduce((a, b) => (b.owed > a.owed ? b : a));
      biggest.owed += s.owed;
      s.owed = 0;
    }
  }
  return shares.filter((s) => s.paid > 0 || s.owed > 0);
}

function parseSignedAmount(text: string, currency: string): number | null {
  const t = text.trim();
  if (t === '') return 0;
  const negative = t.startsWith('-');
  const value = parseAmount(negative ? t.slice(1) : t, currency);
  return value === null ? null : negative ? -value : value;
}

/** Maps imported names to member ids, producing shares ready to save. */
export function toShares(entry: ImportedEntry, memberIdByName: Record<string, string>): Share[] {
  return entry.shares.map((s) => ({ memberId: memberIdByName[s.name], paid: s.paid, owed: s.owed }));
}
