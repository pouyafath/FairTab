import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  token: text('token').notNull().unique(),
  currency: text('currency').notNull().default('CAD'),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const groupMembers = sqliteTable('group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
})

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: integer('amount').notNull(), // cents
  currency: text('currency').notNull().default('CAD'),
  paidById: integer('paid_by_id')
    .notNull()
    .references(() => groupMembers.id),
  date: integer('date', { mode: 'timestamp_ms' }).notNull(),
  category: text('category'),
  notes: text('notes'),
  splitMethod: text('split_method', {
    enum: ['equal', 'exact', 'percentage', 'shares'],
  })
    .notNull()
    .default('equal'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const expenseParticipants = sqliteTable('expense_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  expenseId: integer('expense_id')
    .notNull()
    .references(() => expenses.id, { onDelete: 'cascade' }),
  memberId: integer('member_id')
    .notNull()
    .references(() => groupMembers.id, { onDelete: 'cascade' }),
  // Raw input (1 for equal, cents for exact, integer % for percentage, integer shares for shares)
  shareValue: integer('share_value').notNull(),
  // Computed exact amount owed in cents — stored to avoid recalculation
  amountCents: integer('amount_cents').notNull(),
})

export const settlements = sqliteTable('settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  fromMemberId: integer('from_member_id')
    .notNull()
    .references(() => groupMembers.id),
  toMemberId: integer('to_member_id')
    .notNull()
    .references(() => groupMembers.id),
  amount: integer('amount').notNull(), // cents
  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
})

export const recurringRules = sqliteTable('recurring_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  title: text('title').notNull(),
  amount: integer('amount').notNull(), // cents
  currency: text('currency').notNull().default('CAD'),
  category: text('category'),
  note: text('note'),
  accountLabel: text('account_label'),
  frequency: text('frequency', {
    enum: ['weekly', 'biweekly', 'monthly', 'yearly'],
  }).notNull(),
  intervalCount: integer('interval_count').notNull().default(1),
  nextRunDate: integer('next_run_date', { mode: 'timestamp_ms' }).notNull(),
  lastRunDate: integer('last_run_date', { mode: 'timestamp_ms' }),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const savingsGoals = sqliteTable('savings_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(), // cents
  currentAmount: integer('current_amount').notNull().default(0), // cents
  currency: text('currency').notNull().default('CAD'),
  targetDate: integer('target_date', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const personalTransactions = sqliteTable('personal_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  title: text('title').notNull(),
  amount: integer('amount').notNull(), // cents
  currency: text('currency').notNull().default('CAD'),
  date: integer('date', { mode: 'timestamp_ms' }).notNull(),
  category: text('category'),
  note: text('note'),
  accountLabel: text('account_label'),
  sourceRuleId: integer('source_rule_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})
