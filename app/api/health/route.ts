import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { groups } from '@/lib/db/schema'
import { EXPECTED_LATEST_MIGRATION } from '@/lib/db/migration-metadata'
import { getAppMetadata, getRuntimeMetadata } from '@/lib/server/app-metadata'

export const dynamic = 'force-dynamic'

type RawSqlDb = {
  all<T = unknown>(query: unknown): Promise<T[]> | T[]
}

async function getMigrationStatus(db: unknown) {
  try {
    const rows = await Promise.resolve(
      (db as RawSqlDb).all<{ name: string; appliedAt: number }>(
        sql`
          SELECT name, applied_at AS appliedAt
          FROM _migrations
          ORDER BY applied_at DESC, name DESC
        `
      )
    )

    const latest = rows[0]?.name ?? null

    return {
      status: 'tracked',
      appliedCount: rows.length,
      latest,
      expectedLatest: EXPECTED_LATEST_MIGRATION,
      drift: latest !== EXPECTED_LATEST_MIGRATION,
      latestAppliedAt: rows[0]?.appliedAt
        ? new Date(rows[0].appliedAt).toISOString()
        : null,
    }
  } catch {
    return {
      status: 'untracked',
      reason: '_migrations table unavailable',
    }
  }
}

export async function GET() {
  try {
    const db = getDb()
    // Probe a real table so both connectivity and schema problems surface —
    // the Docker healthcheck relies on this to flag a broken container.
    await db.select({ id: groups.id }).from(groups).limit(1)
    const migrations = await getMigrationStatus(db)

    return Response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      app: getAppMetadata(),
      runtime: getRuntimeMetadata(),
      database: { status: 'ok' },
      migrations,
    })
  } catch (error) {
    console.error('[health] database check failed:', error)
    return Response.json(
      { status: 'error', error: 'database unavailable' },
      { status: 503 }
    )
  }
}
