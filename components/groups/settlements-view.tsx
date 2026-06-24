'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, ArrowRight, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate, generateInteracMessage } from '@/lib/formatting'
import { useToast } from '@/components/ui/use-toast'
import type { Settlement, SettlementSuggestion } from '@/types'
import type { MarkSettlementPaidAction, UndoSettlementAction } from '@/types/actions'

interface Props {
  suggestions: SettlementSuggestion[]
  paidSettlements: Settlement[]
  memberNames: Record<number, string>
  groupToken: string
  groupName: string
  currency: string
  markSettlementPaidAction: MarkSettlementPaidAction
  undoSettlementAction: UndoSettlementAction
}

export function SettlementsView({
  suggestions,
  paidSettlements: initialPaid,
  memberNames,
  groupToken,
  groupName,
  currency,
  markSettlementPaidAction,
  undoSettlementAction,
}: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function copyInteracMessage(s: SettlementSuggestion) {
    const msg = generateInteracMessage(s.amount, s.toMember.name, groupName, currency)
    navigator.clipboard.writeText(msg).then(() => {
      const key = `${s.fromMember.id}-${s.toMember.id}`
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
      toast({ title: 'Copied to clipboard', description: msg })
    })
  }

  function handleMarkPaid(s: SettlementSuggestion) {
    startTransition(async () => {
      const result = await markSettlementPaidAction(
        groupToken,
        s.fromMember.id,
        s.toMember.id,
        s.amount
      )
      if (result.success) {
        toast({ title: 'Settlement recorded', description: `${s.fromMember.name} → ${s.toMember.name}` })
        router.refresh()
      } else {
        toast({ title: 'Could not record', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleUndo(settlementId: number, fromName: string, toName: string) {
    startTransition(async () => {
      const result = await undoSettlementAction(groupToken, settlementId)
      if (result.success) {
        toast({ title: 'Settlement undone', description: `${fromName} → ${toName}` })
        router.refresh()
      } else {
        toast({ title: 'Could not undo', description: result.error, variant: 'destructive' })
      }
    })
  }

  const hasSuggestions = suggestions.length > 0
  const hasPaid = initialPaid.length > 0

  return (
    <div className="space-y-6">
      {hasSuggestions ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              These are suggested settlements to balance the group. FairTab does not process
              payments — use Interac e-Transfer or cash to settle.
            </AlertDescription>
          </Alert>

          {suggestions.map((s) => {
            const key = `${s.fromMember.id}-${s.toMember.id}`
            const isCopied = copied === key
            const interacMsg = generateInteracMessage(s.amount, s.toMember.name, groupName, currency)

            return (
              <Card key={key}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <span className="font-semibold">{s.fromMember.name}</span>
                        <span className="text-muted-foreground mx-2">pays</span>
                        <span className="font-semibold">{s.toMember.name}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                      <span className="font-bold text-lg">{formatCurrency(s.amount, currency)}</span>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInteracMessage(s)}
                        className="w-full sm:w-auto"
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
                        onClick={() => handleMarkPaid(s)}
                        disabled={isPending}
                        className="w-full sm:w-auto"
                      >
                        Mark Paid
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">{interacMsg}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="inline-flex rounded-lg bg-emerald-100 p-4 mb-4">
            <Check className="h-8 w-8 text-emerald-700" />
          </div>
          <h3 className="font-semibold text-lg">All settled up!</h3>
          <p className="text-muted-foreground mt-1">No outstanding balances in this group.</p>
        </div>
      )}

      {hasPaid && (
        <>
          {hasSuggestions && <Separator />}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Payment history</h2>
            <div className="space-y-2">
              {initialPaid.map((s) => {
                const fromName = memberNames[s.fromMemberId] ?? `Member ${s.fromMemberId}`
                const toName = memberNames[s.toMemberId] ?? `Member ${s.toMemberId}`
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-lg border bg-card/85 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{fromName}</span>
                        <span className="text-muted-foreground mx-1.5">→</span>
                        <span className="font-medium">{toName}</span>
                        <span className="ml-2 font-semibold">{formatCurrency(s.amount, currency)}</span>
                      </p>
                      {s.paidAt && (
                        <p className="text-xs text-muted-foreground">{formatDate(s.paidAt)}</p>
                      )}
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-shrink-0 sm:justify-end">
                      <Badge variant="outline" className="text-emerald-700 border-emerald-700">
                        Paid
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground"
                        onClick={() => handleUndo(s.id, fromName, toName)}
                        disabled={isPending}
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Undo
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
