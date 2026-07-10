import type { RecurringFrequency } from '@/types'

/**
 * Computes the next occurrence date after advancing by one interval.
 * Month-end safe: Jan 31 + 1 month → Feb 28/29; Feb 29 + 1 year → Feb 28.
 *
 * `anchorDay` is the day-of-month the schedule was created with. Passing it
 * keeps a clamped occurrence from becoming the new anchor: without it,
 * Jan 31 → Feb 28 → Mar 28 forever; with it, Feb 28 → Mar 31.
 */
export function nextDate(
  date: Date,
  frequency: RecurringFrequency,
  interval: number,
  anchorDay?: number | null
): Date {
  const d = new Date(date)
  const targetDay = anchorDay ?? d.getDate()

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14 * interval)
      break
    case 'monthly': {
      d.setDate(1)
      d.setMonth(d.getMonth() + interval)
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(targetDay, maxDay))
      break
    }
    case 'yearly': {
      const month = d.getMonth()
      d.setDate(1)
      d.setFullYear(d.getFullYear() + interval)
      d.setMonth(month)
      const maxDay = new Date(d.getFullYear(), month + 1, 0).getDate()
      d.setDate(Math.min(targetDay, maxDay))
      break
    }
  }

  return d
}
