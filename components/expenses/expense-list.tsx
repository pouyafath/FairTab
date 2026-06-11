'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Receipt, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/formatting'
import type { ExpenseWithParticipants } from '@/types'
import type { DeleteExpenseAction } from '@/types/actions'

interface Props {
  expenses: ExpenseWithParticipants[]
  currency: string
  groupToken: string
  deleteExpenseAction: DeleteExpenseAction
}

export function ExpenseList({ expenses, currency, groupToken, deleteExpenseAction }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithParticipants | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const result = await deleteExpenseAction(groupToken, target.id)
      if (result.success) {
        toast({ title: 'Expense deleted', description: target.title })
        setDeleteTarget(null)
        router.refresh()
      } else {
        toast({ title: 'Could not delete', description: result.error, variant: 'destructive' })
      }
    })
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <Receipt className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No expenses yet. Add one to get started.</p>
      </div>
    )
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const splitMethodLabel: Record<string, string> = {
    equal: 'Split equally',
    exact: 'Exact amounts',
    percentage: 'By percentage',
    shares: 'By shares',
  }

  return (
    <div className="space-y-3">
      {expenses.map((expense) => {
        const isOpen = expanded.has(expense.id)
        return (
          <Card key={expense.id}>
            <CardContent className="p-0">
              <button
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors rounded-lg"
                onClick={() => toggle(expense.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{expense.title}</span>
                      {expense.category && (
                        <Badge variant="outline" className="text-xs">
                          {expense.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Paid by {expense.paidBy.name} · {formatDate(expense.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-semibold">{formatCurrency(expense.amount, currency)}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t px-4 pb-4 pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    {splitMethodLabel[expense.splitMethod]}
                  </p>
                  <div className="space-y-1">
                    {expense.participants.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{p.member.name}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(p.amountCents, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {expense.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{expense.notes}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/groups/${groupToken}/expenses/${expense.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(expense)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.title}" (${formatCurrency(deleteTarget.amount, currency)}) will be permanently removed. This cannot be undone.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
