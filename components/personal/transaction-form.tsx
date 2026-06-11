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
import { useDefaultCurrency } from '@/lib/settings'
import type { PersonalTransaction, TransactionType } from '@/types'
import type { AddPersonalTransactionAction, UpdatePersonalTransactionAction } from '@/types/actions'

// Sentinel for the "Custom…" select entry; never stored
const CUSTOM_CATEGORY = '__custom__'

interface Props {
  addTransactionAction?: AddPersonalTransactionAction
  updateTransactionAction?: UpdatePersonalTransactionAction
  transaction?: PersonalTransaction
}

export function TransactionForm({ addTransactionAction, updateTransactionAction, transaction }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = Boolean(transaction)

  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [title, setTitle] = useState(transaction?.title ?? '')
  const [amountStr, setAmountStr] = useState(
    transaction ? (transaction.amount / 100).toFixed(2) : ''
  )
  const defaultCurrency = useDefaultCurrency()
  // null = user has not picked one; follow the transaction's currency when
  // editing, otherwise the stored default
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null)
  const currency = currencyOverride ?? transaction?.currency ?? defaultCurrency
  const [date, setDate] = useState(
    transaction
      ? new Date(transaction.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const categories = type === 'income' ? PERSONAL_INCOME_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES

  const initialCategory = transaction?.category ?? ''
  const initialIsCustom =
    initialCategory !== '' && !(categories as readonly string[]).includes(initialCategory)
  const [categoryChoice, setCategoryChoice] = useState(
    initialIsCustom ? CUSTOM_CATEGORY : initialCategory
  )
  const [customCategory, setCustomCategory] = useState(initialIsCustom ? initialCategory : '')
  const category = categoryChoice === CUSTOM_CATEGORY ? customCategory.trim() : categoryChoice
  const [note, setNote] = useState(transaction?.note ?? '')
  const [accountLabel, setAccountLabel] = useState(transaction?.accountLabel ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = dollarsToCentsString(amountStr)
    if (amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    const payload = {
      type,
      title,
      amount,
      currency,
      date: dateInputToTimestamp(date),
      category: category || undefined,
      note: note || undefined,
      accountLabel: accountLabel || undefined,
    }

    startTransition(async () => {
      const result = isEdit && transaction && updateTransactionAction
        ? await updateTransactionAction(transaction.id, payload)
        : await addTransactionAction!(payload)

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
              onClick={() => { setType(t); setCategoryChoice(''); setCustomCategory('') }}
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
          <Select value={currency} onValueChange={setCurrencyOverride}>
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
        <Select value={categoryChoice} onValueChange={setCategoryChoice}>
          <SelectTrigger>
            <SelectValue placeholder="Select category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_CATEGORY}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {categoryChoice === CUSTOM_CATEGORY && (
          <Input
            placeholder="Your category"
            maxLength={50}
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            autoFocus
          />
        )}
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
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
        </Button>
      </div>
    </form>
  )
}
