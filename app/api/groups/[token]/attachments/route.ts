export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBackend } from '@/lib/backend/runtime'
import { MAX_ATTACHMENT_SIZE } from '@/lib/validations/attachment'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const backend = getBackend()

  if (!backend.storage.isEnabled()) {
    return NextResponse.json(
      { error: 'File uploads are not enabled in this deployment' },
      { status: 501 }
    )
  }

  const group = await backend.groups.getGroupByToken(token)
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Reject oversized uploads before buffering the whole body into memory.
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  const expenseIdRaw = formData.get('expenseId')
  const expenseId = expenseIdRaw ? parseInt(expenseIdRaw.toString(), 10) : null

  const data = new Uint8Array(await file.arrayBuffer())

  const result = await backend.attachments.uploadAttachment(
    group.id,
    expenseId,
    file.name,
    data
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ attachment: result.data }, { status: 201 })
}
