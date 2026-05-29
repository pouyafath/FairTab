import type { PersonalTransaction, PersonalSummary } from '@/types'

export function calculatePersonalSummary(
  transactions: PersonalTransaction[],
  year?: number,
  month?: number
): PersonalSummary {
  const filtered =
    year !== undefined && month !== undefined
      ? transactions.filter((t) => {
          const d = new Date(t.date)
          return d.getFullYear() === year && d.getMonth() + 1 === month
        })
      : transactions

  const totalIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = filtered
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const categoryMap = new Map<string, { amount: number; count: number }>()
  for (const t of filtered.filter((t) => t.type === 'expense')) {
    const cat = t.category ?? 'Other'
    const existing = categoryMap.get(cat) ?? { amount: 0, count: 0 }
    categoryMap.set(cat, { amount: existing.amount + t.amount, count: existing.count + 1 })
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount)

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
    byCategory,
  }
}
