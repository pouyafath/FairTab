'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency, generateInteracMessage } from '@/lib/formatting'
import { useToast } from '@/components/ui/use-toast'
import type { SettlementSuggestion } from '@/types'
import type { MarkSettlementPaidAction } from '@/types/actions'

interface Props {
  settlements: SettlementSuggestion[]
  groupId: number
  groupName: string
  currency: string
  markSettlementPaidAction: MarkSettlementPaidAction
}

export function SettlementsView({
  settlements,
  groupId,
  groupName,
  currency,
  markSettlementPaidAction,
}: Props) {
  const [paid, setPaid] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function settlementKey(s: SettlementSuggestion) {
    return `${s.fromMember.id}-${s.toMember.id}`
  }

  function copyInteracMessage(s: SettlementSuggestion) {
    const msg = generateInteracMessage(s.amount, s.toMember.name, groupName, currency)
    navigator.clipboard.writeText(msg).then(() => {
      const key = settlementKey(s)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
      toast({ title: 'Copied to clipboard', description: msg })
    })
  }

  function handleMarkPaid(s: SettlementSuggestion) {
    const key = settlementKey(s)
    startTransition(async () => {
      const result = await markSettlementPaidAction(
        groupId,
        s.fromMember.id,
        s.toMember.id,
        s.amount
      )
      if (result.success) {
        setPaid((prev) => new Set(Array.from(prev).concat(key)))
        toast({
          title: 'Settlement recorded',
          description: `${s.fromMember.name} → ${s.toMember.name}`,
        })
      }
    })
  }

  if (settlements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="rounded-full bg-green-100 p-4 inline-flex mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="font-semibold text-lg">All settled up!</h3>
        <p className="text-muted-foreground mt-1">No outstanding balances in this group.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          These are suggested settlements to balance the group. FairTab does not process payments —
          use Interac e-Transfer or cash to settle.
        </AlertDescription>
      </Alert>

      {settlements.map((s) => {
        const key = settlementKey(s)
        const isPaid = paid.has(key)
        const isCopied = copied === key
        const interacMsg = generateInteracMessage(s.amount, s.toMember.name, groupName, currency)

        return (
          <Card key={key} className={isPaid ? 'opacity-60' : ''}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-semibold">{s.fromMember.name}</span>
                    <span className="text-muted-foreground mx-2">pays</span>
                    <span className="font-semibold">{s.toMember.name}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  <span className="font-bold text-lg">{formatCurrency(s.amount, currency)}</span>
                  {isPaid && <Badge variant="success">Paid</Badge>}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyInteracMessage(s)}
                    disabled={isPaid}
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {isCopied ? 'Copied' : 'Copy Interac'}
                  </Button>
                  <Button
                    size="sm"
                    variant={isPaid ? 'secondary' : 'default'}
                    onClick={() => handleMarkPaid(s)}
                    disabled={isPaid || isPending}
                  >
                    {isPaid ? 'Paid' : 'Mark Paid'}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3 italic">{interacMsg}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
