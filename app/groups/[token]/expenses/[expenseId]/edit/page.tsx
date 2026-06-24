export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getBackend } from '@/lib/backend/runtime'
import { updateExpense } from '@/lib/actions/expenses'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string; expenseId: string }>
}

export const metadata: Metadata = { title: 'Edit Expense' }

export default async function EditExpensePage({ params }: Props) {
  const { token, expenseId } = await params
  const backend = getBackend()
  const group = await backend.groups.getGroupByToken(token)
  if (!group) notFound()

  const expense = await backend.expenses.getExpense(Number(expenseId))
  if (!expense || expense.groupId !== group.id) notFound()

  if (group.isArchived) {
    return (
      <div className="container max-w-md py-12">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Edit Expense</CardTitle>
            <CardDescription>
              This group is archived. Unarchive it before editing expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={`/groups/${token}`} className="text-primary underline">
              Back to group
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-lg py-12">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Edit Expense</CardTitle>
          <CardDescription>{group.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            groupToken={group.token}
            members={group.members}
            defaultCurrency={group.currency}
            updateExpenseAction={updateExpense}
            expense={expense}
          />
        </CardContent>
      </Card>
    </div>
  )
}
