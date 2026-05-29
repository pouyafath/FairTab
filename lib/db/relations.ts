import { relations } from 'drizzle-orm'
import { groups, groupMembers, expenses, expenseParticipants, settlements } from './schema'

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  expenses: many(expenses),
  settlements: many(settlements),
}))

export const groupMembersRelations = relations(groupMembers, ({ one, many }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  expenseParticipants: many(expenseParticipants),
}))

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
  paidBy: one(groupMembers, { fields: [expenses.paidById], references: [groupMembers.id] }),
  participants: many(expenseParticipants),
}))

export const expenseParticipantsRelations = relations(expenseParticipants, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseParticipants.expenseId],
    references: [expenses.id],
  }),
  member: one(groupMembers, {
    fields: [expenseParticipants.memberId],
    references: [groupMembers.id],
  }),
}))

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, { fields: [settlements.groupId], references: [groups.id] }),
  fromMember: one(groupMembers, {
    fields: [settlements.fromMemberId],
    references: [groupMembers.id],
  }),
  toMember: one(groupMembers, {
    fields: [settlements.toMemberId],
    references: [groupMembers.id],
  }),
}))
