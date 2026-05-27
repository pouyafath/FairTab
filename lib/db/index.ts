import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import * as relations from './relations'
import { DB_PATH } from '@/lib/constants'

// In Next.js dev mode, modules are re-evaluated on hot reload.
// better-sqlite3 is synchronous and SQLite handles multiple connections gracefully,
// so we open a fresh connection each evaluation and rely on module caching in production.
const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema: { ...schema, ...relations } })

export type Db = typeof db
