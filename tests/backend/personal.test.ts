import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateCSV } from '@/lib/calculations/export'
import { calculatePersonalSummary } from '@/lib/calculations/personal'
import type { PersonalTransaction } from '@/types'

const transactions: PersonalTransaction[] = [
  {
    id: 1,
    type: 'income',
    title: 'Paycheque',
    amount: 250000,
    currency: 'CAD',
    date: Date.UTC(2026, 4, 15, 12),
    category: 'Salary',
    note: null,
    accountLabel: 'Chequing',
    sourceRuleId: null,
    createdAt: Date.UTC(2026, 4, 15, 12),
  },
  {
    id: 2,
    type: 'expense',
    title: 'Grocery "run"',
    amount: 8450,
    currency: 'CAD',
    date: Date.UTC(2026, 4, 16, 12),
    category: 'Groceries, household',
    note: 'Used "weekly" coupons',
    accountLabel: 'Credit, Card',
    sourceRuleId: null,
    createdAt: Date.UTC(2026, 4, 16, 12),
  },
  {
    id: 3,
    type: 'expense',
    title: 'April rent',
    amount: 120000,
    currency: 'CAD',
    date: Date.UTC(2026, 3, 1, 12),
    category: 'Housing',
    note: null,
    accountLabel: 'Chequing',
    sourceRuleId: null,
    createdAt: Date.UTC(2026, 3, 1, 12),
  },
]

describe('personal finance calculations', () => {
  it('summarizes only the selected month and groups expense categories', () => {
    const summary = calculatePersonalSummary(transactions, 2026, 5)

    assert.equal(summary.totalIncome, 250000)
    assert.equal(summary.totalExpenses, 8450)
    assert.equal(summary.netSavings, 241550)
    assert.deepEqual(summary.byCategory, [
      { category: 'Groceries, household', amount: 8450, count: 1 },
    ])
  })

  it('exports CSV with escaped fields', () => {
    const csv = generateCSV(transactions.slice(1, 2))

    assert.match(csv, /^Date,Type,Title,Category,Amount,Currency,Account,Note\n/)
    assert.match(
      csv,
      /expense,"Grocery ""run""","Groceries, household",84\.50,CAD,"Credit, Card","Used ""weekly"" coupons"$/
    )
  })
})
