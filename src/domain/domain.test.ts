import { describe, expect, it } from 'vitest';
import {
  allocate, computeOwed, formatMoney, isBalanced, netBalances, pairwiseDebts,
  parseAmount, parseSplitwiseCsv, simplifyDebts, SplitError, type LedgerEntry,
} from './index';

describe('parseAmount', () => {
  it.each([
    ['12', 'USD', 1200],
    ['12.5', 'USD', 1250],
    ['12,50', 'EUR', 1250],
    ['1,234.56', 'USD', 123456],
    ['1.234,56', 'EUR', 123456],
    ['1,234,567', 'USD', 123456700],
    ['0.005', 'USD', 1],
    ['1500', 'JPY', 1500],
    ['۱۲۰۰۰', 'IRR', 12000],
    ['1.234', 'KWD', 1234],
    ['1.234', 'EUR', 123400],
    ['12.345.678', 'EUR', 1234567800],
    ['1.500', 'IRR', 1500],
    ['0.125', 'USD', 13],
    ['.5', 'USD', 50],
  ])('%s %s -> %i', (input, currency, expected) => {
    expect(parseAmount(input, currency)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.2.3x', '12$'])('rejects %j', (input) => {
    expect(parseAmount(input, 'USD')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats with currency decimals', () => {
    expect(formatMoney(1234, 'USD', 'en-US')).toBe('$12.34');
    expect(formatMoney(1500, 'JPY', 'en-US')).toBe('¥1,500');
  });
});

describe('allocate', () => {
  it('always sums to the total', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [1, 2])).toEqual([333, 667]);
    for (let total = 1; total < 200; total++) {
      expect(allocate(total, [3, 1, 7]).reduce((a, b) => a + b)).toBe(total);
    }
  });
  it('rejects zero weights', () => {
    expect(() => allocate(10, [0, 0])).toThrow();
  });
});

describe('computeOwed', () => {
  const people = ['a', 'b', 'c'].map((memberId) => ({ memberId }));

  it('splits equally with the extra cent going to the first person', () => {
    expect(computeOwed(1000, 'equal', people)).toEqual({ a: 334, b: 333, c: 333 });
  });
  it('accepts exact amounts that add up', () => {
    expect(computeOwed(1000, 'exact', [{ memberId: 'a', value: 700 }, { memberId: 'b', value: 300 }]))
      .toEqual({ a: 700, b: 300 });
  });
  it('rejects exact amounts that do not add up', () => {
    expect(() => computeOwed(1000, 'exact', [{ memberId: 'a', value: 700 }])).toThrow(SplitError);
  });
  it('splits by percent', () => {
    expect(computeOwed(1000, 'percent', [{ memberId: 'a', value: 50 }, { memberId: 'b', value: 25 }, { memberId: 'c', value: 25 }]))
      .toEqual({ a: 500, b: 250, c: 250 });
    expect(() => computeOwed(1000, 'percent', [{ memberId: 'a', value: 50 }])).toThrow(/100%/);
  });
  it('splits by shares and drops people with zero', () => {
    expect(computeOwed(900, 'shares', [{ memberId: 'a', value: 2 }, { memberId: 'b', value: 1 }, { memberId: 'c', value: 0 }]))
      .toEqual({ a: 600, b: 300 });
  });
  it('rejects bad input', () => {
    expect(() => computeOwed(0, 'equal', people)).toThrow();
    expect(() => computeOwed(100, 'equal', [])).toThrow();
    expect(() => computeOwed(100, 'equal', [{ memberId: 'a' }, { memberId: 'a' }])).toThrow();
  });
});

// a pays 30 for a, b, c. b pays 12 for b and c. c pays a back 5.
const ledger: LedgerEntry[] = [
  { currency: 'USD', shares: [{ memberId: 'a', paid: 3000, owed: 1000 }, { memberId: 'b', paid: 0, owed: 1000 }, { memberId: 'c', paid: 0, owed: 1000 }] },
  { currency: 'USD', shares: [{ memberId: 'b', paid: 1200, owed: 600 }, { memberId: 'c', paid: 0, owed: 600 }] },
  { currency: 'USD', shares: [{ memberId: 'c', paid: 500, owed: 0 }, { memberId: 'a', paid: 0, owed: 500 }] },
  { currency: 'EUR', shares: [{ memberId: 'b', paid: 800, owed: 400 }, { memberId: 'a', paid: 0, owed: 400 }] },
];

describe('balances', () => {
  it('computes net balances per currency', () => {
    const nets = netBalances(ledger);
    expect(Object.fromEntries(nets.get('USD')!)).toEqual({ a: 1500, b: -400, c: -1100 });
    expect(Object.fromEntries(nets.get('EUR')!)).toEqual({ b: 400, a: -400 });
  });

  it('simplifies debts into the fewest payments that settle everything', () => {
    const transfers = simplifyDebts(netBalances(ledger));
    expect(transfers).toEqual([
      { from: 'c', to: 'a', currency: 'USD', amount: 1100 },
      { from: 'b', to: 'a', currency: 'USD', amount: 400 },
      { from: 'a', to: 'b', currency: 'EUR', amount: 400 },
    ]);
  });

  it('settling the simplified transfers brings everyone to zero', () => {
    const settle: LedgerEntry[] = simplifyDebts(netBalances(ledger)).map((t) => ({
      currency: t.currency,
      shares: [{ memberId: t.from, paid: t.amount, owed: 0 }, { memberId: t.to, paid: 0, owed: t.amount }],
    }));
    for (const byMember of netBalances([...ledger, ...settle]).values()) {
      for (const v of byMember.values()) expect(v).toBe(0);
    }
  });

  it('computes pairwise debts netted per pair', () => {
    const debts = pairwiseDebts(ledger);
    const find = (from: string, to: string, currency = 'USD') =>
      debts.find((d) => d.from === from && d.to === to && d.currency === currency)?.amount;
    expect(find('b', 'a')).toBe(1000);
    expect(find('c', 'a')).toBe(500); // owed 1000, paid back 500
    expect(find('c', 'b')).toBe(600);
    expect(find('a', 'b', 'EUR')).toBe(400);
    expect(debts).toHaveLength(4);
  });

  it('splits a debtor between several payers proportionally', () => {
    const debts = pairwiseDebts([
      { currency: 'USD', shares: [
        { memberId: 'a', paid: 600, owed: 300 },
        { memberId: 'b', paid: 300, owed: 300 },
        { memberId: 'c', paid: 0, owed: 300 },
      ] },
    ]);
    expect(debts).toEqual([{ from: 'c', to: 'a', currency: 'USD', amount: 300 }]);
  });

  it('validates entries', () => {
    expect(isBalanced(ledger[0].shares)).toBe(true);
    expect(isBalanced([{ memberId: 'a', paid: 100, owed: 0 }])).toBe(false);
  });
});

describe('parseSplitwiseCsv', () => {
  const csv = [
    'Date,Description,Category,Cost,Currency,Alice Smith,Bob,Carol',
    '',
    '2024-01-05,Dinner,Dining out,30.00,USD,20.00,-10.00,-10.00',
    '2024-01-06,"Groceries, weekly",Groceries,12.00,USD,-6.00,6.00,0.00',
    '2024-01-07,Payment,Payment,10.00,USD,0.00,10.00,-10.00',
    '2024-01-08,Taxi,Taxi,10.00,USD,6.67,-3.33,-3.34',
    '2024-01-09,Just me,General,5.00,USD,0.00,0.00,0.00',
    '2024-01-10,Hotel,Hotel,100.00,EUR,40.00,20.00,-60.00',
    '',
    ',Total balance, , ,USD,17.34,2.67,-20.01',
  ].join('\r\n');

  const result = parseSplitwiseCsv(csv);

  it('reads members and skips the total row', () => {
    expect(result.members).toEqual(['Alice Smith', 'Bob', 'Carol']);
    expect(result.entries).toHaveLength(5);
    expect(result.skipped).toEqual([{ line: 7, reason: 'does not change any balance' }]);
  });

  it('rebuilds a single-payer expense exactly', () => {
    expect(result.entries[0]).toMatchObject({
      description: 'Dinner', amount: 3000, currency: 'USD', kind: 'expense',
      shares: [
        { name: 'Alice Smith', paid: 3000, owed: 1000 },
        { name: 'Bob', paid: 0, owed: 1000 },
        { name: 'Carol', paid: 0, owed: 1000 },
      ],
    });
    expect(result.entries[1].description).toBe('Groceries, weekly');
  });

  it('marks payments', () => {
    expect(result.entries[2]).toMatchObject({
      kind: 'payment',
      shares: [{ name: 'Bob', paid: 1000, owed: 0 }, { name: 'Carol', paid: 0, owed: 1000 }],
    });
  });

  it('keeps every entry balanced and preserves each member net', () => {
    for (const e of result.entries) {
      const shares = e.shares.map((s) => ({ memberId: s.name, paid: s.paid, owed: s.owed }));
      expect(isBalanced(shares)).toBe(true);
      expect(e.shares.reduce((a, s) => a + s.paid, 0)).toBe(e.amount);
    }
    const hotel = result.entries[4];
    const net = Object.fromEntries(hotel.shares.map((s) => [s.name, s.paid - s.owed]));
    expect(net).toEqual({ 'Alice Smith': 4000, Bob: 2000, Carol: -6000 });
  });

  it('never sends an amount that differs from the shares, even with rounding in the export', () => {
    // Nets add up to -1 cent; the importer absorbs it, and the amount must follow the shares.
    const r = parseSplitwiseCsv('Date,Description,Category,Cost,Currency,A,B,C\n2024-01-01,Taxi,Taxi,10.00,EUR,10.00,-5.00,-5.01');
    expect(r.entries).toHaveLength(1);
    const e = r.entries[0];
    const paid = e.shares.reduce((a, s) => a + s.paid, 0);
    const owed = e.shares.reduce((a, s) => a + s.owed, 0);
    expect(paid).toBe(e.amount);
    expect(owed).toBe(e.amount);
  });

  it('rejects files that are not Splitwise exports', () => {
    expect(() => parseSplitwiseCsv('a,b,c\n1,2,3')).toThrow(/Splitwise/);
  });
});
