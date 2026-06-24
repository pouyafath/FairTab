import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const {
  formatResult,
  verifyMigrations,
} = require('../../scripts/verify-migrations.js') as {
  formatResult: (result: {
    ok: boolean
    applied: string[]
    error?: string
  }) => string
  verifyMigrations: (options: {
    migrationsDir: string
    tempRoot?: string
    cleanup?: boolean
  }) => {
    ok: boolean
    applied: string[]
    error?: string
    tempDir: string | null
  }
}

function withTempDir(run: (dir: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fairtab-migrations-test-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function writeMigration(migrationsDir: string, filename: string, sql: string) {
  writeFileSync(path.join(migrationsDir, filename), sql)
}

describe('migration verifier', () => {
  it('applies clean migrations and removes temporary database files', () => {
    withTempDir((dir) => {
      const migrationsDir = path.join(dir, 'migrations')
      mkdirSync(migrationsDir)
      writeMigration(
        migrationsDir,
        '0001_initial.sql',
        'CREATE TABLE parents (id INTEGER PRIMARY KEY);'
      )
      writeMigration(
        migrationsDir,
        '0002_child.sql',
        'CREATE TABLE children (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parents(id));'
      )

      const result = verifyMigrations({ migrationsDir, tempRoot: dir })

      assert.equal(result.ok, true)
      assert.deepEqual(result.applied, ['0001_initial.sql', '0002_child.sql'])
      assert.equal(result.tempDir ? existsSync(result.tempDir) : true, false)
      assert.match(formatResult(result), /migration verification passed/)
    })
  })

  it('fails when there are no migration files', () => {
    withTempDir((dir) => {
      const migrationsDir = path.join(dir, 'migrations')
      mkdirSync(migrationsDir)

      const result = verifyMigrations({ migrationsDir, tempRoot: dir })

      assert.equal(result.ok, false)
      assert.match(result.error ?? '', /no SQL migration files/)
      assert.match(formatResult(result), /migration verification failed/)
    })
  })

  it('fails invalid SQL without leaving temporary files behind', () => {
    withTempDir((dir) => {
      const migrationsDir = path.join(dir, 'migrations')
      mkdirSync(migrationsDir)
      writeMigration(migrationsDir, '0001_initial.sql', 'CREATE TABLE ok_table (id INTEGER);')
      writeMigration(migrationsDir, '0002_invalid.sql', 'CREATE TABLE broken (')

      const result = verifyMigrations({ migrationsDir, tempRoot: dir })

      assert.equal(result.ok, false)
      assert.deepEqual(result.applied, ['0001_initial.sql'])
      assert.match(result.error ?? '', /syntax error|incomplete input/i)
      assert.equal(result.tempDir ? existsSync(result.tempDir) : true, false)
    })
  })
})
