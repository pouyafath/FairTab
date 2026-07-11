export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBackend } from '@/lib/backend/runtime'
import { SERVEABLE_CONTENT_TYPES } from '@/lib/validations/attachment'

type Params = Promise<{ token: string; id: string }>

// Keep only characters that are safe inside a quoted Content-Disposition
// filename; a restored backup row could carry quotes or control characters.
function safeDispositionFilename(name: string): string {
  const cleaned = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return cleaned.slice(0, 100) || 'download'
}

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

  // A restored backup row can carry an arbitrary contentType; clamp to the
  // known-safe set so the server never declares, e.g., text/html for a stored
  // image (which would defeat nosniff and enable stored XSS on this origin).
  const isServeable = SERVEABLE_CONTENT_TYPES.has(attachment.contentType)
  const contentType = isServeable ? attachment.contentType : 'application/octet-stream'
  const filename = safeDispositionFilename(attachment.filename)

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': String(attachment.size),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  }

  // Images render inline; anything else (PDFs, and any non-allowlisted type)
  // is forced to download so it can never execute in the app origin.
  const inline = contentType.startsWith('image/')
  headers['Content-Disposition'] = `${inline ? 'inline' : 'attachment'}; filename="${filename}"`

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
