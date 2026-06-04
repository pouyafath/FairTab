export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBackend } from '@/lib/backend/runtime'

type Params = Promise<{ token: string; id: string }>

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { token, id } = await params
  const backend = getBackend()

  const group = await backend.groups.getGroupByToken(token)
  if (!group) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const attachmentId = parseInt(id, 10)
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await backend.attachments.getAttachmentStream(attachmentId, group.id)
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { stream, attachment } = result

  const headers: Record<string, string> = {
    'Content-Type': attachment.contentType,
    'Content-Length': String(attachment.size),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  }

  // Force download for PDFs; inline for images
  if (attachment.contentType === 'application/pdf') {
    headers['Content-Disposition'] = `attachment; filename="${attachment.filename}"`
  } else {
    headers['Content-Disposition'] = `inline; filename="${attachment.filename}"`
  }

  return new NextResponse(stream, { status: 200, headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const { token, id } = await params
  const backend = getBackend()

  const group = await backend.groups.getGroupByToken(token)
  if (!group) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const attachmentId = parseInt(id, 10)
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await backend.attachments.deleteAttachment(attachmentId, group.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
