import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'
import * as relations from './relations'

const fullSchema = { ...schema, ...relations }
export type AppDb = DrizzleD1Database<typeof fullSchema>

// Singleton for local dev (re-created on hot reload — intentional)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _devDb: any = null

/**
 * Returns a Drizzle database client.
 * - Development (next dev): better-sqlite3, cached per module load.
 * - Production (CF Pages): D1 via the CF Workers request context global.
 *   The dev branch is dead-code eliminated at CF build time (NODE_ENV=production).
 *
 * We access the CF context via Symbol.for('__cloudflare-request-context__'), the same
 * symbol used by @cloudflare/next-on-pages getRequestContext(), to avoid importing
 * that package at module level (it uses `server-only` which breaks next build).
 */
export function getDb(): AppDb {
  if (process.env.NODE_ENV === 'development') {
    if (!_devDb) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle } = require('drizzle-orm/better-sqlite3')
      const sqlite = new Database(process.env.DATABASE_URL ?? './fairtab.db')
      sqlite.pragma('journal_mode = WAL')
      sqlite.pragma('foreign_keys = ON')
      _devDb = drizzle(sqlite, { schema: fullSchema })
    }
    return _devDb as AppDb
  }

  // Cloudflare Pages production: D1 binding accessed via the CF Workers request context.
  // CF Pages injects this global before each request handler invocation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfCtx = (globalThis as any)[Symbol.for('__cloudflare-request-context__')] as
    | { env: { DB: D1Database } }
    | undefined
  if (!cfCtx?.env?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" not found. ' +
        'Ensure a D1 database is bound as "DB" in wrangler.toml.'
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/d1')
  return drizzle(cfCtx.env.DB, { schema: fullSchema }) as AppDb
}

export type Db = AppDb
