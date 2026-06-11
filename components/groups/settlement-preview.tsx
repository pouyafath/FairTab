'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { calculateMemberBalances, calculateSettlements } from '@/lib/calculations/balances'
import { formatCurrency } from '@/lib/formatting'
import type { GroupMember, ExpenseWithParticipants } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  members: GroupMember[]
  expenses: ExpenseWithParticipants[]
  currency: string
  groupToken: string
}

export function SettlementPreview({ members, expenses, currency, groupToken }: Props) {
  const suggestions = useMemo(() => {
    if (expenses.length === 0) return []
    const rawExpenses = expenses.map((e) => ({
      paidById: e.paidById,
      totalAmount: e.amount,
      participantShares: e.participants.map((p) => ({
        memberId: p.memberId,
        amountCents: p.amountCents,
      })),
    }))
    const balances = calculateMemberBalances(members, rawExpenses)
    return calculateSettlements(balances)
  }, [members, expenses])

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
