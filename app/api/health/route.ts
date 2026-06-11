import { getDb } from '@/lib/db'
import { groups } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Probe a real table so both connectivity and schema problems surface —
    // the Docker healthcheck relies on this to flag a broken container.
    await getDb().select({ id: groups.id }).from(groups).limit(1)
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[health] database check failed:', error)
    return Response.json(
      { status: 'error', error: 'database unavailable' },
      { status: 503 }
    )
  }
}
