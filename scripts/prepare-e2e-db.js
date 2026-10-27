#!/usr/bin/env node
'use strict'

const { mkdirSync, rmSync } = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const Database = require('better-sqlite3')

const dbPath = process.env.DATABASE_URL ?? './.tmp/fairtab-e2e.db'
const absoluteDbPath = path.resolve(process.cwd(), dbPath)
const dbDir = path.dirname(absoluteDbPath)

mkdirSync(dbDir, { recursive: true })
for (const suffix of ['', '-shm', '-wal']) {
  rmSync(`${absoluteDbPath}${suffix}`, { force: true })
}

const migrate = spawnSync(process.execPath, [path.join('scripts', 'migrate.js')], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: absoluteDbPath },
  stdio: 'inherit',
})

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1)
}

// Noon today, local time: the personal dashboard's month filter defaults to
// the current month, so a fixed calendar date would hide the seed rows as
// soon as the real month rolls past it.
const seedDate = new Date()
seedDate.setHours(12, 0, 0, 0)
const now = seedDate.getTime()
const db = new Database(absoluteDbPath)
db.pragma('foreign_keys = ON')

db.transaction(() => {
  db.prepare(
    `INSERT INTO groups (id, name, token, currency, created_at, is_archived)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(100, 'E2E Seed Trip', 'seedtrip', 'CAD', now, 0)

  db.prepare(
    `INSERT INTO group_members (id, group_id, name, email)
     VALUES (?, ?, ?, ?)`
  ).run(100, 100, 'Seed Alice', 'alice@example.test')

  db.prepare(
    `INSERT INTO group_members (id, group_id, name, email)
     VALUES (?, ?, ?, ?)`
  ).run(101, 100, 'Seed Bob', null)

  db.prepare(
    `INSERT INTO expenses (
       id, group_id, title, amount, currency, paid_by_id, date, category, notes, split_method, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(100, 100, 'Seed dinner', 6400, 'CAD', 100, now, 'Food', 'Seeded by E2E setup', 'equal', now)

  const insertParticipant = db.prepare(
    `INSERT INTO expense_participants (expense_id, member_id, share_value, amount_cents)
     VALUES (?, ?, ?, ?)`
  )
  insertParticipant.run(100, 100, 1, 3200)
  insertParticipant.run(100, 101, 1, 3200)

  db.prepare(
    `INSERT INTO personal_transactions (
       id, type, title, amount, currency, date, category, note, account_label, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(100, 'expense', 'Seed groceries', 2389, 'CAD', now, 'Food & Dining', 'Seeded by E2E setup', 'E2E Wallet', now)
})()

db.close()

console.log(`[fairtab] e2e database ready: ${absoluteDbPath}`)
