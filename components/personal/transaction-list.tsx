'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { useToast } from '@/components/ui/use-toast'
import type { PersonalTransaction } from '@/types'
import type { DeletePersonalTransactionAction } from '@/types/actions'

interface Props {
  transactions: PersonalTransaction[]
  deleteTransactionAction: DeletePersonalTransactionAction
  emptyMessage?: string
}

export function TransactionList({
  transactions,
  deleteTransactionAction,
  emptyMessage = 'No transactions in this period.',
}: Props) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  if (transactions.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">{emptyMessage}</p>
    )
  }

  function handleDelete(id: number, title: string) {
    startTransition(async () => {
      const result = await deleteTransactionAction(id)
      if (result.success) {
        toast({ title: `Deleted: ${title}` })
      } else {
        toast({ title: 'Could not delete', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <div className="space-y-2">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex flex-col gap-3 rounded-lg border bg-card/85 p-3 shadow-sm transition-colors hover:border-primary/25 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`rounded-full p-1.5 flex-shrink-0 ${
                t.type === 'income'
                  ? 'bg-green-100 dark:bg-green-950'
                  : 'bg-red-100 dark:bg-red-950'
              }`}
            >
              {t.type === 'income' ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{t.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                {t.sourceRuleId !== null && (
                  <Badge variant="secondary" className="text-xs py-0 gap-1">
                    <RefreshCw className="h-2.5 w-2.5" />
                    recurring
                  </Badge>
                )}
                {t.category && (
                  <Badge variant="outline" className="text-xs py-0">
                    {t.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full flex-shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <span
              className={`font-semibold text-sm ${
                t.type === 'income'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {t.type === 'income' ? '+' : '-'}
              {formatCurrency(t.amount, t.currency)}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground sm:h-7 sm:w-7" asChild>
                <Link href={`/personal/transactions/${t.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit {t.title}</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive sm:h-7 sm:w-7"
                onClick={() => handleDelete(t.id, t.title)}
                disabled={isPending}
                aria-label={`Delete ${t.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
