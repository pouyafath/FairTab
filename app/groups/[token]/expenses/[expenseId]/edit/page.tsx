export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getGroupByToken } from '@/lib/actions/groups'
import { getExpense, updateExpense } from '@/lib/actions/expenses'
import { deleteAttachment } from '@/lib/actions/attachments'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getBackend } from '@/lib/backend/runtime'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string; expenseId: string }>
}

export const metadata: Metadata = { title: 'Edit Expense' }

export default async function EditExpensePage({ params }: Props) {
  const { token, expenseId } = await params
  const group = await getGroupByToken(token)
  if (!group) notFound()

  const expense = await getExpense(Number(expenseId))
  if (!expense || expense.groupId !== group.id) notFound()

  const storageEnabled = getBackend().storage.isEnabled()

  return (
    <div className="container py-12 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Edit Expense</CardTitle>
          <CardDescription>{group.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            groupId={group.id}
            groupToken={group.token}
            members={group.members}
            defaultCurrency={group.currency}
            updateExpenseAction={updateExpense}
            expense={expense}
            storageEnabled={storageEnabled}
            deleteAttachmentAction={deleteAttachment.bind(null, token)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
