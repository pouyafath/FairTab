import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'
import type { SettlementSuggestion } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  suggestions: SettlementSuggestion[]
  currency: string
  groupToken: string
}

export function SettlementPreview({ suggestions, currency, groupToken }: Props) {
  if (suggestions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Who owes what</CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7 px-2">
            <Link href={`/groups/${groupToken}/settlements`}>
              Settle Up
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{s.fromMember.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{s.toMember.name}</span>
              </div>
              <span className="font-semibold text-sm tabular-nums">
                {formatCurrency(s.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
