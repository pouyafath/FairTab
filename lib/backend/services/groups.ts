import { addMemberSchema, createGroupSchema } from '@/lib/validations/group'
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
  }
}
