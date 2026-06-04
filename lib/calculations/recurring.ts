import type { RecurringFrequency } from '@/types'

/**
 * Computes the next occurrence date after advancing by one interval.
 * Month-end safe: Jan 31 + 1 month → Feb 28/29; Feb 29 + 1 year → Feb 28.
 */
export function nextDate(date: Date, frequency: RecurringFrequency, interval: number): Date {
  const d = new Date(date)
  const originalDay = d.getDate()

  switch (frequency) {
    case 'weekly':
      d.setDate(originalDay + 7 * interval)
      break
    case 'biweekly':
      d.setDate(originalDay + 14 * interval)
      break
    case 'monthly': {
      d.setDate(1)
      d.setMonth(d.getMonth() + interval)
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(originalDay, maxDay))
      break
    }
    case 'yearly': {
      const month = d.getMonth()
      d.setDate(1)
      d.setFullYear(d.getFullYear() + interval)
      d.setMonth(month)
      const maxDay = new Date(d.getFullYear(), month + 1, 0).getDate()
      d.setDate(Math.min(originalDay, maxDay))
      break
    }
  }

  return d
}
