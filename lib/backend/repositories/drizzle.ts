import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  expenseParticipants,
  expenses,
  groupMembers,
  groups,
  personalTransactions,
  settlements,
} from '@/lib/db/schema'
import type {
  AppRepositories,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  UpdateExpenseRecord,
  UpdateGroupRecord,
  UpdateMemberRecord,
  UpdatePersonalTransactionRecord,
} from '@/lib/backend/ports'
import type {
  Expense,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
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
    date: toEpochMs(row.date),
    createdAt: toEpochMs(row.createdAt),
  }
}

function serializeExpenseParticipant(
  row: typeof expenseParticipants.$inferSelect
): ExpenseParticipant {
  return row
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
        }))
      },

      async findById(expenseId: number): Promise<ExpenseWithParticipants | null> {
        const expense = await db.query.expenses.findFirst({
          where: eq(expenses.id, expenseId),
          with: {
            participants: { with: { member: true } },
            paidBy: true,
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

    backups: {
      async readSnapshot() {
        const [
          groupRows,
          memberRows,
          expenseRows,
          participantRows,
          settlementRows,
          personalRows,
        ] = await Promise.all([
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
