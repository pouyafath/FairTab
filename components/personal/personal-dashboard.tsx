'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { calculatePersonalSummary } from '@/lib/calculations/personal'
import { generateCSV } from '@/lib/calculations/export'
import { formatMonth } from '@/lib/formatting'
import type { PersonalTransaction, PersonalSummary } from '@/types'
import type { DeletePersonalTransactionAction } from '@/types/actions'

interface Props {
  transactions: PersonalTransaction[]
  currentSummary: PersonalSummary
  currentYear: number
  currentMonth: number
  deleteTransactionAction: DeletePersonalTransactionAction
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
}: Props) {
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const [selectedKey, setSelectedKey] = useState(`${currentYear}-${currentMonth}`)

  const [selYear, selMonth] = selectedKey.split('-').map(Number)

  const summary = useMemo(
    () =>
      selYear === currentYear && selMonth === currentMonth
        ? currentSummary
        : calculatePersonalSummary(transactions, selYear, selMonth),
    [selYear, selMonth, transactions, currentSummary, currentYear, currentMonth]
  )

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date)
        return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
      }),
    [transactions, selYear, selMonth]
  )

  function handleExport() {
    const csv = generateCSV(transactions)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fairtab-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Personal Finance</h1>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-44">
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={transactions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" asChild>
            <Link href="/personal/transactions/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Link>
          </Button>
        </div>
      </div>

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

      {/* Transaction list */}
      <div>
        <h2 className="font-semibold mb-3">Transactions</h2>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filteredTransactions.length})</TabsTrigger>
            <TabsTrigger value="income">
              Income ({filteredTransactions.filter((t) => t.type === 'income').length})
            </TabsTrigger>
            <TabsTrigger value="expenses">
              Expenses ({filteredTransactions.filter((t) => t.type === 'expense').length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <TransactionList
              transactions={filteredTransactions}
              deleteTransactionAction={deleteTransactionAction}
            />
          </TabsContent>
          <TabsContent value="income">
            <TransactionList
              transactions={filteredTransactions.filter((t) => t.type === 'income')}
              deleteTransactionAction={deleteTransactionAction}
            />
          </TabsContent>
          <TabsContent value="expenses">
            <TransactionList
              transactions={filteredTransactions.filter((t) => t.type === 'expense')}
              deleteTransactionAction={deleteTransactionAction}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
