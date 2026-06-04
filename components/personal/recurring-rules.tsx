'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, TrendingUp, TrendingDown, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate, dollarsToCentsString, dateInputToTimestamp } from '@/lib/formatting'
import { CURRENCIES, PERSONAL_INCOME_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES } from '@/lib/constants'
import { readDefaultCurrency } from '@/lib/settings'
import type { RecurringRule, TransactionType, RecurringFrequency } from '@/types'
import type {
  addRecurringRule as AddRuleAction,
  updateRecurringRule as UpdateRuleAction,
  toggleRecurringRule as ToggleRuleAction,
  deleteRecurringRule as DeleteRuleAction,
} from '@/lib/actions/recurring'

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

interface RuleFormProps {
  rule?: RecurringRule
  addAction: typeof AddRuleAction
  updateAction: typeof UpdateRuleAction
  onDone: () => void
}

function RuleForm({ rule, addAction, updateAction, onDone }: RuleFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense')
  const [title, setTitle] = useState(rule?.title ?? '')
  const [amountStr, setAmountStr] = useState(rule ? (rule.amount / 100).toFixed(2) : '')
  const [currency, setCurrency] = useState(rule?.currency ?? readDefaultCurrency())
  const [category, setCategory] = useState(rule?.category ?? '')
  const [note, setNote] = useState(rule?.note ?? '')
  const [accountLabel, setAccountLabel] = useState(rule?.accountLabel ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency ?? 'monthly')
  const [intervalCount, setIntervalCount] = useState(String(rule?.intervalCount ?? 1))
  const [startDate, setStartDate] = useState(
    rule
      ? new Date(rule.nextRunDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )

  const categories = type === 'income' ? PERSONAL_INCOME_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = dollarsToCentsString(amountStr)
    if (amount <= 0) {
      setError('Please enter a valid amount')
      return
    }
    const interval = parseInt(intervalCount, 10)
    if (!Number.isFinite(interval) || interval < 1) {
      setError('Interval must be at least 1')
      return
    }

    const payload = {
      type,
      title,
      amount,
      currency,
      category: category || undefined,
      note: note || undefined,
      accountLabel: accountLabel || undefined,
      frequency,
      intervalCount: interval,
      startDate: dateInputToTimestamp(startDate),
    }

    startTransition(async () => {
      const result = rule
        ? await updateAction(rule.id, payload)
        : await addAction(payload)

      if (!result.success) {
        setError(result.error)
        return
      }

      toast({ title: rule ? 'Rule updated' : 'Recurring rule added' })
      onDone()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {/* Type */}
      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="flex gap-2">
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <Button
              key={t}
              type="button"
              variant={type === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setType(t); setCategory('') }}
            >
              {t === 'income' ? <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> : <TrendingDown className="h-3.5 w-3.5 mr-1.5" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-title">Title</Label>
        <Input
          id="rec-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Rent, Salary"
          required
        />
      </div>

      {/* Amount + Currency */}
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="rec-amount">Amount</Label>
          <Input
            id="rec-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="w-28 space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Frequency + Interval */}
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(FREQUENCY_LABELS) as [RecurringFrequency, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24 space-y-1.5">
          <Label htmlFor="rec-interval">Every N</Label>
          <Input
            id="rec-interval"
            type="number"
            min="1"
            value={intervalCount}
            onChange={(e) => setIntervalCount(e.target.value)}
          />
        </div>
      </div>

      {/* Start / Next date */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-start">Next run date</Label>
        <Input
          id="rec-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Note + Account */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rec-note">Note</Label>
          <Input id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-account">Account</Label>
          <Input id="rec-account" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : rule ? 'Update rule' : 'Add rule'}
        </Button>
      </div>
    </form>
  )
}

interface Props {
  rules: RecurringRule[]
  addAction: typeof AddRuleAction
  updateAction: typeof UpdateRuleAction
  toggleAction: typeof ToggleRuleAction
  deleteAction: typeof DeleteRuleAction
}

export function RecurringRules({ rules, addAction, updateAction, toggleAction, deleteAction }: Props) {
  const [open, setOpen] = useState(false)
  const [editRule, setEditRule] = useState<RecurringRule | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleToggle(rule: RecurringRule, active: boolean) {
    startTransition(async () => {
      await toggleAction(rule.id, active)
      toast({ title: active ? `"${rule.title}" enabled` : `"${rule.title}" paused` })
    })
  }

  function handleDelete(id: number, title: string) {
    startTransition(async () => {
      await deleteAction(id)
      toast({ title: `Deleted: ${title}` })
    })
  }

  const dialogOpen = open || editRule !== null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Recurring Rules</h2>
          {rules.length > 0 && (
            <Badge variant="secondary" className="text-xs">{rules.length}</Badge>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setOpen(false); setEditRule(null) } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editRule ? 'Edit rule' : 'New recurring rule'}</DialogTitle>
            </DialogHeader>
            <RuleForm
              rule={editRule ?? undefined}
              addAction={addAction}
              updateAction={updateAction}
              onDone={() => { setOpen(false); setEditRule(null) }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No rules yet — add one to auto-generate rent, salary, subscriptions, and more.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 bg-card ${!rule.active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`rounded-full p-1.5 flex-shrink-0 ${rule.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {rule.type === 'income'
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{rule.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs font-semibold ${rule.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {rule.type === 'income' ? '+' : '-'}{formatCurrency(rule.amount, rule.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rule.intervalCount > 1
                        ? `Every ${rule.intervalCount} ${rule.frequency === 'weekly' ? 'weeks' : rule.frequency === 'biweekly' ? '2-week periods' : rule.frequency === 'monthly' ? 'months' : 'years'}`
                        : FREQUENCY_LABELS[rule.frequency]}
                    </span>
                    <span className="text-xs text-muted-foreground">· next {formatDate(rule.nextRunDate)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${rule.active ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => handleToggle(rule, !rule.active)}
                  disabled={isPending}
                  aria-label={rule.active ? 'Pause rule' : 'Enable rule'}
                  title={rule.active ? 'Pause' : 'Resume'}
                >
                  {rule.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setEditRule(rule)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit {rule.title}</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete {rule.title}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete recurring rule?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{rule.title}&rdquo; will be removed. Already-generated transactions are kept.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(rule.id, rule.title)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
