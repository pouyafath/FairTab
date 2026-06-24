export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBackend } from '@/lib/backend/runtime'

export async function GET() {
  const doc = await getBackend().legacyBackup.exportBackup()
  const stamp = doc.generatedAt.replace(/[:.]/g, '-')

  return NextResponse.json(doc, {
    headers: {
      'Content-Disposition': `attachment; filename="fairtab-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 })
  }

  const result = await getBackend().legacyBackup.importBackup(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ restored: result.data })
}
