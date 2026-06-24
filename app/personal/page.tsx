export const dynamic = 'force-dynamic'

import { deletePersonalTransaction, getPersonalTransactions } from '@/lib/actions/personal'
import { calculatePersonalSummary } from '@/lib/calculations/personal'
import { PersonalDashboard } from '@/components/personal/personal-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Personal Finance' }

export default async function PersonalPage() {
  const transactions = await getPersonalTransactions()
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
      />
    </div>
  )
}
