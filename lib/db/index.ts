import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'
import * as relations from './relations'

const fullSchema = { ...schema, ...relations }
export type AppDb = DrizzleD1Database<typeof fullSchema>

// Persistent connection for Node.js runtimes (local dev + self-hosted Docker).
// On Cloudflare Pages this is never set — a fresh D1 client is created per request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _localDb: any = null

/**
 * Returns a Drizzle database client. Runtime-detected:
 *
 * 1. **Cloudflare Pages** — CF Workers injects `Symbol.for('__cloudflare-request-context__')`
 *    into globalThis before every request. When the D1 binding is present we use
 *    `drizzle-orm/d1`. This avoids a static import of `@cloudflare/next-on-pages` which
 *    carries `server-only` and breaks the Next.js build data-collection phase.
 *
 * 2. **Local dev + self-hosted Docker** — no CF context → use `better-sqlite3` with a
 *    local SQLite file. The connection is cached for the lifetime of the Node.js process.
 */
export function getDb(): AppDb {
  // Cloudflare Pages: CF Workers sets this global before each request handler
  // (same symbol used internally by @cloudflare/next-on-pages getRequestContext)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfCtx = (globalThis as any)[Symbol.for('__cloudflare-request-context__')] as
    | { env?: { DB?: D1Database } }
    | undefined

  if (cfCtx?.env?.DB) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/d1')
    return drizzle(cfCtx.env.DB, { schema: fullSchema }) as AppDb
  }

  // Local dev or self-hosted: reuse the singleton across requests
  if (!_localDb) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/better-sqlite3')
    const sqlite = new Database(process.env.DATABASE_URL ?? './fairtab.db')
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    _localDb = drizzle(sqlite, { schema: fullSchema })
  }
  return _localDb as AppDb
}

export type Db = AppDb
