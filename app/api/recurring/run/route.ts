export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getBackend } from '@/lib/backend/runtime'
import { requireBackupAuthorization } from '@/lib/backups/auth'

export async function POST(request: Request) {
  // When FAIRTAB_BACKUP_TOKEN is set, require it so an external cron hook keeps
  // working with the access gate enabled; when unset this stays open, matching
  // the app's LAN-default trust model.
  const unauthorized = await requireBackupAuthorization(request)
  if (unauthorized) return unauthorized

  const materialized = await getBackend().recurring.materializeDueRecurring(new Date())
  return NextResponse.json({ materialized })
}
