import 'server-only'

import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  attachments,
  expenseParticipants,
  expenses,
  groupMembers,
  groups,
  personalTransactions,
  recurringRules,
  savingsGoals,
  settlements,
} from '@/lib/db/schema'
import type {
  AppRepositories,
  CreateAttachmentRecord,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  CreateRecurringRuleRecord,
  CreateSavingsGoalRecord,
  UpdateExpenseRecord,
  UpdateGroupRecord,
  UpdateMemberRecord,
  UpdatePersonalTransactionRecord,
  UpdateRecurringRuleRecord,
  UpdateSavingsGoalRecord,
} from '@/lib/backend/ports'
import type {
  Attachment,
  BackupData,
  Expense,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  RecurringRule,
  SavingsGoal,
  Settlement,
} from '@/types'

type WriteDb = {
  insert: (table: unknown) => {
    values: (values: unknown) => { run: () => unknown }
  }
  delete: (table: unknown) => { run: () => unknown }
  run: (query: unknown) => unknown
}

function toEpochMs(value: Date | number | string): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return new Date(value).getTime()
}

// .returning() yields an empty array when the WHERE clause matched no rows;
// destructuring that into `undefined` would surface as a confusing TypeError
// deep in a serializer. Fail with a clear message instead.
function requireRow<T>(row: T | undefined, entity: string): T {
  if (row === undefined) throw new Error(`${entity} not found`)
  return row
}

function serializeGroup(row: typeof groups.$inferSelect): Group {
  return { ...row, createdAt: toEpochMs(row.createdAt) }
}

function serializeExpense(row: typeof expenses.$inferSelect): Expense {
  return {
    ...row,
    date: toEpochMs(row.date),
    createdAt: toEpochMs(row.createdAt),
  }
}

function serializePersonalTransaction(
  row: typeof personalTransactions.$inferSelect
): PersonalTransaction {
  return {
    ...row,
    sourceRuleId: row.sourceRuleId ?? null,
    date: toEpochMs(row.date),
    createdAt: toEpochMs(row.createdAt),
  }
}

function serializeRecurringRule(row: typeof recurringRules.$inferSelect): RecurringRule {
  return {
    ...row,
    nextRunDate: toEpochMs(row.nextRunDate),
    lastRunDate: row.lastRunDate ? toEpochMs(row.lastRunDate) : null,
    createdAt: toEpochMs(row.createdAt),
  }
}

function serializeExpenseParticipant(
  row: typeof expenseParticipants.$inferSelect
): ExpenseParticipant {
  return row
}

function serializeSavingsGoal(row: typeof savingsGoals.$inferSelect): SavingsGoal {
  return {
    ...row,
    targetDate: row.targetDate ? toEpochMs(row.targetDate) : null,
    createdAt: toEpochMs(row.createdAt),
  }
}

function serializeAttachment(row: typeof attachments.$inferSelect): Attachment {
  return {
    ...row,
    expenseId: row.expenseId ?? null,
    createdAt: toEpochMs(row.createdAt),
  }
}

function serializeSettlement(row: typeof settlements.$inferSelect): Settlement {
  return {
    ...row,
    paidAt: row.paidAt ? toEpochMs(row.paidAt) : null,
  }
}

async function runInSqlTransaction<T>(db: WriteDb, work: () => Promise<T>): Promise<T> {
  await Promise.resolve(db.run(sql.raw('begin')))
  try {
    const result = await work()
    await Promise.resolve(db.run(sql.raw('commit')))
    return result
  } catch (error) {
    try {
      await Promise.resolve(db.run(sql.raw('rollback')))
    } catch (rollbackError) {
      console.error('[fairtab] backup restore rollback failed:', rollbackError)
    }
    throw error
  }
}

async function insertRows(db: WriteDb, table: unknown, rows: unknown[]) {
  if (rows.length === 0) return
  await Promise.resolve(db.insert(table).values(rows).run())
}

export function createDrizzleRepositories(db: AppDb): AppRepositories {
  return {
    groups: {
      async create(input: CreateGroupRecord): Promise<Group> {
        const [group] = await db.insert(groups).values(input).returning()
        return serializeGroup(group)
      },

      async findByToken(token: string): Promise<GroupWithMembers | null> {
        const group = await db.query.groups.findFirst({
          where: eq(groups.token, token),
          with: { members: true },
        })
        if (!group) return null

        return {
          ...serializeGroup(group),
          members: group.members,
        }
      },

      async findById(groupId: number): Promise<GroupWithMembers | null> {
        const group = await db.query.groups.findFirst({
          where: eq(groups.id, groupId),
          with: { members: true },
        })
        if (!group) return null

        return {
          ...serializeGroup(group),
          members: group.members,
        }
      },

      async findByMemberId(memberId: number): Promise<GroupWithMembers | null> {
        const member = await db.query.groupMembers.findFirst({
          where: eq(groupMembers.id, memberId),
        })
        if (!member) return null

        const group = await db.query.groups.findFirst({
          where: eq(groups.id, member.groupId),
          with: { members: true },
        })
        if (!group) return null

        return {
          ...serializeGroup(group),
          members: group.members,
        }
      },

      async update(groupId: number, input: UpdateGroupRecord): Promise<Group> {
        const setFields: Record<string, unknown> = {}
        if (input.name !== undefined) setFields.name = input.name
        if (input.currency !== undefined) setFields.currency = input.currency
        if (input.isArchived !== undefined) setFields.isArchived = input.isArchived
        const [group] = await db
          .update(groups)
          .set(setFields)
          .where(eq(groups.id, groupId))
          .returning()
        return serializeGroup(requireRow(group, 'Group'))
      },

      async delete(groupId: number): Promise<void> {
        await db.delete(groups).where(eq(groups.id, groupId))
      },

      async addMember(input): Promise<GroupMember> {
        const [member] = await db.insert(groupMembers).values(input).returning()
        return member
      },

      async updateMember(memberId: number, input: UpdateMemberRecord): Promise<GroupMember> {
        const [member] = await db
          .update(groupMembers)
          .set({ name: input.name, email: input.email })
          .where(eq(groupMembers.id, memberId))
          .returning()
        return requireRow(member, 'Member')
      },

      async removeMember(memberId: number): Promise<void> {
        await db.delete(groupMembers).where(eq(groupMembers.id, memberId))
      },
    },

    expenses: {
      async createWithParticipants(input: CreateExpenseRecord): Promise<Expense> {
        const [expense] = await db
          .insert(expenses)
          .values({
            groupId: input.groupId,
            title: input.title,
            amount: input.amount,
            currency: input.currency,
            paidById: input.paidById,
            date: input.date,
            category: input.category,
            notes: input.notes,
            splitMethod: input.splitMethod,
            createdAt: input.createdAt,
          })
          .returning()

        await db.insert(expenseParticipants).values(
          input.participants.map((participant) => ({
            expenseId: expense.id,
            memberId: participant.memberId,
            shareValue: participant.shareValue,
            amountCents: participant.amountCents,
          }))
        )

        return serializeExpense(expense)
      },

      async findForGroup(groupId: number): Promise<ExpenseWithParticipants[]> {
        const rows = await db.query.expenses.findMany({
          where: eq(expenses.groupId, groupId),
          with: {
            participants: { with: { member: true } },
            paidBy: true,
            attachments: true,
          },
          orderBy: [desc(expenses.date)],
        })

        return rows.map((expense) => ({
          ...serializeExpense(expense),
          participants: expense.participants.map((participant) => ({
            ...serializeExpenseParticipant(participant),
            member: participant.member,
          })),
          paidBy: expense.paidBy,
          attachments: expense.attachments.map(serializeAttachment),
        }))
      },

      async findById(expenseId: number): Promise<ExpenseWithParticipants | null> {
        const expense = await db.query.expenses.findFirst({
          where: eq(expenses.id, expenseId),
          with: {
            participants: { with: { member: true } },
            paidBy: true,
            attachments: true,
          },
        })
        if (!expense) return null

        return {
          ...serializeExpense(expense),
          participants: expense.participants.map((participant) => ({
            ...serializeExpenseParticipant(participant),
            member: participant.member,
          })),
          paidBy: expense.paidBy,
          attachments: expense.attachments.map(serializeAttachment),
        }
      },

      async updateWithParticipants(
        expenseId: number,
        input: UpdateExpenseRecord
      ): Promise<Expense> {
        const [expense] = await db
          .update(expenses)
          .set({
            title: input.title,
            amount: input.amount,
            currency: input.currency,
            paidById: input.paidById,
            date: input.date,
            category: input.category,
            notes: input.notes,
            splitMethod: input.splitMethod,
          })
          .where(eq(expenses.id, expenseId))
          .returning()
        const updated = requireRow(expense, 'Expense')

        await db.delete(expenseParticipants).where(eq(expenseParticipants.expenseId, expenseId))
        await db.insert(expenseParticipants).values(
          input.participants.map((participant) => ({
            expenseId,
            memberId: participant.memberId,
            shareValue: participant.shareValue,
            amountCents: participant.amountCents,
          }))
        )

        return serializeExpense(updated)
      },

      async delete(expenseId: number): Promise<void> {
        await db.delete(expenses).where(eq(expenses.id, expenseId))
      },

      async memberHasExpenses(memberId: number): Promise<boolean> {
        const asPayee = await db
          .select({ id: expenses.id })
          .from(expenses)
          .where(eq(expenses.paidById, memberId))
          .limit(1)
        if (asPayee.length > 0) return true
        const asParticipant = await db
          .select({ id: expenseParticipants.id })
          .from(expenseParticipants)
          .where(eq(expenseParticipants.memberId, memberId))
          .limit(1)
        return asParticipant.length > 0
      },

      async getBalanceData(groupId: number) {
        const members = await db.query.groupMembers.findMany({
          where: eq(groupMembers.groupId, groupId),
        })

        const expenseRows = await db.query.expenses.findMany({
          where: eq(expenses.groupId, groupId),
          with: { participants: true },
        })

        return {
          members,
          expenses: expenseRows.map((expense) => ({
            paidById: expense.paidById,
            totalAmount: expense.amount,
            participantShares: expense.participants.map((participant) => ({
              memberId: participant.memberId,
              amountCents: participant.amountCents,
            })),
          })),
        }
      },
    },

    personal: {
      async create(input: CreatePersonalTransactionRecord): Promise<PersonalTransaction> {
        const [tx] = await db.insert(personalTransactions).values(input).returning()
        return serializePersonalTransaction(tx)
      },

      async findById(id: number): Promise<PersonalTransaction | null> {
        const tx = await db.query.personalTransactions.findFirst({
          where: eq(personalTransactions.id, id),
        })
        return tx ? serializePersonalTransaction(tx) : null
      },

      async findAll(): Promise<PersonalTransaction[]> {
        const txs = await db
          .select()
          .from(personalTransactions)
          .orderBy(desc(personalTransactions.date))

        return txs.map(serializePersonalTransaction)
      },

      async update(id: number, input: UpdatePersonalTransactionRecord): Promise<PersonalTransaction> {
        const [tx] = await db
          .update(personalTransactions)
          .set({
            type: input.type,
            title: input.title,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
            category: input.category,
            note: input.note,
            accountLabel: input.accountLabel,
          })
          .where(eq(personalTransactions.id, id))
          .returning()
        return serializePersonalTransaction(requireRow(tx, 'Transaction'))
      },

      async delete(id: number): Promise<void> {
        await db.delete(personalTransactions).where(eq(personalTransactions.id, id))
      },
    },

    attachments: {
      async create(input: CreateAttachmentRecord): Promise<Attachment> {
        const [row] = await db
          .insert(attachments)
          .values({
            groupId: input.groupId,
            expenseId: input.expenseId,
            storageKey: input.storageKey,
            filename: input.filename,
            contentType: input.contentType,
            size: input.size,
            createdAt: input.createdAt,
          })
          .returning()
        return serializeAttachment(row)
      },

      async findById(id: number): Promise<Attachment | null> {
        const row = await db.query.attachments.findFirst({
          where: eq(attachments.id, id),
        })
        return row ? serializeAttachment(row) : null
      },

      async findByExpense(expenseId: number): Promise<Attachment[]> {
        const rows = await db
          .select()
          .from(attachments)
          .where(eq(attachments.expenseId, expenseId))
        return rows.map(serializeAttachment)
      },

      async findByGroup(groupId: number): Promise<Attachment[]> {
        const rows = await db
          .select()
          .from(attachments)
          .where(eq(attachments.groupId, groupId))
        return rows.map(serializeAttachment)
      },

      async delete(id: number): Promise<void> {
        await db.delete(attachments).where(eq(attachments.id, id))
      },
    },

    settlements: {
      async recordPaid(input): Promise<void> {
        await db.insert(settlements).values({
          groupId: input.groupId,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: input.amount,
          isPaid: true,
          paidAt: input.paidAt,
        })
      },

      async findById(settlementId: number): Promise<Settlement | null> {
        const row = await db.query.settlements.findFirst({
          where: eq(settlements.id, settlementId),
        })
        if (!row) return null

        return serializeSettlement(row)
      },

      async findPaidForGroup(groupId: number): Promise<Settlement[]> {
        const rows = await db
          .select()
          .from(settlements)
          .where(and(eq(settlements.groupId, groupId), eq(settlements.isPaid, true)))
          .orderBy(desc(settlements.paidAt))
        return rows.map(serializeSettlement)
      },

      async undo(settlementId: number): Promise<void> {
        await db.delete(settlements).where(eq(settlements.id, settlementId))
      },
    },

    recurring: {
      async create(input: CreateRecurringRuleRecord): Promise<RecurringRule> {
        const [rule] = await db.insert(recurringRules).values(input).returning()
        return serializeRecurringRule(rule)
      },

      async findAll(): Promise<RecurringRule[]> {
        const rows = await db
          .select()
          .from(recurringRules)
          .orderBy(desc(recurringRules.createdAt))
        return rows.map(serializeRecurringRule)
      },

      async findDue(asOf: Date): Promise<RecurringRule[]> {
        const rows = await db
          .select()
          .from(recurringRules)
          .where(and(eq(recurringRules.active, true), lte(recurringRules.nextRunDate, asOf)))
        return rows.map(serializeRecurringRule)
      },

      async update(id: number, input: UpdateRecurringRuleRecord): Promise<RecurringRule> {
        const [rule] = await db
          .update(recurringRules)
          .set({
            type: input.type,
            title: input.title,
            amount: input.amount,
            currency: input.currency,
            category: input.category,
            note: input.note,
            accountLabel: input.accountLabel,
            frequency: input.frequency,
            intervalCount: input.intervalCount,
            nextRunDate: input.nextRunDate,
          })
          .where(eq(recurringRules.id, id))
          .returning()
        return serializeRecurringRule(requireRow(rule, 'Recurring rule'))
      },

      async toggle(id: number, active: boolean): Promise<RecurringRule> {
        const [rule] = await db
          .update(recurringRules)
          .set({ active })
          .where(eq(recurringRules.id, id))
          .returning()
        return serializeRecurringRule(requireRow(rule, 'Recurring rule'))
      },

      async advance(id: number, nextRunDate: Date, lastRunDate: Date): Promise<void> {
        await db
          .update(recurringRules)
          .set({ nextRunDate, lastRunDate })
          .where(eq(recurringRules.id, id))
      },

      async delete(id: number): Promise<void> {
        await db.delete(recurringRules).where(eq(recurringRules.id, id))
      },
    },

    savings: {
      async create(input: CreateSavingsGoalRecord): Promise<SavingsGoal> {
        const [goal] = await db.insert(savingsGoals).values(input).returning()
        return serializeSavingsGoal(goal)
      },

      async findAll(): Promise<SavingsGoal[]> {
        const rows = await db.select().from(savingsGoals).orderBy(desc(savingsGoals.createdAt))
        return rows.map(serializeSavingsGoal)
      },

      async update(id: number, input: UpdateSavingsGoalRecord): Promise<SavingsGoal> {
        const [goal] = await db
          .update(savingsGoals)
          .set({
            name: input.name,
            targetAmount: input.targetAmount,
            currency: input.currency,
            targetDate: input.targetDate,
          })
          .where(eq(savingsGoals.id, id))
          .returning()
        return serializeSavingsGoal(requireRow(goal, 'Savings goal'))
      },

      async contribute(id: number, amount: number): Promise<SavingsGoal> {
        const [goal] = await db
          .update(savingsGoals)
          .set({ currentAmount: sql`max(0, ${savingsGoals.currentAmount} + ${amount})` })
          .where(eq(savingsGoals.id, id))
          .returning()
        return serializeSavingsGoal(requireRow(goal, 'Savings goal'))
      },

      async delete(id: number): Promise<void> {
        await db.delete(savingsGoals).where(eq(savingsGoals.id, id))
      },
    },

    // Pending unification with `backups` below — see the note on
    // LegacyBackupRepository in lib/backend/ports.ts.
    legacyBackup: {
      async exportAll(): Promise<BackupData> {
        const [
          groupRows,
          memberRows,
          expenseRows,
          participantRows,
          settlementRows,
          personalRows,
          ruleRows,
          goalRows,
          attachmentRows,
        ] = await Promise.all([
          db.select().from(groups),
          db.select().from(groupMembers),
          db.select().from(expenses),
          db.select().from(expenseParticipants),
          db.select().from(settlements),
          db.select().from(personalTransactions),
          db.select().from(recurringRules),
          db.select().from(savingsGoals),
          db.select().from(attachments),
        ])

        return {
          groups: groupRows.map(serializeGroup),
          members: memberRows,
          expenses: expenseRows.map(serializeExpense),
          expenseParticipants: participantRows,
          settlements: settlementRows.map((row) => ({
            ...row,
            paidAt: row.paidAt ? toEpochMs(row.paidAt) : null,
          })),
          personalTransactions: personalRows.map(serializePersonalTransaction),
          recurringRules: ruleRows.map(serializeRecurringRule),
          savingsGoals: goalRows.map(serializeSavingsGoal),
          attachments: attachmentRows.map(serializeAttachment),
        }
      },

      async importAll(data: BackupData): Promise<void> {
        await withBestEffortTransaction(db, async () => {
          // Wipe children before parents so the order also works with
          // foreign keys enforced and no cascades.
          await db.delete(expenseParticipants)
          await db.delete(attachments)
          await db.delete(settlements)
          await db.delete(expenses)
          await db.delete(groupMembers)
          await db.delete(groups)
          await db.delete(personalTransactions)
          await db.delete(recurringRules)
          await db.delete(savingsGoals)

          // Auto-increment assigns fresh ids on insert, so every foreign key
          // is rewritten through an old-id → new-id map.
          const groupIds = new Map<number, number>()
          for (const row of data.groups) {
            const [inserted] = await db
              .insert(groups)
              .values({
                name: row.name,
                token: row.token,
                currency: row.currency,
                isArchived: row.isArchived,
                createdAt: new Date(row.createdAt),
              })
              .returning({ id: groups.id })
            groupIds.set(row.id, inserted.id)
          }

          const memberIds = new Map<number, number>()
          for (const row of data.members) {
            const [inserted] = await db
              .insert(groupMembers)
              .values({
                groupId: mapId(groupIds, row.groupId, 'group'),
                name: row.name,
                email: row.email,
              })
              .returning({ id: groupMembers.id })
            memberIds.set(row.id, inserted.id)
          }

          const expenseIds = new Map<number, number>()
          for (const row of data.expenses) {
            const [inserted] = await db
              .insert(expenses)
              .values({
                groupId: mapId(groupIds, row.groupId, 'group'),
                title: row.title,
                amount: row.amount,
                currency: row.currency,
                paidById: mapId(memberIds, row.paidById, 'member'),
                date: new Date(row.date),
                category: row.category,
                notes: row.notes,
                splitMethod: row.splitMethod,
                createdAt: new Date(row.createdAt),
              })
              .returning({ id: expenses.id })
            expenseIds.set(row.id, inserted.id)
          }

          if (data.expenseParticipants.length > 0) {
            await db.insert(expenseParticipants).values(
              data.expenseParticipants.map((row) => ({
                expenseId: mapId(expenseIds, row.expenseId, 'expense'),
                memberId: mapId(memberIds, row.memberId, 'member'),
                shareValue: row.shareValue,
                amountCents: row.amountCents,
              }))
            )
          }

          if (data.settlements.length > 0) {
            await db.insert(settlements).values(
              data.settlements.map((row) => ({
                groupId: mapId(groupIds, row.groupId, 'group'),
                fromMemberId: mapId(memberIds, row.fromMemberId, 'member'),
                toMemberId: mapId(memberIds, row.toMemberId, 'member'),
                amount: row.amount,
                isPaid: row.isPaid,
                paidAt: row.paidAt === null ? null : new Date(row.paidAt),
              }))
            )
          }

          const ruleIds = new Map<number, number>()
          for (const row of data.recurringRules) {
            const [inserted] = await db
              .insert(recurringRules)
              .values({
                type: row.type,
                title: row.title,
                amount: row.amount,
                currency: row.currency,
                category: row.category,
                note: row.note,
                accountLabel: row.accountLabel,
                frequency: row.frequency,
                intervalCount: row.intervalCount,
                nextRunDate: new Date(row.nextRunDate),
                lastRunDate: row.lastRunDate === null ? null : new Date(row.lastRunDate),
                active: row.active,
                createdAt: new Date(row.createdAt),
              })
              .returning({ id: recurringRules.id })
            ruleIds.set(row.id, inserted.id)
          }

          if (data.personalTransactions.length > 0) {
            await db.insert(personalTransactions).values(
              data.personalTransactions.map((row) => ({
                type: row.type,
                title: row.title,
                amount: row.amount,
                currency: row.currency,
                date: new Date(row.date),
                category: row.category,
                note: row.note,
                accountLabel: row.accountLabel,
                // A dangling rule reference is dropped rather than failing the
                // restore — the transaction itself is still worth keeping.
                sourceRuleId:
                  row.sourceRuleId === null ? null : (ruleIds.get(row.sourceRuleId) ?? null),
                createdAt: new Date(row.createdAt),
              }))
            )
          }

          if (data.savingsGoals.length > 0) {
            await db.insert(savingsGoals).values(
              data.savingsGoals.map((row) => ({
                name: row.name,
                targetAmount: row.targetAmount,
                currentAmount: row.currentAmount,
                currency: row.currency,
                targetDate: row.targetDate === null ? null : new Date(row.targetDate),
                createdAt: new Date(row.createdAt),
              }))
            )
          }

          if (data.attachments.length > 0) {
            await db.insert(attachments).values(
              data.attachments.map((row) => ({
                groupId: mapId(groupIds, row.groupId, 'group'),
                expenseId: row.expenseId === null ? null : mapId(expenseIds, row.expenseId, 'expense'),
                // Keys are kept verbatim so files already present in the
                // uploads directory are found again after a restore.
                storageKey: row.storageKey,
                filename: row.filename,
                contentType: row.contentType,
                size: row.size,
                createdAt: new Date(row.createdAt),
              }))
            )
          }
        })
      },
    },

    backups: {
      async readSnapshot() {
        const [groupRows, memberRows, expenseRows, participantRows, settlementRows, personalRows] =
          await Promise.all([
            db.select().from(groups).orderBy(asc(groups.id)),
            db.select().from(groupMembers).orderBy(asc(groupMembers.id)),
            db.select().from(expenses).orderBy(asc(expenses.id)),
            db.select().from(expenseParticipants).orderBy(asc(expenseParticipants.id)),
            db.select().from(settlements).orderBy(asc(settlements.id)),
            db.select().from(personalTransactions).orderBy(asc(personalTransactions.id)),
          ])

        return {
          groups: groupRows.map(serializeGroup),
          groupMembers: memberRows,
          expenses: expenseRows.map(serializeExpense),
          expenseParticipants: participantRows.map(serializeExpenseParticipant),
          settlements: settlementRows.map(serializeSettlement),
          personalTransactions: personalRows.map(serializePersonalTransaction),
        }
      },

      async restoreSnapshot(data, options) {
        const writer = db as unknown as WriteDb
        await runInSqlTransaction(writer, async () => {
          if (options.replace) {
            await Promise.resolve(writer.delete(expenseParticipants).run())
            await Promise.resolve(writer.delete(settlements).run())
            await Promise.resolve(writer.delete(expenses).run())
            await Promise.resolve(writer.delete(groupMembers).run())
            await Promise.resolve(writer.delete(groups).run())
            await Promise.resolve(writer.delete(personalTransactions).run())
          }

          await insertRows(
            writer,
            groups,
            data.groups.map((group) => ({
              ...group,
              createdAt: new Date(group.createdAt),
            }))
          )
          await insertRows(writer, groupMembers, data.groupMembers)
          await insertRows(
            writer,
            expenses,
            data.expenses.map((expense) => ({
              ...expense,
              date: new Date(expense.date),
              createdAt: new Date(expense.createdAt),
            }))
          )
          await insertRows(writer, expenseParticipants, data.expenseParticipants)
          await insertRows(
            writer,
            settlements,
            data.settlements.map((settlement) => ({
              ...settlement,
              paidAt: settlement.paidAt === null ? null : new Date(settlement.paidAt),
            }))
          )
          await insertRows(
            writer,
            personalTransactions,
            data.personalTransactions.map((transaction) => ({
              ...transaction,
              date: new Date(transaction.date),
              createdAt: new Date(transaction.createdAt),
            }))
          )
        })
      },
    },
  }
}

function mapId(map: Map<number, number>, oldId: number, entity: string): number {
  const newId = map.get(oldId)
  if (newId === undefined) {
    throw new Error(`Backup references a missing ${entity} (id ${oldId})`)
  }
  return newId
}

// better-sqlite3 honors interactive transactions, giving the restore real
// atomicity. D1 rejects BEGIN — there the restore runs statement-by-statement
// and a failure can leave partial data (documented in docs/database.md).
async function withBestEffortTransaction(db: AppDb, fn: () => Promise<void>): Promise<void> {
  let txOpen = false
  try {
    await db.run(sql`begin immediate`)
    txOpen = true
  } catch {
    // Driver without interactive transaction support — proceed unwrapped.
  }

  try {
    await fn()
    if (txOpen) await db.run(sql`commit`)
  } catch (error) {
    if (txOpen) {
      try {
        await db.run(sql`rollback`)
      } catch {
        // Rollback failure leaves nothing more to do; surface the original error.
      }
    }
    throw error
  }
}
