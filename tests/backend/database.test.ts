import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createDrizzleRepositories } from '@/lib/backend/repositories/drizzle'
import type { AppDb } from '@/lib/db'
import * as relations from '@/lib/db/relations'
import * as schema from '@/lib/db/schema'
import type { BackupData } from '@/lib/backups/types'

const fullSchema = { ...schema, ...relations }

const backupFixture: BackupData = {
  groups: [
    {
      id: 7,
      name: 'Restored Trip',
      token: 'restore7',
      currency: 'CAD',
      isArchived: false,
      createdAt: 1780000000000,
    },
  ],
  groupMembers: [
    { id: 8, groupId: 7, name: 'Alice', email: null },
    { id: 9, groupId: 7, name: 'Bob', email: null },
  ],
  expenses: [
    {
      id: 10,
      groupId: 7,
      title: 'Restored dinner',
      amount: 4000,
      currency: 'CAD',
      paidById: 8,
      date: 1780000000000,
      category: null,
      notes: null,
      splitMethod: 'equal',
      createdAt: 1780000000000,
    },
  ],
  expenseParticipants: [
    { id: 11, expenseId: 10, memberId: 8, shareValue: 1, amountCents: 2000 },
    { id: 12, expenseId: 10, memberId: 9, shareValue: 1, amountCents: 2000 },
  ],
  settlements: [
    {
      id: 13,
      groupId: 7,
      fromMemberId: 9,
      toMemberId: 8,
      amount: 2000,
      isPaid: true,
      paidAt: 1780000000000,
    },
  ],
  personalTransactions: [
    {
      id: 14,
      type: 'expense',
      title: 'Restored groceries',
      amount: 2500,
      currency: 'CAD',
      date: 1780000000000,
      category: 'Food & Dining',
      note: null,
      accountLabel: null,
      sourceRuleId: null,
      createdAt: 1780000000000,
    },
  ],
  recurringRules: [
    {
      id: 20,
      type: 'expense',
      title: 'Restored rent',
      amount: 150000,
      currency: 'CAD',
      category: null,
      note: null,
      accountLabel: null,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: 1780000000000,
      lastRunDate: null,
      active: true,
      createdAt: 1780000000000,
    },
  ],
  savingsGoals: [
    {
      id: 21,
      name: 'Restored fund',
      targetAmount: 500000,
      currentAmount: 12000,
      currency: 'CAD',
      targetDate: null,
      createdAt: 1780000000000,
    },
  ],
  attachments: [
    {
      id: 22,
      groupId: 7,
      expenseId: 10,
      storageKey: '7/restored.png',
      filename: 'restored.png',
      contentType: 'image/png',
      size: 1234,
      createdAt: 1780000000000,
    },
  ],
}

function countRows(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return row.count
}

function isNativeLoadError(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ERR_DLOPEN_FAILED'
}

function createMigratedDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), 'fairtab-db-test-'))
  const dbPath = path.join(directory, 'fairtab.db')
  let db: Database.Database
  try {
    db = new Database(dbPath)
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
  db.pragma('foreign_keys = ON')

  const migrationsDir = path.join(process.cwd(), 'migrations')
  const migrationFiles = [
    '0001_initial.sql',
    '0002_add_is_archived.sql',
    '0003_add_integrity_indexes.sql',
    '0004_recurring_rules.sql',
    '0005_savings_goals.sql',
    '0006_attachments.sql',
    '0007_recurring_materialization_unique.sql',
    '0008_recurring_rules_due_index.sql',
  ]
  for (const file of migrationFiles) {
    db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'))
  }

  return {
    db,
    cleanup() {
      db.close()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}

describe('database schema', () => {
  it('enforces participant uniqueness and cascades group-owned data', (t) => {
    let migrated: ReturnType<typeof createMigratedDatabase>
    try {
      migrated = createMigratedDatabase()
    } catch (error) {
      if (isNativeLoadError(error)) {
        t.skip('better-sqlite3 native module cannot be loaded in this Node process')
        return
      }
      throw error
    }

    const { db, cleanup } = migrated

    try {
      db.exec(`
        INSERT INTO groups (id, name, token, currency, created_at, is_archived)
        VALUES (1, 'Trip', 'group123', 'CAD', 1780000000000, 0);

        INSERT INTO group_members (id, group_id, name, email)
        VALUES
          (1, 1, 'Alice', NULL),
          (2, 1, 'Bob', NULL);

        INSERT INTO expenses (
          id, group_id, title, amount, currency, paid_by_id, date, split_method, created_at
        )
        VALUES (1, 1, 'Dinner', 4000, 'CAD', 1, 1780000000000, 'equal', 1780000000000);

        INSERT INTO expense_participants (expense_id, member_id, share_value, amount_cents)
        VALUES
          (1, 1, 1, 2000),
          (1, 2, 1, 2000);
      `)

      assert.throws(
        () => db
          .prepare(
            `INSERT INTO expense_participants (
              expense_id, member_id, share_value, amount_cents
            ) VALUES (?, ?, ?, ?)`
          )
          .run(1, 1, 1, 2000),
        /UNIQUE constraint failed/
      )

      db.prepare('DELETE FROM groups WHERE id = ?').run(1)

      assert.equal(countRows(db, 'groups'), 0)
      assert.equal(countRows(db, 'group_members'), 0)
      assert.equal(countRows(db, 'expenses'), 0)
      assert.equal(countRows(db, 'expense_participants'), 0)
    } finally {
      cleanup()
    }
  })

  it('restores snapshots through the Drizzle SQLite repository adapter', async (t) => {
    let migrated: ReturnType<typeof createMigratedDatabase>
    try {
      migrated = createMigratedDatabase()
    } catch (error) {
      if (isNativeLoadError(error)) {
        t.skip('better-sqlite3 native module cannot be loaded in this Node process')
        return
      }
      throw error
    }

    const { db, cleanup } = migrated

    try {
      db.exec(`
        INSERT INTO groups (id, name, token, currency, created_at, is_archived)
        VALUES (1, 'Old Trip', 'oldtrip1', 'CAD', 1780000000000, 0);

        INSERT INTO group_members (id, group_id, name, email)
        VALUES (1, 1, 'Old Member', NULL);
      `)

      const appDb = drizzle(db, { schema: fullSchema }) as unknown as AppDb
      const repositories = createDrizzleRepositories(appDb)

      await repositories.backups.restoreSnapshot(backupFixture, { replace: true })
      const snapshot = await repositories.backups.readSnapshot()

      assert.deepEqual(snapshot.groups.map((group) => group.token), ['restore7'])
      assert.deepEqual(snapshot.groupMembers.map((member) => member.name), ['Alice', 'Bob'])
      assert.deepEqual(snapshot.expenses.map((expense) => expense.title), ['Restored dinner'])
      assert.equal(snapshot.expenseParticipants.length, 2)
      assert.equal(snapshot.settlements.length, 1)
      assert.deepEqual(snapshot.personalTransactions.map((tx) => tx.title), [
        'Restored groceries',
      ])
      assert.deepEqual(snapshot.recurringRules.map((rule) => rule.title), ['Restored rent'])
      assert.deepEqual(snapshot.savingsGoals.map((goal) => goal.name), ['Restored fund'])
      assert.equal(snapshot.attachments.length, 1)
      assert.equal(snapshot.attachments[0].storageKey, '7/restored.png')
      assert.equal(countRows(db, 'groups'), 1)
    } finally {
      cleanup()
    }
  })

  it('rolls back replace restore when SQLite import fails', async (t) => {
    let migrated: ReturnType<typeof createMigratedDatabase>
    try {
      migrated = createMigratedDatabase()
    } catch (error) {
      if (isNativeLoadError(error)) {
        t.skip('better-sqlite3 native module cannot be loaded in this Node process')
        return
      }
      throw error
    }

    const { db, cleanup } = migrated

    try {
      db.exec(`
        INSERT INTO groups (id, name, token, currency, created_at, is_archived)
        VALUES (1, 'Old Trip', 'oldtrip1', 'CAD', 1780000000000, 0);

        INSERT INTO group_members (id, group_id, name, email)
        VALUES (1, 1, 'Old Member', NULL);
      `)

      const brokenBackup: BackupData = {
        ...backupFixture,
        groupMembers: [],
      }
      const appDb = drizzle(db, { schema: fullSchema }) as unknown as AppDb
      const repositories = createDrizzleRepositories(appDb)

      await assert.rejects(
        () => repositories.backups.restoreSnapshot(brokenBackup, { replace: true }),
        /FOREIGN KEY constraint failed/
      )

      const snapshot = await repositories.backups.readSnapshot()
      assert.deepEqual(snapshot.groups.map((group) => group.token), ['oldtrip1'])
      assert.deepEqual(snapshot.groupMembers.map((member) => member.name), ['Old Member'])
      assert.equal(countRows(db, 'expenses'), 0)
    } finally {
      cleanup()
    }
  })

  it('rolls back an expense update whose participant insert fails', async (t) => {
    let migrated: ReturnType<typeof createMigratedDatabase>
    try {
      migrated = createMigratedDatabase()
    } catch (error) {
      if (isNativeLoadError(error)) {
        t.skip('better-sqlite3 native module cannot be loaded in this Node process')
        return
      }
      throw error
    }

    const { db, cleanup } = migrated

    try {
      db.exec(`
        INSERT INTO groups (id, name, token, currency, created_at, is_archived)
        VALUES (1, 'Trip', 'group123', 'CAD', 1780000000000, 0);

        INSERT INTO group_members (id, group_id, name, email)
        VALUES
          (1, 1, 'Alice', NULL),
          (2, 1, 'Bob', NULL);

        INSERT INTO expenses (
          id, group_id, title, amount, currency, paid_by_id, date, split_method, created_at
        )
        VALUES (1, 1, 'Dinner', 4000, 'CAD', 1, 1780000000000, 'equal', 1780000000000);

        INSERT INTO expense_participants (expense_id, member_id, share_value, amount_cents)
        VALUES
          (1, 1, 1, 2000),
          (1, 2, 1, 2000);
      `)

      const appDb = drizzle(db, { schema: fullSchema }) as unknown as AppDb
      const repositories = createDrizzleRepositories(appDb)

      // Member 999 violates the participants FK after the old rows were
      // deleted; without a transaction the expense would survive with zero
      // participants and corrupt every balance in the group.
      await assert.rejects(() =>
        repositories.expenses.updateWithParticipants(1, {
          title: 'Dinner v2',
          amount: 4000,
          currency: 'CAD',
          paidById: 1,
          date: new Date(1780000000000),
          category: null,
          notes: null,
          splitMethod: 'equal',
          participants: [
            { memberId: 1, shareValue: 1, amountCents: 2000 },
            { memberId: 999, shareValue: 1, amountCents: 2000 },
          ],
        })
      )

      assert.equal(countRows(db, 'expense_participants'), 2)
      const title = db.prepare('SELECT title FROM expenses WHERE id = 1').get() as {
        title: string
      }
      assert.equal(title.title, 'Dinner')
    } finally {
      cleanup()
    }
  })

  it('enforces one personal transaction per recurring rule occurrence date', async (t) => {
    let migrated: ReturnType<typeof createMigratedDatabase>
    try {
      migrated = createMigratedDatabase()
    } catch (error) {
      if (isNativeLoadError(error)) {
        t.skip('better-sqlite3 native module cannot be loaded in this Node process')
        return
      }
      throw error
    }

    const { db, cleanup } = migrated

    try {
      const appDb = drizzle(db, { schema: fullSchema }) as unknown as AppDb
      const repositories = createDrizzleRepositories(appDb)
      const occurrenceDate = new Date(1780000000000)

      const first = await repositories.personal.createIfAbsent({
        type: 'expense',
        title: 'Rent',
        amount: 150000,
        currency: 'CAD',
        date: occurrenceDate,
        category: null,
        note: null,
        accountLabel: null,
        sourceRuleId: 99,
        createdAt: occurrenceDate,
      })
      assert.ok(first)

      const duplicate = await repositories.personal.createIfAbsent({
        type: 'expense',
        title: 'Rent',
        amount: 150000,
        currency: 'CAD',
        date: occurrenceDate,
        category: null,
        note: null,
        accountLabel: null,
        sourceRuleId: 99,
        createdAt: occurrenceDate,
      })
      assert.equal(duplicate, null)
      assert.equal(countRows(db, 'personal_transactions'), 1)

      const nextOccurrence = await repositories.personal.createIfAbsent({
        type: 'expense',
        title: 'Rent',
        amount: 150000,
        currency: 'CAD',
        date: new Date(occurrenceDate.getTime() + 86400000),
        category: null,
        note: null,
        accountLabel: null,
        sourceRuleId: 99,
        createdAt: occurrenceDate,
      })
      assert.ok(nextOccurrence)
      assert.equal(countRows(db, 'personal_transactions'), 2)

      const manualEntry = await repositories.personal.create({
        type: 'expense',
        title: 'Manual entry',
        amount: 500,
        currency: 'CAD',
        date: occurrenceDate,
        category: null,
        note: null,
        accountLabel: null,
        sourceRuleId: null,
        createdAt: occurrenceDate,
      })
      assert.ok(manualEntry)
      assert.equal(countRows(db, 'personal_transactions'), 3)
    } finally {
      cleanup()
    }
  })
})
