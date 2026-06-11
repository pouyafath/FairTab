'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import { findGroupForToken } from '@/lib/actions/authorize'
import type { ActionResult, Group, GroupMember } from '@/types'

const GROUP_NOT_FOUND = { success: false as const, error: 'Group not found' }
const MEMBER_NOT_FOUND = { success: false as const, error: 'Member not found in this group' }

function revalidateGroup(token: string) {
  revalidatePath('/groups')
  revalidatePath(`/groups/${token}`)
}

export async function createGroup(formData: unknown): Promise<ActionResult<Group>> {
  const result = await getBackend().groups.createGroup(formData)
  if (result.success) revalidatePath('/groups')
  return result
}

export async function renameGroup(
  token: string,
  formData: unknown
): Promise<ActionResult<Group>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const result = await getBackend().groups.renameGroup(group.id, formData)
  if (result.success) revalidateGroup(token)
  return result
}

export async function deleteGroup(token: string): Promise<ActionResult<void>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const result = await getBackend().groups.deleteGroup(group.id)
  if (result.success) revalidateGroup(token)
  return result
}

export async function addGroupMember(
  token: string,
  formData: unknown
): Promise<ActionResult<GroupMember>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const result = await getBackend().groups.addGroupMember(group.id, formData)
  if (result.success) revalidateGroup(token)
  return result
}

export async function updateGroupMember(
  token: string,
  memberId: number,
  formData: unknown
): Promise<ActionResult<GroupMember>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND
  if (!group.members.some((member) => member.id === memberId)) return MEMBER_NOT_FOUND

  const result = await getBackend().groups.updateMember(memberId, formData)
  if (result.success) revalidateGroup(token)
  return result
}

export async function removeGroupMember(
  token: string,
  memberId: number
): Promise<ActionResult<void>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND
  if (!group.members.some((member) => member.id === memberId)) return MEMBER_NOT_FOUND

  const result = await getBackend().groups.removeMember(group.id, memberId)
  if (result.success) revalidateGroup(token)
  return result
}

export async function archiveGroup(
  token: string,
  archive: boolean
): Promise<ActionResult<Group>> {
  const group = await findGroupForToken(token)
  if (!group) return GROUP_NOT_FOUND

  const result = await getBackend().groups.archiveGroup(group.id, archive)
  if (result.success) revalidateGroup(token)
  return result
}
