'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Target, Minus } from 'lucide-react'
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
import {
  formatCurrency,
  dollarsToCentsString,
  dateInputToTimestamp,
  timestampToDateInput,
} from '@/lib/formatting'
import { CURRENCIES } from '@/lib/constants'
import { readDefaultCurrency } from '@/lib/settings'
import type { SavingsGoal } from '@/types'
import type {
  addSavingsGoal as AddGoalAction,
  updateSavingsGoal as UpdateGoalAction,
  contributeSavingsGoal as ContributeAction,
  deleteSavingsGoal as DeleteGoalAction,
} from '@/lib/actions/savings'

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 80) return 'bg-yellow-400'
  return 'bg-primary'
}

function onTrackHint(goal: SavingsGoal): string | null {
  if (!goal.targetDate) return null
  const now = Date.now()
  const remaining = goal.targetDate - now
  if (remaining <= 0) return goal.currentAmount >= goal.targetAmount ? 'Goal reached!' : 'Past due'
  const monthsLeft = remaining / (1000 * 60 * 60 * 24 * 30.44)
  const needed = goal.targetAmount - goal.currentAmount
  if (needed <= 0) return 'Goal reached!'
  const perMonth = Math.ceil(needed / monthsLeft)
  return `${formatCurrency(perMonth, goal.currency)}/mo to reach by ${new Date(goal.targetDate).toLocaleDateString()}`
}

interface GoalFormProps {
  goal?: SavingsGoal
  addAction: typeof AddGoalAction
  updateAction: typeof UpdateGoalAction
  onDone: () => void
}

function GoalForm({ goal, addAction, updateAction, onDone }: GoalFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const [name, setName] = useState(goal?.name ?? '')
  const [targetStr, setTargetStr] = useState(goal ? (goal.targetAmount / 100).toFixed(2) : '')
  const [currency, setCurrency] = useState(goal?.currency ?? readDefaultCurrency())
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate ? timestampToDateInput(goal.targetDate) : ''
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const targetAmount = dollarsToCentsString(targetStr)
    if (targetAmount <= 0) {
      setError('Please enter a valid target amount')
      return
    }

    const payload = {
      name,
      targetAmount,
      currency,
      targetDate: targetDate ? dateInputToTimestamp(targetDate) : null,
    }

    startTransition(async () => {
      const result = goal
        ? await updateAction(goal.id, payload)
        : await addAction(payload)

      if (!result.success) {
        setError(result.error)
        return
      }

      toast({ title: goal ? 'Goal updated' : 'Savings goal added' })
      onDone()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">Goal name</Label>
        <Input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency fund, Vacation"
          required
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="goal-target">Target amount</Label>
          <Input
            id="goal-target"
            type="number"
            min="0.01"
            step="0.01"
            value={targetStr}
            onChange={(e) => setTargetStr(e.target.value)}
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

      <div className="space-y-1.5">
        <Label htmlFor="goal-date">Target date (optional)</Label>
        <Input
          id="goal-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : goal ? 'Update goal' : 'Add goal'}
        </Button>
      </div>
    </form>
  )
}

interface ContributeFormProps {
  goal: SavingsGoal
  contributeAction: typeof ContributeAction
  onDone: () => void
}

function ContributeForm({ goal, contributeAction, onDone }: ContributeFormProps) {
  const [isPending, startTransition] = useTransition()
  const [amountStr, setAmountStr] = useState('')
  const [isWithdrawal, setIsWithdrawal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const abs = dollarsToCentsString(amountStr)
    if (abs <= 0) { setError('Enter a valid amount'); return }
    const amount = isWithdrawal ? -abs : abs

    startTransition(async () => {
      const result = await contributeAction(goal.id, amount)
      if (!result.success) { setError(result.error); return }
      toast({ title: isWithdrawal ? 'Withdrawn from goal' : 'Added to goal' })
      onDone()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Direction</Label>
        <div className="flex gap-2">
          <Button type="button" variant={!isWithdrawal ? 'default' : 'outline'} size="sm" onClick={() => setIsWithdrawal(false)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Deposit
          </Button>
          <Button type="button" variant={isWithdrawal ? 'default' : 'outline'} size="sm" onClick={() => setIsWithdrawal(true)}>
            <Minus className="h-3.5 w-3.5 mr-1" /> Withdraw
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contrib-amount">Amount ({goal.currency})</Label>
        <Input
          id="contrib-amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isWithdrawal ? 'Withdraw' : 'Deposit'}
        </Button>
      </div>
    </form>
  )
}

interface Props {
  goals: SavingsGoal[]
  addAction: typeof AddGoalAction
  updateAction: typeof UpdateGoalAction
  contributeAction: typeof ContributeAction
  deleteAction: typeof DeleteGoalAction
}

export function SavingsGoals({ goals, addAction, updateAction, contributeAction, deleteAction }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleDelete(id: number, name: string) {
    startTransition(async () => {
      await deleteAction(id)
      toast({ title: `Deleted: ${name}` })
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Savings Goals</h2>
          {goals.length > 0 && (
            <Badge variant="secondary" className="text-xs">{goals.length}</Badge>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>New savings goal</DialogTitle></DialogHeader>
            <GoalForm addAction={addAction} updateAction={updateAction} onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="rounded-full bg-muted p-3">
            <Target className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            No goals yet — track progress toward a house deposit, vacation, emergency fund, and
            more.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
            const hint = onTrackHint(goal)

            return (
              <div key={goal.id} className="rounded-lg border p-3 bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{goal.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(goal.currentAmount, goal.currency)} of {formatCurrency(goal.targetAmount, goal.currency)}
                      {' '}
                      <span className={`font-semibold ${pct >= 100 ? 'text-green-600 dark:text-green-400' : pct >= 80 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                        ({pct}%)
                      </span>
                    </p>
                    {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setContributeGoal(goal)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Deposit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setEditGoal(goal)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit {goal.name}</span>
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
                          <span className="sr-only">Delete {goal.name}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete savings goal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &ldquo;{goal.name}&rdquo; and its progress will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(goal.id, goal.name)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${progressColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editGoal !== null} onOpenChange={(v) => { if (!v) setEditGoal(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit goal</DialogTitle></DialogHeader>
          {editGoal && (
            <GoalForm
              goal={editGoal}
              addAction={addAction}
              updateAction={updateAction}
              onDone={() => setEditGoal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Contribute dialog */}
      <Dialog open={contributeGoal !== null} onOpenChange={(v) => { if (!v) setContributeGoal(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{contributeGoal?.name}</DialogTitle>
          </DialogHeader>
          {contributeGoal && (
            <ContributeForm
              goal={contributeGoal}
              contributeAction={contributeAction}
              onDone={() => setContributeGoal(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
