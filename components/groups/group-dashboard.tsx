'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Plus, ArrowRightLeft, Share2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BalanceSummary } from '@/components/groups/balance-summary'
import { AddMemberDialog } from '@/components/groups/add-member-dialog'
import { ExpenseList } from '@/components/expenses/expense-list'
import { saveRecentGroup } from '@/components/groups/recent-groups'
import { useToast } from '@/components/ui/use-toast'
import type { GroupWithMembers, ExpenseWithParticipants } from '@/types'

interface Props {
  group: GroupWithMembers
  expenses: ExpenseWithParticipants[]
}

export function GroupDashboard({ group, expenses }: Props) {
  const { toast } = useToast()

  useEffect(() => {
    saveRecentGroup({
      token: group.token,
      name: group.name,
      visitedAt: Date.now(),
      currency: group.currency,
    })
  }, [group.token, group.name, group.currency])

  function copyGroupLink() {
    const url = `${window.location.origin}/groups/${group.token}`
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link copied!', description: 'Share this link to invite people.' })
    })
  }

  return (
    <div className="container py-8 space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{group.currency}</Badge>
            <span className="text-sm text-muted-foreground">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyGroupLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          <AddMemberDialog groupId={group.id} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button asChild>
          <Link href={`/groups/${group.token}/expenses/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/groups/${group.token}/settlements`}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Settle Up
          </Link>
        </Button>
      </div>

      {/* Members list */}
      {group.members.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Members</h2>
          <div className="flex flex-wrap gap-2">
            {group.members.map((m) => (
              <Badge key={m.id} variant="outline">
                {m.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Balance summary */}
      {group.members.length > 0 && (
        <BalanceSummary
          members={group.members}
          expenses={expenses}
          currency={group.currency}
        />
      )}

      {/* Expense list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Expenses</h2>
          <span className="text-sm text-muted-foreground">{expenses.length} total</span>
        </div>
        <ExpenseList expenses={expenses} members={group.members} currency={group.currency} />
      </div>
    </div>
  )
}
