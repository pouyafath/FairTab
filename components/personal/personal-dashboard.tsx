'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SummaryCards } from './summary-cards'
import { CategoryBreakdown } from './category-breakdown'
import { SpendingTrend } from './spending-trend'
import { TransactionList } from './transaction-list'
import { RecurringRules } from './recurring-rules'
import { SavingsGoals } from './savings-goals'
import { calculatePersonalSummary } from '@/lib/calculations/personal'
import { generateCSV } from '@/lib/calculations/export'
import { formatMonth } from '@/lib/formatting'
import type { PersonalTransaction, PersonalSummary, RecurringRule, SavingsGoal } from '@/types'
import type { DeletePersonalTransactionAction } from '@/types/actions'
import type {
  addRecurringRule as AddRuleAction,
  updateRecurringRule as UpdateRuleAction,
  toggleRecurringRule as ToggleRuleAction,
  deleteRecurringRule as DeleteRuleAction,
  runRecurringAction as RunRecurringAction,
} from '@/lib/actions/recurring'
import type {
  addSavingsGoal as AddGoalAction,
  updateSavingsGoal as UpdateGoalAction,
  contributeSavingsGoal as ContributeAction,
  deleteSavingsGoal as DeleteGoalAction,
} from '@/lib/actions/savings'

interface Props {
  transactions: PersonalTransaction[]
  currentSummary: PersonalSummary
  currentYear: number
  currentMonth: number
  deleteTransactionAction: DeletePersonalTransactionAction
  rules: RecurringRule[]
  addRecurringRuleAction: typeof AddRuleAction
  updateRecurringRuleAction: typeof UpdateRuleAction
  toggleRecurringRuleAction: typeof ToggleRuleAction
  deleteRecurringRuleAction: typeof DeleteRuleAction
  runRecurringAction: typeof RunRecurringAction
  savingsGoals: SavingsGoal[]
  addSavingsGoalAction: typeof AddGoalAction
  updateSavingsGoalAction: typeof UpdateGoalAction
  contributeSavingsGoalAction: typeof ContributeAction
  deleteSavingsGoalAction: typeof DeleteGoalAction
}

function getMonthOptions() {
  const options: { label: string; year: number; month: number }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      label: formatMonth(d.getFullYear(), d.getMonth() + 1),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }
  return options
}

export function PersonalDashboard({
  transactions,
  currentSummary,
  currentYear,
  currentMonth,
  deleteTransactionAction,
  rules,
  addRecurringRuleAction,
  updateRecurringRuleAction,
  toggleRecurringRuleAction,
  deleteRecurringRuleAction,
  runRecurringAction,
  savingsGoals,
  addSavingsGoalAction,
  updateSavingsGoalAction,
  contributeSavingsGoalAction,
  deleteSavingsGoalAction,
}: Props) {
  const router = useRouter()
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const [selectedKey, setSelectedKey] = useState(`${currentYear}-${currentMonth}`)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [selYear, selMonth] = selectedKey.split('-').map(Number)

  // Materialize any overdue recurring transactions on first mount
  useEffect(() => {
    runRecurringAction().then((count) => {
      if (count > 0) router.refresh()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(
    () =>
      selYear === currentYear && selMonth === currentMonth
        ? currentSummary
        : calculatePersonalSummary(transactions, selYear, selMonth),
    [selYear, selMonth, transactions, currentSummary, currentYear, currentMonth]
  )

  const monthTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date)
        return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
      }),
    [transactions, selYear, selMonth]
  )

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          monthTransactions
            .map((transaction) => transaction.category)
            .filter((category): category is string => Boolean(category))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [monthTransactions]
  )

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return monthTransactions.filter((transaction) => {
      const matchesCategory =
        categoryFilter === 'all' || transaction.category === categoryFilter
      const searchable = [
        transaction.title,
        transaction.category,
        transaction.note,
        transaction.accountLabel,
        transaction.currency,
        transaction.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const matchesSearch =
        normalizedQuery.length === 0 || searchable.includes(normalizedQuery)

      return matchesCategory && matchesSearch
    })
  }, [monthTransactions, searchQuery, categoryFilter])

  const incomeTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'income'),
    [filteredTransactions]
  )

  const expenseTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'expense'),
    [filteredTransactions]
  )
  const hasActiveFilters = searchQuery.trim().length > 0 || categoryFilter !== 'all'
  const allTransactionsEmptyMessage =
    monthTransactions.length === 0
      ? 'No transactions in this period.'
      : 'No transactions match the current filters.'

  function handleExport() {
    const csv = generateCSV(filteredTransactions)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fairtab-transactions-${selYear}-${String(selMonth).padStart(2, '0')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleMonthChange(value: string) {
    setSelectedKey(value)
    setCategoryFilter('all')
  }

  return (
    <div className="space-y-6">
      <div className="page-panel overflow-hidden">
        <div className="flex flex-col gap-5 bg-foreground p-5 text-background sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-background/60">
              Personal ledger
            </p>
            <h1 className="mt-2 text-3xl font-bold">Personal Finance</h1>
            <p className="mt-2 max-w-xl text-sm text-background/65">
              Track monthly cash flow, review spending categories, and export the filtered view.
            </p>
          </div>
          <Button className="bg-background text-foreground hover:bg-background/90" asChild>
            <Link href="/personal/transactions/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-t bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <Select value={selectedKey} onValueChange={handleMonthChange}>
            <SelectTrigger aria-label="Report month" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Export View
          </Button>
        </div>
      </div>

      {/* First-run empty state */}
      {transactions.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="font-medium">No transactions yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add your first income or expense, or set up a recurring rule below so rent, salary,
            and subscriptions record themselves every month.
          </p>
          <Button asChild size="sm">
            <Link href="/personal/transactions/new">
              <Plus className="h-4 w-4 mr-2" />
              Add your first transaction
            </Link>
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <SummaryCards summary={summary} />

      {/* Spending trend */}
      <SpendingTrend
        transactions={transactions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* Category breakdown */}
      {summary.byCategory.length > 0 && <CategoryBreakdown byCategory={summary.byCategory} />}

      {/* Recurring rules + savings goals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4 bg-card">
          <RecurringRules
            rules={rules}
            addAction={addRecurringRuleAction}
            updateAction={updateRecurringRuleAction}
            toggleAction={toggleRecurringRuleAction}
            deleteAction={deleteRecurringRuleAction}
          />
        </div>

        <div className="rounded-lg border p-4 bg-card">
          <SavingsGoals
            goals={savingsGoals}
            addAction={addSavingsGoalAction}
            updateAction={updateSavingsGoalAction}
            contributeAction={contributeSavingsGoalAction}
            deleteAction={deleteSavingsGoalAction}
          />
        </div>
      </div>

      {/* Transaction list */}
      <div className="page-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Transactions</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search transactions"
                className="h-9 pl-8 sm:w-56"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Category filter" className="h-9 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasActiveFilters && filteredTransactions.length === 0 && (
          <div className="mb-4 rounded-lg border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground">
            No transactions match this search and category combination.
            <Button
              type="button"
              variant="link"
              className="ml-0 h-auto px-0 text-sm sm:ml-2"
              onClick={() => {
                setSearchQuery('')
                setCategoryFilter('all')
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filteredTransactions.length})</TabsTrigger>
            <TabsTrigger value="income">Income ({incomeTransactions.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({expenseTransactions.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <TransactionList
              transactions={filteredTransactions}
              deleteTransactionAction={deleteTransactionAction}
              emptyMessage={allTransactionsEmptyMessage}
            />
          </TabsContent>
          <TabsContent value="income">
            <TransactionList
              transactions={incomeTransactions}
              deleteTransactionAction={deleteTransactionAction}
              emptyMessage="No income transactions match this view."
            />
          </TabsContent>
          <TabsContent value="expenses">
            <TransactionList
              transactions={expenseTransactions}
              deleteTransactionAction={deleteTransactionAction}
              emptyMessage="No expense transactions match this view."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
