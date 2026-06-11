import type { PersonalTransaction } from '@/types'
import { formatDate } from '@/lib/formatting'

// Integer-only cents → "12.34" so no floating-point math touches money values.
function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function generateCSV(transactions: PersonalTransaction[]): string {
  const headers = ['Date', 'Type', 'Title', 'Category', 'Amount', 'Currency', 'Account', 'Note']

  const rows = transactions.map((t) => [
    formatDate(t.date),
    t.type,
    `"${t.title.replace(/"/g, '""')}"`,
    t.category ?? '',
    centsToDecimal(t.amount),
    t.currency,
    t.accountLabel ?? '',
    `"${(t.note ?? '').replace(/"/g, '""')}"`,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
