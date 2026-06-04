#!/usr/bin/env node
'use strict'

/**
 * Applies all migrations/*.sql files in lexical order, skipping any that have
 * already been recorded in the _migrations tracking table. Safe to run on every
 * boot — already-applied files are no-ops.
 *
 *   node scripts/migrate.js
 *   npm run db:migrate
 */

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.DATABASE_URL ?? './fairtab.db'
const migrationsDir = path.join(__dirname, '..', 'migrations')

console.log(`[fairtab] migrate: ${dbPath}`)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Bootstrap the tracking table (runs once ever, idempotent thereafter).
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`)

const applied = new Set(
  db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
)

const files = fs
  .readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

const insertMigration = db.prepare(
  'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)'
)

const runMigration = db.transaction((name, sql) => {
  db.exec(sql)
  insertMigration.run(name, Date.now())
})

let count = 0
for (const file of files) {
  if (applied.has(file)) {
    console.log(`[fairtab]   skip  ${file}`)
    continue
  }
  console.log(`[fairtab]   apply ${file}`)
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
  runMigration(file, sql)
  count++
}

db.close()
console.log(`[fairtab] migration complete (${count} applied, ${applied.size} skipped)`)
