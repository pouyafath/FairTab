'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { dateInputToTimestamp, dollarsToCentsString } from '@/lib/formatting'
import {
  CURRENCIES,
  PERSONAL_INCOME_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
} from '@/lib/constants'
import { readDefaultCurrency } from '@/lib/settings'
import type { TransactionType } from '@/types'
import type { AddPersonalTransactionAction } from '@/types/actions'

interface Props {
  addTransactionAction: AddPersonalTransactionAction
}

export function TransactionForm({ addTransactionAction }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<TransactionType>('expense')
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [currency, setCurrency] = useState(readDefaultCurrency)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [accountLabel, setAccountLabel] = useState('')

  const categories = type === 'income' ? PERSONAL_INCOME_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = dollarsToCentsString(amountStr)
    if (amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    startTransition(async () => {
      const result = await addTransactionAction({
        type,
        title,
        amount,
        currency,
        date: dateInputToTimestamp(date),
        category: category || undefined,
        note: note || undefined,
        accountLabel: accountLabel || undefined,
      })

      if (result.success) {
        router.push('/personal')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Income/Expense toggle */}
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory('') }}
              className={`rounded-md border py-2.5 text-sm font-medium transition-colors capitalize ${
                type === t
                  ? t === 'income'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-destructive text-white border-destructive'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-title">Description *</Label>
        <Input
          id="tx-title"
          placeholder={type === 'income' ? 'e.g. Monthly salary' : 'e.g. Grocery run'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="tx-amount">Amount *</Label>
          <Input
            id="tx-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-date">Date</Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-account">Account / Label (optional)</Label>
        <Input
          id="tx-account"
          placeholder="e.g. Chequing, Credit Card"
          value={accountLabel}
          onChange={(e) => setAccountLabel(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-note">Note (optional)</Label>
        <Input
          id="tx-note"
          placeholder="Any extra details"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/personal')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !title || !amountStr} className="flex-1">
          {isPending ? 'Saving…' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
        </Button>
      </div>
    </form>
  )
}
