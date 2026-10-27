import { currencyDecimals } from './money';

/**
 * Writes a group as the same CSV that Splitwise exports (and that splitwise-import.ts reads back):
 * Date,Description,Category,Cost,Currency,<Member 1>,<Member 2>,...
 * Each member column holds (paid - owed) for that row, and a "Total balance" row per currency ends the file.
 */

export interface ExportMember {
  id: string;
  name: string;
}

/** The parts of an expense or payment the export needs (the app's Expense type fits). */
export interface ExportExpense {
  kind: 'expense' | 'payment';
  description: string;
  category: string | null;
  amount: number;
  currency: string;
  spent_on: string;
  created_at?: string;
  expense_shares: { member_id: string; paid: number; owed: number }[];
}

export function toSplitwiseCsv({ members, expenses }: { members: ExportMember[]; expenses: ExportExpense[] }): string {
  // Oldest first, like Splitwise. Same-day entries keep the order they were added in.
  const sorted = [...expenses].sort(
    (a, b) => a.spent_on.localeCompare(b.spent_on) || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  );

  // Someone missing from `members` would make the rows not add up, so give them a column too.
  const columns = [...members];
  const index = new Map(columns.map((m, i) => [m.id, i]));
  for (const e of sorted) {
    for (const s of e.expense_shares) {
      if (index.has(s.member_id)) continue;
      index.set(s.member_id, columns.length);
      columns.push({ id: s.member_id, name: 'Unknown person' });
    }
  }

  const rows: string[][] = [['Date', 'Description', 'Category', 'Cost', 'Currency', ...uniqueNames(columns)]];
  const totals = new Map<string, number[]>();
  for (const e of sorted) {
    const nets = columns.map(() => 0);
    for (const s of e.expense_shares) nets[index.get(s.member_id) ?? 0] += s.paid - s.owed;
    const total = totals.get(e.currency) ?? columns.map(() => 0);
    totals.set(e.currency, total);
    for (let i = 0; i < nets.length; i++) total[i] += nets[i];
    rows.push([
      e.spent_on,
      safeText(e.description),
      safeText(e.kind === 'payment' ? 'Payment' : e.category ?? ''),
      toDecimal(e.amount, e.currency),
      e.currency,
      ...nets.map((n) => toDecimal(n, e.currency)),
    ]);
  }
  if (totals.size > 0) rows.push([]);
  for (const currency of [...totals.keys()].sort()) {
    rows.push(['', 'Total balance', '', '', currency, ...(totals.get(currency) ?? []).map((n) => toDecimal(n, currency))]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

/** Header names, made unique the way the importer does it ("Alex", "Alex (2)"), so nobody's column is merged. */
function uniqueNames(members: ExportMember[]): string[] {
  const used = new Set<string>();
  return members.map((m) => {
    const base = safeText(m.name.trim() || 'Unnamed');
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base} (${n})`;
    used.add(name);
    return name;
  });
}

/** Minor units as a plain decimal: 1234 USD -> "12.34", -5 USD -> "-0.05", 1200 JPY -> "1200". */
function toDecimal(minor: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  const sign = minor < 0 ? '-' : '';
  const digits = String(Math.abs(minor)).padStart(decimals + 1, '0');
  return decimals ? `${sign}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : `${sign}${digits}`;
}

/**
 * Spreadsheet apps run a cell that starts with = + - @ (or a tab / carriage return) as a formula,
 * which someone could abuse with a crafted expense name. A leading ' makes it plain text.
 * Only used for text; numbers like "-12.50" are left alone.
 */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** "Cottage trip-2026-10-27.csv": the group name and a date, without characters that file systems refuse. */
export function exportFileName(groupName: string, date: string): string {
  const chars = Array.from(groupName.trim(), (ch) => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? '-' : ch));
  const name = chars.slice(0, 100).join('').replace(/^[.\s]+/, '').trim();
  return `${name || 'FairTab'}-${date}.csv`;
}
