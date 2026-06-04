'use client'

import { useMemo } from 'react'
import { formatMonth, formatCurrency } from '@/lib/formatting'
import type { ExpenseWithParticipants } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  expenses: ExpenseWithParticipants[]
  currency: string
}

export function GroupSpendingTrend({ expenses, currency }: Props) {
  const months = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const total = expenses
        .filter((e) => {
          const ed = new Date(e.date)
          return ed.getFullYear() === year && ed.getMonth() + 1 === month
        })
        .reduce((sum, e) => sum + e.amount, 0)
      return { year, month, total, label: formatMonth(year, month) }
    })
  }, [expenses])

  const maxTotal = Math.max(...months.map((m) => m.total), 1)
  const hasAnyData = months.some((m) => m.total > 0)

  if (!hasAnyData) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Monthly Spending</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5 h-20">
          {months.map((m, i) => {
            const pct = Math.max((m.total / maxTotal) * 100, m.total > 0 ? 4 : 0)
            const isLatest = i === months.length - 1
            return (
              <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: 64 }}>
                  <div
                    className={cn(
                      'w-full rounded-t transition-colors',
                      isLatest ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                    style={{ height: `${pct}%`, minHeight: m.total > 0 ? 3 : 0 }}
                    title={`${m.label}: ${formatCurrency(m.total, currency)}`}
                  />
                </div>
                <span className="text-[10px] leading-tight truncate w-full text-center text-muted-foreground">
                  {m.label.split(' ')[0]}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
