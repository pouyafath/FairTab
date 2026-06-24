import { TransactionForm } from '@/components/personal/transaction-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { addPersonalTransaction } from '@/lib/actions/personal'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Add Transaction' }

export default function NewTransactionPage() {
  return (
    <div className="container max-w-md py-12">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Add transaction</CardTitle>
          <CardDescription>Track your income or expense.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm addTransactionAction={addPersonalTransaction} />
        </CardContent>
      </Card>
    </div>
  )
}
