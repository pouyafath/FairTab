import { addMemberSchema, createGroupSchema, updateGroupSchema } from '@/lib/validations/group'
import type { ActionResult, Group, GroupMember, GroupWithMembers } from '@/types'
import type { BackendServiceDeps } from './types'
import { validationError } from './result'

export function createGroupService({ repositories, createId, now }: BackendServiceDeps) {
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

    async renameGroup(groupId: number, formData: unknown): Promise<ActionResult<Group>> {
      const parsed = updateGroupSchema.safeParse(formData)
      if (!parsed.success) return validationError<Group>(parsed.error)

      const group = await repositories.groups.update(groupId, { name: parsed.data.name })
      return { success: true, data: group }
    },

    async deleteGroup(groupId: number): Promise<ActionResult<void>> {
      await repositories.groups.delete(groupId)
      return { success: true, data: undefined }
    },

    async addGroupMember(
      groupId: number,
      formData: unknown
    ): Promise<ActionResult<GroupMember>> {
      const parsed = addMemberSchema.safeParse(formData)
      if (!parsed.success) return validationError<GroupMember>(parsed.error)

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

      const member = await repositories.groups.updateMember(memberId, {
        name: parsed.data.name,
        email: parsed.data.email || null,
      })
      return { success: true, data: member }
    },

    async removeMember(groupId: number, memberId: number): Promise<ActionResult<void>> {
      const hasExpenses = await repositories.expenses.memberHasExpenses(memberId)
      if (hasExpenses) {
        return {
          success: false,
          error: 'Cannot remove a member who is part of existing expenses. Delete or edit those expenses first.',
        }
      }
      await repositories.groups.removeMember(memberId)
      return { success: true, data: undefined }
    },
  }
}
