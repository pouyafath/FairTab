'use client'

import { useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ArrowRightLeft, Copy, Users, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  ArchiveGroupAction,
  DeleteAttachmentAction,
  DeleteExpenseAction,
  DeleteGroupAction,
  RemoveGroupMemberAction,
  UpdateGroupAction,
  UpdateGroupMemberAction,
} from '@/types/actions'

interface Props {
  group: GroupWithMembers
  expenses: ExpenseWithParticipants[]
  addMemberAction: AddGroupMemberAction
  deleteExpenseAction: DeleteExpenseAction
  deleteAttachmentAction?: DeleteAttachmentAction
  updateGroupAction: UpdateGroupAction
  deleteGroupAction: DeleteGroupAction
  archiveGroupAction: ArchiveGroupAction
  updateMemberAction: UpdateGroupMemberAction
  removeMemberAction: RemoveGroupMemberAction
  storageEnabled?: boolean
}

export function GroupDashboard({
  group,
  expenses,
  addMemberAction,
  deleteExpenseAction,
  deleteAttachmentAction,
  updateGroupAction,
  deleteGroupAction,
  archiveGroupAction,
  updateMemberAction,
  removeMemberAction,
  storageEnabled,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isArchivePending, startArchiveTransition] = useTransition()

  useEffect(() => {
    saveRecentGroup({
      token: group.token,
      name: group.name,
      visitedAt: Date.now(),
      currency: group.currency,
      isArchived: group.isArchived,
    })
  }, [group.token, group.name, group.currency, group.isArchived])

  function copyGroupLink() {
    const url = `${window.location.origin}/groups/${group.token}`
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link copied!', description: 'Share this link to invite people.' })
    })
  }

  function unarchiveGroup() {
    startArchiveTransition(async () => {
      const result = await archiveGroupAction(group.token, false)
      if (result.success) {
        toast({ title: 'Group unarchived', description: 'You can add expenses again.' })
        router.refresh()
      } else {
        toast({ title: 'Could not unarchive', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <div className="container max-w-5xl space-y-6 py-8 sm:py-10">
      <div className="page-panel overflow-hidden">
        <div className="flex flex-col gap-5 bg-foreground p-5 text-background sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-background/60">
              Shared group
            </p>
            <h1 className="mt-2 truncate text-3xl font-bold">{group.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-background text-foreground hover:bg-background">
                {group.currency}
              </Badge>
              {group.isArchived && (
                <Badge className="border-white/10 bg-white/10 text-background hover:bg-white/10">
                  <Archive className="h-3 w-3 mr-1" />
                  Archived
                </Badge>
              )}
              <span className="text-sm text-background/65">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyGroupLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <GroupSettingsDialog
              group={group}
              updateGroupAction={updateGroupAction}
              deleteGroupAction={deleteGroupAction}
              archiveGroupAction={archiveGroupAction}
            />
            {!group.isArchived && group.members.length > 0 && (
              <AddMemberDialog groupToken={group.token} addMemberAction={addMemberAction} />
            )}
          </div>
        </div>
        {!group.isArchived && group.members.length > 0 && (
          <div className="flex flex-col gap-3 border-t bg-card/80 p-4 sm:flex-row sm:p-5">
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
        )}
      </div>

      {group.isArchived && (
        <Alert>
          <Archive className="h-4 w-4" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <AlertTitle>Archived group</AlertTitle>
              <AlertDescription>
                This group is read-only until it is unarchived.
              </AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={unarchiveGroup}
              disabled={isArchivePending}
              className="sm:ml-4"
            >
              {isArchivePending ? 'Unarchiving...' : 'Unarchive'}
            </Button>
          </div>
        </Alert>
      )}

      {group.members.length === 0 ? (
        /* No-members onboarding */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-lg bg-primary/10 p-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Add members to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Invite everyone in the group so you can track who paid what.
              </p>
            </div>
            {!group.isArchived && (
              <AddMemberDialog groupToken={group.token} addMemberAction={addMemberAction} />
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Members list */}
          <div className="page-panel p-4 sm:p-5">
            <h2 className="section-kicker mb-3">Members</h2>
            <MemberList
              groupToken={group.token}
              members={group.members}
              updateMemberAction={updateMemberAction}
              removeMemberAction={removeMemberAction}
              isArchived={group.isArchived}
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
            isArchived={group.isArchived}
          />

          {/* Expense list */}
          <div className="page-panel p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Expenses</h2>
              <span className="text-sm text-muted-foreground">{expenses.length} total</span>
            </div>
            <ExpenseList
              expenses={expenses}
              currency={group.currency}
              groupToken={group.token}
              deleteExpenseAction={deleteExpenseAction}
              deleteAttachmentAction={deleteAttachmentAction}
              storageEnabled={storageEnabled}
              isArchived={group.isArchived}
            />
          </div>
        </>
      )}
    </div>
  )
}
