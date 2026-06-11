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

// Baseline an existing pre-tracking database. Deployments created before the
// _migrations table existed had 0001_initial.sql applied directly by the legacy
// entrypoint, which never recorded it. Re-running 0001 would fail because it
// uses bare CREATE TABLE. If the schema is already present but no migration
// history exists, record 0001 as applied without executing it.
if (applied.size === 0) {
  const schemaExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'groups'"
    )
    .get()
  const baseline = '0001_initial.sql'
  if (schemaExists && files.includes(baseline)) {
    console.log(`[fairtab]   baseline ${baseline} (pre-existing schema, not re-run)`)
    insertMigration.run(baseline, Date.now())
    applied.add(baseline)
  }
}

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
