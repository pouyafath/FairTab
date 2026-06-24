export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getPersonalTransaction, updatePersonalTransaction } from '@/lib/actions/personal'
import { TransactionForm } from '@/components/personal/transaction-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Edit Transaction' }

export default async function EditTransactionPage({ params }: Props) {
  const { id } = await params
  const transaction = await getPersonalTransaction(Number(id))
  if (!transaction) notFound()

  return (
    <div className="container max-w-lg py-12">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Edit transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            transaction={transaction}
            updateTransactionAction={updatePersonalTransaction}
          />
        </CardContent>
      </Card>
    </div>
  )
}
