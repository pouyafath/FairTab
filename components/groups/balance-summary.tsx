'use client'

import { useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { calculateMemberBalances } from '@/lib/calculations/balances'
import { formatCurrency } from '@/lib/formatting'
import type { GroupMember, ExpenseWithParticipants, Settlement } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  members: GroupMember[]
  expenses: ExpenseWithParticipants[]
  paidSettlements?: Settlement[]
  currency?: string
}

export function BalanceSummary({ members, expenses, paidSettlements = [], currency = 'CAD' }: Props) {
  const balances = useMemo(() => {
    const rawExpenses = expenses.map((e) => ({
      paidById: e.paidById,
      totalAmount: e.amount,
      participantShares: e.participants.map((p) => ({
        memberId: p.memberId,
        amountCents: p.amountCents,
      })),
    }))
    return calculateMemberBalances(members, rawExpenses, paidSettlements)
  }, [members, expenses, paidSettlements])

  const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0)
  const allSettled = expenses.length > 0 && balances.every((b) => b.netBalance === 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Balances</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total: {formatCurrency(totalSpending, currency)}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 pb-4">No members yet.</p>
        ) : allSettled ? (
          <div className="flex items-center gap-3 px-6 py-4 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">All settled up!</p>
              <p className="text-xs text-muted-foreground">Everyone is even.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {balances.map((b) => (
              <div key={b.member.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className="font-medium text-sm">{b.member.name}</span>
                  <p className="text-xs text-muted-foreground">
                    Paid {formatCurrency(b.totalPaid, currency)}
                  </p>
                </div>
                <span
                  className={cn(
                    'font-semibold text-sm',
                    b.netBalance > 0
                      ? 'text-green-600 dark:text-green-400'
                      : b.netBalance < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                  )}
                >
                  {b.netBalance > 0 ? '+' : ''}
                  {formatCurrency(b.netBalance, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
