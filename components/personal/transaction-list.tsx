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
}

export function TransactionList({ transactions, deleteTransactionAction }: Props) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  if (transactions.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">No transactions in this period.</p>
    )
  }

  function handleDelete(id: number, title: string) {
    startTransition(async () => {
      await deleteTransactionAction(id)
      toast({ title: `Deleted: ${title}` })
    })
  }

  return (
    <div className="space-y-2">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-card"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`rounded-full p-1.5 flex-shrink-0 ${
                t.type === 'income' ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              {t.type === 'income' ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`font-semibold text-sm ${
                t.type === 'income' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {t.type === 'income' ? '+' : '-'}
              {formatCurrency(t.amount, t.currency)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild>
              <Link href={`/personal/transactions/${t.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Edit {t.title}</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(t.id, t.title)}
              disabled={isPending}
              aria-label={`Delete ${t.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
