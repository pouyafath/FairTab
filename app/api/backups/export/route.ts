import { getBackend } from '@/lib/backend/runtime'
import { requireConfiguredBackupAuthorization } from '@/lib/backups/auth'

export const dynamic = 'force-dynamic'

function backupFilename(exportedAt: string): string {
  return `fairtab-backup-${exportedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`
}

export async function GET(request: Request) {
  const unauthorized = await requireConfiguredBackupAuthorization(request)
  if (unauthorized) return unauthorized

  const backup = await getBackend().backups.createBackup()
  const body = JSON.stringify(backup, null, 2)

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${backupFilename(backup.exportedAt)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
