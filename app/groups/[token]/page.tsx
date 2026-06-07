export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import {
  addGroupMember,
  archiveGroup,
  deleteGroup,
  getGroupByToken,
  removeGroupMember,
  renameGroup,
  updateGroupMember,
} from '@/lib/actions/groups'
import { deleteExpense, getGroupExpenses } from '@/lib/actions/expenses'
import { GroupDashboard } from '@/components/groups/group-dashboard'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const group = await getGroupByToken(token)
  return { title: group ? group.name : 'Group not found' }
}

export default async function GroupPage({ params }: Props) {
  const { token } = await params
  const group = await getGroupByToken(token)
  if (!group) notFound()

  const expenses = await getGroupExpenses(group.id)

  return (
    <GroupDashboard
      group={group}
      expenses={expenses}
      addMemberAction={addGroupMember}
      deleteExpenseAction={deleteExpense}
      renameGroupAction={renameGroup}
      deleteGroupAction={deleteGroup}
      archiveGroupAction={archiveGroup}
      updateMemberAction={updateGroupMember}
      removeMemberAction={removeGroupMember}
    />
  )
}
