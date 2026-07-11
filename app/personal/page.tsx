export const dynamic = 'force-dynamic'

import { deletePersonalTransaction, getPersonalTransactions } from '@/lib/actions/personal'
import {
  addRecurringRule,
  updateRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
  runRecurringAction,
} from '@/lib/actions/recurring'
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
  const [transactions, rules, savingsGoals] = await Promise.all([
    getPersonalTransactions(),
    getBackend().recurring.getRecurringRules(),
    getBackend().savings.getSavingsGoals(),
  ])
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const summary = calculatePersonalSummary(transactions, year, month)

  return (
    <div className="container max-w-5xl py-8 sm:py-10">
      <PersonalDashboard
        transactions={transactions}
        currentSummary={summary}
        currentYear={year}
        currentMonth={month}
        deleteTransactionAction={deletePersonalTransaction}
        rules={rules}
        addRecurringRuleAction={addRecurringRule}
        updateRecurringRuleAction={updateRecurringRule}
        toggleRecurringRuleAction={toggleRecurringRule}
        deleteRecurringRuleAction={deleteRecurringRule}
        runRecurringAction={runRecurringAction}
        savingsGoals={savingsGoals}
        addSavingsGoalAction={addSavingsGoal}
        updateSavingsGoalAction={updateSavingsGoal}
        contributeSavingsGoalAction={contributeSavingsGoal}
        deleteSavingsGoalAction={deleteSavingsGoal}
      />
    </div>
  )
}
