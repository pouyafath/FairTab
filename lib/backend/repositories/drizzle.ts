import 'server-only'

import { and, desc, eq, lte } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  expenseParticipants,
  expenses,
  groupMembers,
  groups,
  personalTransactions,
  recurringRules,
  settlements,
} from '@/lib/db/schema'
import type {
  AppRepositories,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  CreateRecurringRuleRecord,
  UpdateExpenseRecord,
  UpdateGroupRecord,
  UpdateMemberRecord,
  UpdatePersonalTransactionRecord,
  UpdateRecurringRuleRecord,
} from '@/lib/backend/ports'
import type {
  Expense,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  RecurringRule,
  Settlement,
} from '@/types'

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

      async findPaidForGroup(groupId: number): Promise<Settlement[]> {
        const rows = await db
          .select()
          .from(settlements)
          .where(and(eq(settlements.groupId, groupId), eq(settlements.isPaid, true)))
          .orderBy(desc(settlements.paidAt))
        return rows.map((row) => ({
          ...row,
          paidAt: row.paidAt ? toEpochMs(row.paidAt) : null,
        }))
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
        return serializeRecurringRule(rule)
      },

      async toggle(id: number, active: boolean): Promise<RecurringRule> {
        const [rule] = await db
          .update(recurringRules)
          .set({ active })
          .where(eq(recurringRules.id, id))
          .returning()
        return serializeRecurringRule(rule)
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
  }
}
