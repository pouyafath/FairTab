import type { ExpenseWithParticipants, PersonalTransaction } from '@/types'
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

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function generateGroupCSV(expenses: ExpenseWithParticipants[]): string {
  const headers = [
    'Date',
    'Title',
    'Amount',
    'Currency',
    'Paid By',
    'Split Method',
    'Category',
    'Notes',
    'Participants',
  ]

  const rows = expenses.map((e) => [
    formatDate(e.date),
    csvCell(e.title),
    (e.amount / 100).toFixed(2),
    e.currency,
    csvCell(e.paidBy.name),
    e.splitMethod,
    e.category ?? '',
    csvCell(e.notes ?? ''),
    csvCell(e.participants.map((p) => p.member.name).join(', ')),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
