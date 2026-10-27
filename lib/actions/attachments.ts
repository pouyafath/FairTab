'use server'

import { revalidatePath } from 'next/cache'
import { getBackend } from '@/lib/backend/runtime'
import type { ActionResult } from '@/types'

export async function deleteAttachment(
  groupToken: string,
  attachmentId: number
): Promise<ActionResult<void>> {
  const backend = getBackend()
  const group = await backend.groups.getGroupByToken(groupToken)
  if (!group) return { success: false, error: 'Group not found' }

  const result = await backend.attachments.deleteAttachment(attachmentId, group.id)
  if (result.success) {
    revalidatePath(`/groups/${groupToken}`)
  }
  return result
}
