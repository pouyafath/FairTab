'use client'

import { useMemo } from 'react'
import { formatMonth } from '@/lib/formatting'
import type { PersonalTransaction } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  transactions: PersonalTransaction[]
  selectedKey: string
  onSelect: (key: string) => void
}

export function SpendingTrend({ transactions, selectedKey, onSelect }: Props) {
  const months = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const key = `${year}-${month}`
      const total = transactions
        .filter((t) => {
          if (t.type !== 'expense') return false
          const td = new Date(t.date)
          return td.getFullYear() === year && td.getMonth() + 1 === month
        })
        .reduce((sum, t) => sum + t.amount, 0)
      return { key, year, month, total, label: formatMonth(year, month) }
    })
  }, [transactions])

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
          {months.map((m) => {
            const pct = Math.max((m.total / maxTotal) * 100, m.total > 0 ? 4 : 0)
            const isSelected = m.key === selectedKey
            return (
              <button
                key={m.key}
                onClick={() => onSelect(m.key)}
                className="flex-1 flex flex-col items-center gap-1 group"
                title={`${m.label}: $${(m.total / 100).toFixed(2)}`}
              >
                <div className="w-full flex items-end" style={{ height: 64 }}>
                  <div
                    className={cn(
                      'w-full rounded-t transition-colors',
                      isSelected
                        ? 'bg-primary'
                        : 'bg-muted-foreground/20 group-hover:bg-muted-foreground/35'
                    )}
                    style={{ height: `${pct}%`, minHeight: m.total > 0 ? 3 : 0 }}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] leading-tight truncate w-full text-center',
                    isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}
                >
                  {m.label.split(' ')[0]}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
