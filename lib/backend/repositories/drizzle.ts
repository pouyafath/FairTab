import 'server-only'

import { desc, eq } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  attachments,
  expenseParticipants,
  expenses,
  groupMembers,
  groups,
  personalTransactions,
  settlements,
} from '@/lib/db/schema'
import type {
  AppRepositories,
  CreateAttachmentRecord,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  UpdateExpenseRecord,
  UpdateGroupRecord,
  UpdateMemberRecord,
  UpdatePersonalTransactionRecord,
} from '@/lib/backend/ports'
import type {
  Attachment,
  Expense,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  Settlement,
} from '@/types'

function toEpochMs(value: Date | number | string | null): number {
  if (value === null) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return new Date(value).getTime()
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

function serializeAttachment(row: typeof attachments.$inferSelect): Attachment {
  return {
    ...row,
    expenseId: row.expenseId ?? null,
    createdAt: toEpochMs(row.createdAt),
  }
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
        const [group] = await db
          .update(groups)
          .set({ name: input.name })
          .where(eq(groups.id, groupId))
          .returning()
        return serializeGroup(group)
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
        return member
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

        await db.delete(expenseParticipants).where(eq(expenseParticipants.expenseId, expenseId))
        await db.insert(expenseParticipants).values(
          input.participants.map((participant) => ({
            expenseId,
            memberId: participant.memberId,
            shareValue: participant.shareValue,
            amountCents: participant.amountCents,
          }))
        )

        return serializeExpense(expense)
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
        return serializePersonalTransaction(tx)
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

      async findPaidForGroup(groupId: number): Promise<Settlement[]> {
        const rows = await db
          .select()
          .from(settlements)
          .where(eq(settlements.groupId, groupId))
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
  }
}
