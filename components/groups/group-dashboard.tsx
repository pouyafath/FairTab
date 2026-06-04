'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Plus, ArrowRightLeft, Copy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BalanceSummary } from '@/components/groups/balance-summary'
import { AddMemberDialog } from '@/components/groups/add-member-dialog'
import { GroupSettingsDialog } from '@/components/groups/group-settings-dialog'
import { MemberList } from '@/components/groups/member-list'
import { SettlementPreview } from '@/components/groups/settlement-preview'
import { ExpenseList } from '@/components/expenses/expense-list'
import { saveRecentGroup } from '@/components/groups/recent-groups'
import { useToast } from '@/components/ui/use-toast'
import type { GroupWithMembers, ExpenseWithParticipants } from '@/types'
import type {
  AddGroupMemberAction,
  DeleteExpenseAction,
  DeleteGroupAction,
  RemoveGroupMemberAction,
  RenameGroupAction,
  UpdateGroupMemberAction,
} from '@/types/actions'

interface Props {
  group: GroupWithMembers
  expenses: ExpenseWithParticipants[]
  addMemberAction: AddGroupMemberAction
  deleteExpenseAction: DeleteExpenseAction
  renameGroupAction: RenameGroupAction
  deleteGroupAction: DeleteGroupAction
  updateMemberAction: UpdateGroupMemberAction
  removeMemberAction: RemoveGroupMemberAction
}

export function GroupDashboard({
  group,
  expenses,
  addMemberAction,
  deleteExpenseAction,
  renameGroupAction,
  deleteGroupAction,
  updateMemberAction,
  removeMemberAction,
}: Props) {
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
          <GroupSettingsDialog
            group={group}
            renameGroupAction={renameGroupAction}
            deleteGroupAction={deleteGroupAction}
          />
          {group.members.length > 0 && (
            <AddMemberDialog groupId={group.id} addMemberAction={addMemberAction} />
          )}
        </div>
      </div>

      {group.members.length === 0 ? (
        /* No-members onboarding */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Add members to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Invite everyone in the group so you can track who paid what.
              </p>
            </div>
            <AddMemberDialog groupId={group.id} addMemberAction={addMemberAction} />
          </CardContent>
        </Card>
      ) : (
        <>
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
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Members</h2>
            <MemberList
              groupId={group.id}
              members={group.members}
              updateMemberAction={updateMemberAction}
              removeMemberAction={removeMemberAction}
            />
          </div>

          {/* Balance summary */}
          <BalanceSummary
            members={group.members}
            expenses={expenses}
            currency={group.currency}
          />

          {/* Settlement suggestions */}
          <SettlementPreview
            members={group.members}
            expenses={expenses}
            currency={group.currency}
            groupToken={group.token}
          />

          {/* Expense list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Expenses</h2>
              <span className="text-sm text-muted-foreground">{expenses.length} total</span>
            </div>
            <ExpenseList
              expenses={expenses}
              currency={group.currency}
              groupToken={group.token}
              deleteExpenseAction={deleteExpenseAction}
            />
          </div>
        </>
      )}
    </div>
  )
}
