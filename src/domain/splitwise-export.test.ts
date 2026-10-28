import { describe, expect, it } from 'vitest';

import { netBalances } from './balances';
import { exportFileName, toSplitwiseCsv, type ExportExpense } from './splitwise-export';
import { parseCsv, parseSplitwiseCsv } from './splitwise-import';

const members = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carol' },
  { id: 'a2', name: 'Alice' }, // same name as the first Alice
  { id: 'd', name: '=HYPERLINK("http://evil")' }, // someone who left the group, with a nasty name
];

const shares = (...rows: [string, number, number][]) => rows.map(([member_id, paid, owed]) => ({ member_id, paid, owed }));

// Newest first, the way the app loads them.
const expenses: ExportExpense[] = [
  {
    // Same text as the summary row's label; it must still come back as an expense.
    kind: 'expense', description: 'Total balance', category: 'General', amount: 2000, currency: 'USD', spent_on: '2024-03-01',
    expense_shares: shares(['b', 2000, 1000], ['a2', 0, 1000]),
  },
  {
    kind: 'expense', description: '-crafted', category: '@cmd', amount: 1000, currency: 'USD', spent_on: '2024-02-01',
    expense_shares: shares(['d', 1000, 500], ['a', 0, 500]),
  },
  {
    kind: 'expense', description: 'Sushi', category: null, amount: 1200, currency: 'JPY', spent_on: '2024-01-20',
    expense_shares: shares(['a2', 1200, 400], ['b', 0, 400], ['c', 0, 400]),
  },
  {
    kind: 'expense', description: 'Wine, "the good one"\nand cheese', category: 'Food & Dining', amount: 4550,
    currency: 'EUR', spent_on: '2024-01-10', expense_shares: shares(['c', 4550, 2275], ['a', 0, 2275]),
  },
  {
    kind: 'payment', description: 'Payment', category: null, amount: 1000, currency: 'USD', spent_on: '2024-01-07',
    created_at: '2024-01-07T12:00:00Z', expense_shares: shares(['b', 1000, 0], ['c', 0, 1000]),
  },
  {
    // Two payers, uneven split.
    kind: 'expense', description: 'Hotel', category: 'Accommodation', amount: 10001, currency: 'USD',
    spent_on: '2024-01-07', created_at: '2024-01-07T09:00:00Z',
    expense_shares: shares(['a', 6000, 3334], ['b', 4001, 3334], ['c', 0, 3333]),
  },
  {
    kind: 'expense', description: 'Dinner', category: 'Food & Dining', amount: 3000, currency: 'USD', spent_on: '2024-01-05',
    expense_shares: shares(['a', 3000, 1000], ['b', 0, 1000], ['c', 0, 1000]),
  },
];

const csv = toSplitwiseCsv({ members, expenses });
const names = ['Alice', 'Bob', 'Carol', 'Alice (2)', `'=HYPERLINK("http://evil")`];
const nameOf = Object.fromEntries(members.map((m, i) => [m.id, names[i]]));

describe('toSplitwiseCsv', () => {
  it('writes the Splitwise header with unique member names', () => {
    expect(parseCsv(csv)[0]).toEqual(['Date', 'Description', 'Category', 'Cost', 'Currency', ...names]);
  });

  it('writes one row per entry, oldest first, with paid - owed per member', () => {
    const rows = parseCsv(csv);
    expect(rows.slice(1, 8).map((r) => r[1])).toEqual([
      'Dinner', 'Hotel', 'Payment', 'Wine, "the good one"\nand cheese', 'Sushi', "'-crafted", "'Total balance",
    ]);
    expect(rows[1]).toEqual(['2024-01-05', 'Dinner', 'Food & Dining', '30.00', 'USD', '20.00', '-10.00', '-10.00', '0.00', '0.00']);
    expect(rows[3]).toEqual(['2024-01-07', 'Payment', 'Payment', '10.00', 'USD', '0.00', '10.00', '-10.00', '0.00', '0.00']);
    expect(rows[5]).toEqual(['2024-01-20', 'Sushi', '', '1200', 'JPY', '0', '-400', '-400', '800', '0']);
  });

  it('ends with a "Total balance" row per currency', () => {
    const rows = parseCsv(csv);
    expect(rows.slice(-3)).toEqual([
      ['', 'Total balance', '', '', 'EUR', '-22.75', '0.00', '22.75', '0.00', '0.00'],
      ['', 'Total balance', '', '', 'JPY', '0', '-400', '-400', '800', '0'],
      ['', 'Total balance', '', '', 'USD', '41.66', '16.67', '-53.33', '-10.00', '5.00'],
    ]);
  });

  it('quotes cells with commas, quotes or line breaks', () => {
    expect(csv).toContain('"Wine, ""the good one""\nand cheese"');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('turns text that a spreadsheet would run as a formula into plain text, but leaves numbers alone', () => {
    const rows = parseCsv(csv);
    const crafted = rows[6];
    expect(crafted.slice(0, 5)).toEqual(['2024-02-01', "'-crafted", "'@cmd", '10.00', 'USD']);
    expect(crafted[5]).toBe('-5.00');
    for (const start of ['=', '+', '-', '@', '\t', '\r']) {
      const one = toSplitwiseCsv({
        members: [{ id: 'x', name: `${start}x` }, { id: 'y', name: 'y' }],
        expenses: [{ ...expenses[6], description: `${start}desc`, category: `${start}cat`, expense_shares: shares(['x', 3000, 0], ['y', 0, 3000]) }],
      });
      const [header, row] = parseCsv(one);
      // Names are trimmed first, so a leading tab or line break simply disappears.
      expect(header[5]).toBe(start.trim() ? `'${start}x` : 'x');
      expect(row.slice(1, 3)).toEqual([`'${start}desc`, `'${start}cat`]);
    }
  });

  it('keeps names unique even when a person is literally called "Alice (2)"', () => {
    const one = toSplitwiseCsv({
      members: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Alice (2)' }, { id: '3', name: ' Alice ' }, { id: '4', name: ' ' }],
      expenses: [],
    });
    expect(one).toBe('Date,Description,Category,Cost,Currency,Alice,Alice (2),Alice (3),Unnamed\n');
  });

  it('still adds up when an entry mentions someone missing from the member list', () => {
    const one = toSplitwiseCsv({ members: [{ id: 'a', name: 'Alice' }], expenses: [expenses[6]] });
    expect(parseCsv(one)[0].slice(5)).toEqual(['Alice', 'Unknown person', 'Unknown person (2)']);
    expect(parseSplitwiseCsv(one).entries).toHaveLength(1);
  });

  it('reads back with the Splitwise importer: same people, same amounts, same nets on every row', () => {
    const result = parseSplitwiseCsv(csv);
    expect(result.members).toEqual(names);
    expect(result.skipped).toEqual([]);
    const oldestFirst = [...expenses].reverse();
    expect(result.entries).toHaveLength(oldestFirst.length);
    result.entries.forEach((entry, i) => {
      const original = oldestFirst[i];
      expect(entry).toMatchObject({
        date: original.spent_on,
        currency: original.currency,
        amount: original.amount,
        kind: original.kind,
      });
      const nets = (rows: { name: string; net: number }[]) =>
        Object.fromEntries(rows.filter((r) => r.net !== 0).map((r) => [r.name, r.net]));
      expect(nets(entry.shares.map((s) => ({ name: s.name, net: s.paid - s.owed })))).toEqual(
        nets(original.expense_shares.map((s) => ({ name: nameOf[s.member_id], net: s.paid - s.owed }))),
      );
    });
    expect(result.entries[2].description).toBe('Payment');
    expect(result.entries[3].description).toBe('Wine, "the good one"\nand cheese');
    expect(result.entries[6].description).toBe("'Total balance");
  });

  it('keeps an expense called "Total balance" when imported again (the importer skips the summary row by that name)', () => {
    for (const description of ['Total balance', ' total BALANCE ', '\tTotal balance']) {
      const one = toSplitwiseCsv({
        members: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
        expenses: [{ ...expenses[6], description, expense_shares: shares(['a', 3000, 1500], ['b', 0, 1500]) }],
      });
      expect(parseCsv(one)[1][1]).toBe(`'${description}`);
      const result = parseSplitwiseCsv(one);
      expect(result.skipped).toEqual([]);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].shares).toEqual([{ name: 'Alice', paid: 3000, owed: 1500 }, { name: 'Bob', paid: 0, owed: 1500 }]);
    }
  });

  it('has totals that match the balances in the app', () => {
    const app = netBalances(expenses.map((e) => ({
      currency: e.currency,
      shares: e.expense_shares.map((s) => ({ memberId: s.member_id, paid: s.paid, owed: s.owed })),
    })));
    const imported = netBalances(parseSplitwiseCsv(csv).entries.map((e) => ({
      currency: e.currency,
      shares: e.shares.map((s) => ({ memberId: s.name, paid: s.paid, owed: s.owed })),
    })));
    for (const [currency, byMember] of app) {
      for (const [memberId, net] of byMember) {
        expect(imported.get(currency)?.get(nameOf[memberId]) ?? 0).toBe(net);
      }
    }
  });

  it('writes amounts with the right number of decimals for each currency', () => {
    const one = toSplitwiseCsv({
      members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      expenses: [
        { ...expenses[6], amount: 5, currency: 'KWD', expense_shares: shares(['a', 5, 0], ['b', 0, 5]) },
        { ...expenses[6], amount: 123456789, currency: 'CAD', expense_shares: shares(['a', 123456789, 0], ['b', 0, 123456789]) },
      ],
    });
    const rows = parseCsv(one);
    expect(rows[1].slice(3)).toEqual(['0.005', 'KWD', '0.005', '-0.005']);
    expect(rows[2].slice(3)).toEqual(['1234567.89', 'CAD', '1234567.89', '-1234567.89']);
    expect(parseSplitwiseCsv(one).entries.map((e) => e.amount)).toEqual([5, 123456789]);
  });
});

describe('exportFileName', () => {
  it('names the file after the group and the date', () => {
    expect(exportFileName('Cottage trip', '2026-10-27')).toBe('Cottage trip-2026-10-27.csv');
    expect(exportFileName('سفر شمال', '2026-10-27')).toBe('سفر شمال-2026-10-27.csv');
  });

  it('replaces characters that are not allowed in file names', () => {
    expect(exportFileName(' Rent: 2024/25 "flat"? ', '2026-10-27')).toBe('Rent- 2024-25 -flat---2026-10-27.csv');
    expect(exportFileName('..hidden', '2026-10-27')).toBe('hidden-2026-10-27.csv');
    expect(exportFileName('   ', '2026-10-27')).toBe('FairTab-2026-10-27.csv');
  });
});
