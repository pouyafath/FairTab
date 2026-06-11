export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBackend } from '@/lib/backend/runtime'
import { markSettlementPaid, undoSettlement } from '@/lib/actions/settlements'
import { SettlementsView } from '@/components/groups/settlements-view'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata: Metadata = { title: 'Settle Up' }

export default async function SettlementsPage({ params }: Props) {
  const { token } = await params
  const backend = getBackend()
  const group = await backend.groups.getGroupByToken(token)
  if (!group) notFound()

  const [suggestions, paidSettlements] = await Promise.all([
    backend.settlements.getSettlementSuggestions(group.id),
    backend.settlements.getPaidSettlements(group.id),
  ])

  const memberNames = Object.fromEntries(group.members.map((m) => [m.id, m.name]))

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/groups/${token}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {group.name}
          </Link>
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-2">Settle Up</h1>
      <p className="text-muted-foreground mb-6">
        Suggested settlements to balance the group. Use Interac e-Transfer or cash to pay.
      </p>
      <SettlementsView
        suggestions={suggestions}
        paidSettlements={paidSettlements}
        memberNames={memberNames}
        groupToken={group.token}
        groupName={group.name}
        currency={group.currency}
        markSettlementPaidAction={markSettlementPaid}
        undoSettlementAction={undoSettlement}
      />
    </div>
  )
}
