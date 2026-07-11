import { getBackend } from '@/lib/backend/runtime'
import { requireBackupAuthorization } from '@/lib/backups/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const unauthorized = await requireBackupAuthorization(request)
  if (unauthorized) return unauthorized

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json(
      {
        valid: false,
        canRestore: false,
        summary: {
          groups: 0,
          groupMembers: 0,
          expenses: 0,
          expenseParticipants: 0,
          settlements: 0,
          personalTransactions: 0,
          recurringRules: 0,
          savingsGoals: 0,
          attachments: 0,
        },
        errors: [{ code: 'invalid_json', message: 'Request body must be valid JSON.' }],
        warnings: [],
        conflicts: [],
      },
      { status: 400 }
    )
  }

  const result = await getBackend().backups.validateBackup(payload)
  return Response.json(result, { status: result.valid ? 200 : 422 })
}
