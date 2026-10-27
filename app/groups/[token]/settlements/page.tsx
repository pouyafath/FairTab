export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBackend } from '@/lib/backend/runtime'
import { markSettlementPaid, undoSettlement } from '@/lib/actions/settlements'
import { SettlementsView } from '@/components/groups/settlements-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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

  if (group.isArchived) {
    return (
      <div className="container max-w-2xl py-8 sm:py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/groups/${token}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {group.name}
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Settle Up</CardTitle>
            <CardDescription>
              This group is archived. Unarchive it before recording settlements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href={`/groups/${token}`}>Back to group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [suggestions, paidSettlements] = await Promise.all([
    backend.settlements.getSettlementSuggestions(group.id),
    backend.settlements.getPaidSettlements(group.id),
  ])

  const memberNames = Object.fromEntries(group.members.map((m) => [m.id, m.name]))

  return (
    <div className="container max-w-3xl py-8 sm:py-10">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/groups/${token}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {group.name}
          </Link>
        </Button>
      </div>
      <div className="mb-6">
        <p className="section-kicker mb-2">Settlement center</p>
        <h1 className="text-3xl font-bold">Settle Up</h1>
        <p className="mt-2 text-muted-foreground">
          Suggested transfers to balance the group.
        </p>
      </div>
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
