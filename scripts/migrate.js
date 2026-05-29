#!/usr/bin/env node
'use strict'

/**
 * Applies migrations/0001_initial.sql to the SQLite database.
 * Run this once after first deploy or after pulling a fresh clone:
 *   node scripts/migrate.js
 * or via npm:
 *   npm run db:migrate
 *
 * Safe to call on an existing database — if the table already exists
 * SQLite returns an error; wrap in a try/catch if running manually on
 * an existing DB (use npm run db:push for dev instead).
 */

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.DATABASE_URL ?? './fairtab.db'
const sqlPath = path.join(__dirname, '..', 'migrations', '0001_initial.sql')

console.log(`[fairtab] migrate: ${dbPath}`)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const sql = fs.readFileSync(sqlPath, 'utf8')
db.exec(sql)
db.close()

console.log('[fairtab] migration complete')
