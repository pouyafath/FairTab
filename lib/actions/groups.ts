'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { groups, groupMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createGroupSchema, addMemberSchema } from '@/lib/validations/group'
import type { ActionResult, Group, GroupMember, GroupWithMembers } from '@/types'

export async function createGroup(formData: unknown): Promise<ActionResult<Group>> {
  const parsed = createGroupSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const token = nanoid(8)
  const now = new Date()

  const [group] = await db
    .insert(groups)
    .values({ name: parsed.data.name, currency: parsed.data.currency, token, createdAt: now })
    .returning()

  revalidatePath('/groups')
  return {
    success: true,
    data: { ...group, createdAt: group.createdAt.getTime() },
  }
}

export async function getGroupByToken(token: string): Promise<GroupWithMembers | null> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.token, token),
    with: { members: true },
  })
  if (!group) return null

  return {
    ...group,
    createdAt: group.createdAt.getTime(),
    members: group.members,
  }
}

export async function addGroupMember(
  groupId: number,
  formData: unknown
): Promise<ActionResult<GroupMember>> {
  const parsed = addMemberSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const [member] = await db
    .insert(groupMembers)
    .values({
      groupId,
      name: parsed.data.name,
      email: parsed.data.email || null,
    })
    .returning()

  revalidatePath(`/groups`)
  return { success: true, data: member }
}
