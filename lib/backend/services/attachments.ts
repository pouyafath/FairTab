import { validateAttachment } from '@/lib/validations/attachment'
import type { ActionResult, Attachment } from '@/types'
import type { BackendServiceDeps } from './types'

const ARCHIVED_GROUP_ERROR = 'Archived groups are read-only. Unarchive the group to make changes.'

export function createAttachmentService({
  repositories,
  storage,
  createId,
  now,
}: BackendServiceDeps) {
  return {
    async uploadAttachment(
      groupId: number,
      expenseId: number | null,
      filename: string,
      data: Uint8Array
    ): Promise<ActionResult<Attachment>> {
      const group = await repositories.groups.findById(groupId)
      if (!group) return { success: false, error: 'Group not found' }
      if (group.isArchived) return { success: false, error: ARCHIVED_GROUP_ERROR }

      // The expense id arrives from the client; without this check a valid
      // token for one group could attach files to another group's expense.
      if (expenseId !== null) {
        const expense = await repositories.expenses.findById(expenseId)
        if (!expense || expense.groupId !== groupId) {
          return { success: false, error: 'Expense not found' }
        }
      }

      let validated
      try {
        validated = validateAttachment(filename, data)
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message }
      }

      const key = `${groupId}/${createId()}.${validated.ext}`

      try {
        await storage.save(key, data, validated.contentType)
      } catch {
        return { success: false, error: 'Failed to save file' }
      }

      let attachment: Attachment
      try {
        attachment = await repositories.attachments.create({
          groupId,
          expenseId,
          storageKey: key,
          filename: validated.filename,
          contentType: validated.contentType,
          size: validated.size,
          createdAt: now(),
        })
      } catch {
        // Nothing references the saved file if the row never landed; remove
        // it so failed uploads don't accumulate orphans on the volume.
        await storage.delete(key).catch(() => {})
        return { success: false, error: 'Failed to record attachment' }
      }

      return { success: true, data: attachment }
    },

    async getAttachmentStream(
      attachmentId: number,
      groupId: number
    ): Promise<{ stream: ReadableStream; attachment: Attachment } | null> {
      const attachment = await repositories.attachments.findById(attachmentId)
      if (!attachment || attachment.groupId !== groupId) return null

      const stream = await storage.read(attachment.storageKey)
      if (!stream) return null

      return { stream, attachment }
    },

    async deleteAttachment(
      attachmentId: number,
      groupId: number
    ): Promise<ActionResult<void>> {
      const attachment = await repositories.attachments.findById(attachmentId)
      if (!attachment || attachment.groupId !== groupId) {
        return { success: false, error: 'Attachment not found' }
      }

      const group = await repositories.groups.findById(groupId)
      if (group?.isArchived) return { success: false, error: ARCHIVED_GROUP_ERROR }

      // Delete the row first: a leftover file is harmless, a row pointing at
      // a deleted file is a broken download link.
      await repositories.attachments.delete(attachmentId)
      await storage.delete(attachment.storageKey)
      return { success: true, data: undefined }
    },
  }
}
