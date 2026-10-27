import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import type { PersonalSummary } from '@/types'

interface Props {
  summary: PersonalSummary
  currency?: string
}

export function SummaryCards({ summary, currency = 'CAD' }: Props) {
  const cards = [
    {
      label: 'Income',
      value: summary.totalIncome,
      icon: TrendingUp,
      color: 'text-emerald-700',
      bg: 'bg-emerald-100',
    },
    {
      label: 'Expenses',
      value: summary.totalExpenses,
      icon: TrendingDown,
      color: 'text-rose-700',
      bg: 'bg-rose-100',
    },
    {
      label: 'Net Balance',
      value: summary.netSavings,
      icon: Wallet,
      color: summary.netSavings >= 0 ? 'text-primary' : 'text-rose-700',
      bg: summary.netSavings >= 0 ? 'bg-primary/10' : 'bg-rose-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label} className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn('text-2xl font-bold mt-1', color)}>
                  {label === 'Net Balance' && value > 0 ? '+' : ''}
                  {formatCurrency(value, currency)}
                </p>
              </div>
              <div className={cn('rounded-lg p-3', bg)}>
                <Icon className={cn('h-5 w-5', color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
