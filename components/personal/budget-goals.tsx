'use client'

import { useState, useRef } from 'react'
import { Pencil, X, Check, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatting'
import { readBudgets, saveBudgets, type BudgetMap } from '@/lib/budget'
import { PERSONAL_EXPENSE_CATEGORIES } from '@/lib/constants'

interface CategoryEntry {
  category: string
  amount: number
}

interface Props {
  byCategory: CategoryEntry[]
  currency?: string
}

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-destructive'
  if (pct >= 80) return 'bg-yellow-500'
  return 'bg-primary'
}

export function BudgetGoals({ byCategory, currency = 'CAD' }: Props) {
  const [budgets, setBudgets] = useState<BudgetMap>(() => readBudgets())
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [addCategory, setAddCategory] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const spentByCategory = Object.fromEntries(byCategory.map((c) => [c.category, c.amount]))
  const budgetedCategories = Object.keys(budgets).sort()

  function commitEdit(category: string) {
    const cents = Math.round(parseFloat(draft) * 100)
    if (!isNaN(cents) && cents > 0) {
      const next = { ...budgets, [category]: cents }
      setBudgets(next)
      saveBudgets(next)
    }
    setEditing(null)
  }

  function removeBudget(category: string) {
    const next = { ...budgets }
    delete next[category]
    setBudgets(next)
    saveBudgets(next)
  }

  function commitAdd() {
    const cents = Math.round(parseFloat(draft) * 100)
    if (addCategory && !isNaN(cents) && cents > 0) {
      const next = { ...budgets, [addCategory]: cents }
      setBudgets(next)
      saveBudgets(next)
    }
    setAdding(false)
    setAddCategory('')
    setDraft('')
  }

  function startEdit(category: string) {
    setDraft((budgets[category] / 100).toFixed(2))
    setEditing(category)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const availableCategories = (PERSONAL_EXPENSE_CATEGORIES as readonly string[]).filter(
    (c) => !budgets[c]
  )

  if (budgetedCategories.length === 0 && !adding) {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Set budget goals
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Budget Goals</CardTitle>
          {availableCategories.length > 0 && !adding && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgetedCategories.map((category) => {
          const spent = spentByCategory[category] ?? 0
          const budget = budgets[category]
          const pct = Math.min((spent / budget) * 100, 100)
          const isEditing = editing === category

          return (
            <div key={category}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <span className="font-medium truncate">{category}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <span className="text-muted-foreground text-xs">$</span>
                      <Input
                        ref={inputRef}
                        className="h-6 w-20 text-xs px-1"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(category)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => commitEdit(category)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={spent > budget ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                        {formatCurrency(spent, currency)} / {formatCurrency(budget, currency)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(category)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBudget(category)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                  style={{ width: `${Math.max(pct, spent > 0 ? 2 : 0)}%` }}
                />
              </div>
              {spent > budget && (
                <p className="text-xs text-destructive mt-0.5">
                  Over by {formatCurrency(spent - budget, currency)}
                </p>
              )}
            </div>
          )
        })}

        {adding && (
          <div className="flex items-center gap-2 pt-1">
            <select
              className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-2"
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
            >
              <option value="">Category…</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              className="w-24 h-8 text-sm"
              placeholder="0.00"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setAdding(false); setDraft('') }
              }}
            />
            <Button size="sm" className="h-8" onClick={commitAdd} disabled={!addCategory || !draft}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => { setAdding(false); setDraft('') }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
