import { validateAttachment } from '@/lib/validations/attachment'
import type { ActionResult, Attachment } from '@/types'
import type { BackendServiceDeps } from './types'

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

      const attachment = await repositories.attachments.create({
        groupId,
        expenseId,
        storageKey: key,
        filename: validated.filename,
        contentType: validated.contentType,
        size: validated.size,
        createdAt: now(),
      })

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

      await storage.delete(attachment.storageKey)
      await repositories.attachments.delete(attachmentId)
      return { success: true, data: undefined }
    },
  }
}
