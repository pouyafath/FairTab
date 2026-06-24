#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const Database = require('better-sqlite3')

function migrationFiles(migrationsDir, fsImpl = fs) {
  let entries
  try {
    entries = fsImpl.readdirSync(migrationsDir)
  } catch (error) {
    throw new Error(`cannot read migrations directory: ${error.message}`)
  }

  const files = entries
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => path.join(migrationsDir, entry))

  if (files.length === 0) {
    throw new Error('no SQL migration files found')
  }

  return files
}

function removeDatabaseFiles(dbPath, fsImpl = fs) {
  for (const suffix of ['', '-shm', '-wal']) {
    fsImpl.rmSync(`${dbPath}${suffix}`, { force: true })
  }
}

function verifyMigrations(options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const fsImpl = options.fs ?? fs
  const migrationsDir = options.migrationsDir ?? path.join(cwd, 'migrations')
  const tempRoot = options.tempRoot ?? os.tmpdir()
  const cleanup = options.cleanup !== false
  const applied = []
  let tempDir = null
  let db = null
  let dbPath = null

  try {
    const files = migrationFiles(migrationsDir, fsImpl)
    tempDir = fsImpl.mkdtempSync(path.join(tempRoot, 'fairtab-migration-'))
    dbPath = path.join(tempDir, 'verify.db')
    db = new Database(dbPath)
    db.pragma('foreign_keys = ON')

    for (const file of files) {
      const sql = fsImpl.readFileSync(file, 'utf8')
      db.exec(sql)
      applied.push(path.basename(file))
    }

    const violations = db.pragma('foreign_key_check')
    if (violations.length > 0) {
      throw new Error(`foreign key check failed: ${JSON.stringify(violations)}`)
    }

    return {
      ok: true,
      applied,
      dbPath,
      migrationsDir,
      tempDir,
    }
  } catch (error) {
    return {
      ok: false,
      applied,
      dbPath,
      migrationsDir,
      tempDir,
      error: error.message,
    }
  } finally {
    if (db) db.close()
    if (cleanup && dbPath) removeDatabaseFiles(dbPath, fsImpl)
    if (cleanup && tempDir) fsImpl.rmSync(tempDir, { recursive: true, force: true })
  }
}

function formatResult(result) {
  if (result.ok) {
    return `[fairtab] migration verification passed (${result.applied.length} applied: ${result.applied.join(', ')})\n`
  }

  const applied = result.applied.length > 0 ? ` after ${result.applied.length} applied` : ''
  return `[fairtab] migration verification failed${applied}: ${result.error}\n`
}

function main() {
  const result = verifyMigrations()
  const output = formatResult(result)
  if (result.ok) {
    process.stdout.write(output)
  } else {
    process.stderr.write(output)
    process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  formatResult,
  migrationFiles,
  removeDatabaseFiles,
  verifyMigrations,
}
