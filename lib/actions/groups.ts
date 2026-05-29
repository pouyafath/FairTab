'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult, Group, GroupMember, GroupWithMembers } from '@/types'

export async function createGroup(formData: unknown): Promise<ActionResult<Group>> {
  const result = await getBackend().groups.createGroup(formData)
  if (result.success) revalidatePath('/groups')
  return result
}

export async function getGroupByToken(token: string): Promise<GroupWithMembers | null> {
  return getBackend().groups.getGroupByToken(token)
}

export async function addGroupMember(
  groupId: number,
  formData: unknown
): Promise<ActionResult<GroupMember>> {
  const result = await getBackend().groups.addGroupMember(groupId, formData)
  if (result.success) revalidatePath('/groups')
  return result
}
