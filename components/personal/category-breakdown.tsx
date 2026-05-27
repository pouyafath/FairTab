import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatting'

interface CategoryEntry {
  category: string
  amount: number
  count: number
}

interface Props {
  byCategory: CategoryEntry[]
  currency?: string
}

export function CategoryBreakdown({ byCategory, currency = 'CAD' }: Props) {
  if (byCategory.length === 0) return null

  const max = Math.max(...byCategory.map((c) => c.amount))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {byCategory.map(({ category, amount, count }) => {
          const pct = max > 0 ? (amount / max) * 100 : 0
          return (
            <div key={category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{category}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(amount, currency)}{' '}
                  <span className="text-xs">({count} tx)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
