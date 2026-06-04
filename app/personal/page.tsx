export const dynamic = 'force-dynamic'

import { deletePersonalTransaction, getPersonalTransactions } from '@/lib/actions/personal'
import {
  addSavingsGoal,
  updateSavingsGoal,
  contributeSavingsGoal,
  deleteSavingsGoal,
} from '@/lib/actions/savings'
import { getBackend } from '@/lib/backend/runtime'
import { calculatePersonalSummary } from '@/lib/calculations/personal'
import { PersonalDashboard } from '@/components/personal/personal-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Personal Finance' }

export default async function PersonalPage() {
  const [transactions, savingsGoals] = await Promise.all([
    getPersonalTransactions(),
    getBackend().savings.getSavingsGoals(),
  ])
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const summary = calculatePersonalSummary(transactions, year, month)

  return (
    <div className="container py-8 max-w-3xl">
      <PersonalDashboard
        transactions={transactions}
        currentSummary={summary}
        currentYear={year}
        currentMonth={month}
        deleteTransactionAction={deletePersonalTransaction}
        savingsGoals={savingsGoals}
        addSavingsGoalAction={addSavingsGoal}
        updateSavingsGoalAction={updateSavingsGoal}
        contributeSavingsGoalAction={contributeSavingsGoal}
        deleteSavingsGoalAction={deleteSavingsGoal}
      />
    </div>
  )
}
