import { z } from 'zod'
import { getBackend } from '@/lib/backend/runtime'
import { requireConfiguredBackupAuthorization } from '@/lib/backups/auth'

export const dynamic = 'force-dynamic'

const restoreRequestSchema = z.object({
  backup: z.unknown(),
  mode: z.enum(['empty', 'replace']).default('empty'),
  confirmation: z.string().optional(),
})

export async function POST(request: Request) {
  const unauthorized = requireConfiguredBackupAuthorization(request)
  if (unauthorized) return unauthorized

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const parsed = restoreRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json(
      {
        error: 'Invalid restore request.',
        issues: parsed.error.issues,
      },
      { status: 400 }
    )
  }

  const result = await getBackend().backups.restoreBackup(parsed.data.backup, {
    mode: parsed.data.mode,
    confirmation: parsed.data.confirmation,
  })

  return Response.json(result, { status: result.restored ? 200 : 422 })
}
