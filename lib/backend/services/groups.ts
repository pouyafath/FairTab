import { addMemberSchema, createGroupSchema, updateGroupSchema } from '@/lib/validations/group'
import type { ActionResult, Group, GroupMember, GroupWithMembers } from '@/types'
import type { BackendServiceDeps } from './types'
import { failure, validationError } from './result'

const ARCHIVED_GROUP_ERROR = 'Archived groups are read-only. Unarchive the group to make changes.'

export function createGroupService({ repositories, createId, now, storage }: BackendServiceDeps) {
  return {
    async createGroup(formData: unknown): Promise<ActionResult<Group>> {
      const parsed = createGroupSchema.safeParse(formData)
      if (!parsed.success) return validationError<Group>(parsed.error)

      const group = await repositories.groups.create({
        name: parsed.data.name,
        currency: parsed.data.currency,
        token: createId(),
        createdAt: now(),
      })

      return { success: true, data: group }
    },

    async getGroupByToken(token: string): Promise<GroupWithMembers | null> {
      return repositories.groups.findByToken(token)
    },

    async updateGroup(groupId: number, formData: unknown): Promise<ActionResult<Group>> {
      const parsed = updateGroupSchema.safeParse(formData)
      if (!parsed.success) return validationError<Group>(parsed.error)

      const existing = await repositories.groups.findById(groupId)
      if (!existing) return failure<Group>('Group not found')
      if (existing.isArchived) return failure<Group>(ARCHIVED_GROUP_ERROR)

      if (parsed.data.currency && parsed.data.currency !== existing.currency) {
        const hasExpenses = await repositories.expenses.groupHasExpenses(groupId)
        if (hasExpenses) {
          return failure<Group>(
            'Cannot change the currency of a group that already has expenses. Delete the expenses first or create a new group.'
          )
        }
      }

      const group = await repositories.groups.update(groupId, {
        name: parsed.data.name,
        currency: parsed.data.currency,
      })
      return { success: true, data: group }
    },

    async deleteGroup(groupId: number): Promise<ActionResult<void>> {
      const attachments = await repositories.attachments.findByGroup(groupId)
      for (const attachment of attachments) {
        await storage.delete(attachment.storageKey)
      }

      await repositories.groups.delete(groupId)
      return { success: true, data: undefined }
    },

    async addGroupMember(
      groupId: number,
      formData: unknown
    ): Promise<ActionResult<GroupMember>> {
      const parsed = addMemberSchema.safeParse(formData)
      if (!parsed.success) return validationError<GroupMember>(parsed.error)

      const group = await repositories.groups.findById(groupId)
      if (!group) return failure<GroupMember>('Group not found')
      if (group.isArchived) return failure<GroupMember>(ARCHIVED_GROUP_ERROR)

      const member = await repositories.groups.addMember({
        groupId,
        name: parsed.data.name,
        email: parsed.data.email || null,
      })

      return { success: true, data: member }
    },

    async updateMember(memberId: number, formData: unknown): Promise<ActionResult<GroupMember>> {
      const parsed = addMemberSchema.safeParse(formData)
      if (!parsed.success) return validationError<GroupMember>(parsed.error)

      const group = await repositories.groups.findByMemberId(memberId)
      if (!group) return failure<GroupMember>('Member not found')
      if (group.isArchived) return failure<GroupMember>(ARCHIVED_GROUP_ERROR)

      const member = await repositories.groups.updateMember(memberId, {
        name: parsed.data.name,
        email: parsed.data.email || null,
      })
      return { success: true, data: member }
    },

    async removeMember(groupId: number, memberId: number): Promise<ActionResult<void>> {
      const group = await repositories.groups.findById(groupId)
      if (!group) return failure<void>('Group not found')
      if (group.isArchived) return failure<void>(ARCHIVED_GROUP_ERROR)
      if (!group.members.some((member) => member.id === memberId)) {
        return failure<void>('Member not found in this group')
      }

      const hasExpenses = await repositories.expenses.memberHasExpenses(memberId)
      if (hasExpenses) {
        return {
          success: false,
          error: 'Cannot remove a member who is part of existing expenses. Delete or edit those expenses first.',
        }
      }
      const hasSettlements = await repositories.settlements.memberHasSettlements(memberId)
      if (hasSettlements) {
        return {
          success: false,
          error: 'Cannot remove a member with recorded settlements. Undo those settlements first.',
        }
      }
      await repositories.groups.removeMember(memberId)
      return { success: true, data: undefined }
    },

    async archiveGroup(groupId: number, archive: boolean): Promise<ActionResult<Group>> {
      const existing = await repositories.groups.findById(groupId)
      if (!existing) return failure<Group>('Group not found')

      const group = await repositories.groups.update(groupId, { isArchived: archive })
      return { success: true, data: group }
    },
  }
}
