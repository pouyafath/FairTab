import { z } from 'zod'
import type { BackupDocument } from '@/types'

const id = z.number().int()
const epochMs = z.number().int()
const cents = z.number().int()

const groupRow = z.object({
  id,
  name: z.string(),
  token: z.string().min(1),
  currency: z.string(),
  isArchived: z.boolean(),
  createdAt: epochMs,
})

const memberRow = z.object({
  id,
  groupId: id,
  name: z.string(),
  email: z.string().nullable(),
})

const expenseRow = z.object({
  id,
  groupId: id,
  title: z.string(),
  amount: cents,
  currency: z.string(),
  paidById: id,
  date: epochMs,
  category: z.string().nullable(),
  notes: z.string().nullable(),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares']),
  createdAt: epochMs,
})

const expenseParticipantRow = z.object({
  id,
  expenseId: id,
  memberId: id,
  shareValue: z.number().int(),
  amountCents: cents,
})

const settlementRow = z.object({
  id,
  groupId: id,
  fromMemberId: id,
  toMemberId: id,
  amount: cents,
  isPaid: z.boolean(),
  paidAt: epochMs.nullable(),
})

const personalTransactionRow = z.object({
  id,
  type: z.enum(['income', 'expense']),
  title: z.string(),
  amount: cents,
  currency: z.string(),
  date: epochMs,
  category: z.string().nullable(),
  note: z.string().nullable(),
  accountLabel: z.string().nullable(),
  sourceRuleId: id.nullable(),
  createdAt: epochMs,
})

const recurringRuleRow = z.object({
  id,
  type: z.enum(['income', 'expense']),
  title: z.string(),
  amount: cents,
  currency: z.string(),
  category: z.string().nullable(),
  note: z.string().nullable(),
  accountLabel: z.string().nullable(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
  intervalCount: z.number().int().min(1),
  nextRunDate: epochMs,
  lastRunDate: epochMs.nullable(),
  active: z.boolean(),
  createdAt: epochMs,
})

const savingsGoalRow = z.object({
  id,
  name: z.string(),
  targetAmount: cents,
  currentAmount: cents,
  currency: z.string(),
  targetDate: epochMs.nullable(),
  createdAt: epochMs,
})

const attachmentRow = z.object({
  id,
  groupId: id,
  expenseId: id.nullable(),
  storageKey: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  createdAt: epochMs,
})

export const backupDocumentSchema: z.ZodType<BackupDocument> = z.object({
  format: z.literal('fairtab-backup'),
  version: z.literal(1),
  generatedAt: z.string(),
  data: z.object({
    groups: z.array(groupRow),
    members: z.array(memberRow),
    expenses: z.array(expenseRow),
    expenseParticipants: z.array(expenseParticipantRow),
    settlements: z.array(settlementRow),
    personalTransactions: z.array(personalTransactionRow),
    recurringRules: z.array(recurringRuleRow),
    savingsGoals: z.array(savingsGoalRow),
    attachments: z.array(attachmentRow),
  }),
})
