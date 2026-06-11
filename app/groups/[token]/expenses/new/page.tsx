export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getBackend } from '@/lib/backend/runtime'
import { addExpense } from '@/lib/actions/expenses'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata: Metadata = { title: 'Add Expense' }

export default async function NewExpensePage({ params }: Props) {
  const { token } = await params
  const group = await getBackend().groups.getGroupByToken(token)
  if (!group) notFound()

  if (group.members.length === 0) {
    return (
      <div className="container py-12 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Add Expense</CardTitle>
            <CardDescription>
              You need at least one member before adding an expense.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={`/groups/${token}`} className="text-primary underline">
              ← Back to group
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-12 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
          <CardDescription>{group.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            groupToken={group.token}
            members={group.members}
            defaultCurrency={group.currency}
            addExpenseAction={addExpense}
          />
        </CardContent>
      </Card>
    </div>
  )
}
