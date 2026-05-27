import type { PersonalTransaction } from '@/types'
import { formatDate } from '@/lib/formatting'

export function generateCSV(transactions: PersonalTransaction[]): string {
  const headers = ['Date', 'Type', 'Title', 'Category', 'Amount (CAD)', 'Currency', 'Account', 'Note']

  const rows = transactions.map((t) => [
    formatDate(t.date),
    t.type,
    `"${t.title.replace(/"/g, '""')}"`,
    t.category ?? '',
    (t.amount / 100).toFixed(2),
    t.currency,
    t.accountLabel ?? '',
    `"${(t.note ?? '').replace(/"/g, '""')}"`,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
