export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getBackend } from '@/lib/backend/runtime'
import {
  addGroupMember,
  archiveGroup,
  deleteGroup,
  removeGroupMember,
  renameGroup,
  updateGroupMember,
} from '@/lib/actions/groups'
import { deleteExpense } from '@/lib/actions/expenses'
import { deleteAttachment } from '@/lib/actions/attachments'
import { GroupDashboard } from '@/components/groups/group-dashboard'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const group = await getBackend().groups.getGroupByToken(token)
  return { title: group ? group.name : 'Group not found' }
}

export default async function GroupPage({ params }: Props) {
  const { token } = await params
  const backend = getBackend()
  const group = await backend.groups.getGroupByToken(token)
  if (!group) notFound()

  const expenses = await backend.expenses.getGroupExpenses(group.id)
  const storageEnabled = backend.storage.isEnabled()

  return (
    <GroupDashboard
      group={group}
      expenses={expenses}
      addMemberAction={addGroupMember}
      deleteExpenseAction={deleteExpense}
      deleteAttachmentAction={deleteAttachment.bind(null, token)}
      renameGroupAction={renameGroup}
      deleteGroupAction={deleteGroup}
      archiveGroupAction={archiveGroup}
      updateMemberAction={updateGroupMember}
      removeMemberAction={removeGroupMember}
      storageEnabled={storageEnabled}
    />
  )
}
