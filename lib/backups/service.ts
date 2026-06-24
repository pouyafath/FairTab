import { z } from 'zod'
import { CURRENCIES } from '@/lib/constants'
import type {
  BackupData,
  BackupFile,
  BackupTableName,
  BackupValidationOptions,
  BackupValidationResult,
} from './types'
import { BACKUP_FORMAT, BACKUP_VERSION } from './types'

const TABLES = [
  'groups',
  'groupMembers',
  'expenses',
  'expenseParticipants',
  'settlements',
  'personalTransactions',
  'recurringRules',
  'savingsGoals',
  'attachments',
] as const satisfies readonly BackupTableName[]

const DEFAULT_FUTURE_GRACE_MS = 24 * 60 * 60 * 1000

const splitMethodSchema = z.enum(['equal', 'exact', 'percentage', 'shares'])
const transactionTypeSchema = z.enum(['income', 'expense'])
const currencySchema = z.enum(CURRENCIES)
const optionalTextSchema = z.string().nullable()
const idSchema = z.number().int().positive()
const timestampSchema = z.number().int().nonnegative()
const centsSchema = z.number().int().positive()

const groupSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  token: z.string().min(1),
  currency: currencySchema,
  isArchived: z.boolean(),
  createdAt: timestampSchema,
})

const groupMemberSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  name: z.string().min(1),
  email: optionalTextSchema,
})

const expenseSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  title: z.string().min(1),
  amount: centsSchema,
  currency: currencySchema,
  paidById: idSchema,
  date: timestampSchema,
  category: optionalTextSchema,
  notes: optionalTextSchema,
  splitMethod: splitMethodSchema,
  createdAt: timestampSchema,
})

const expenseParticipantSchema = z.object({
  id: idSchema,
  expenseId: idSchema,
  memberId: idSchema,
  shareValue: z.number().int().positive(),
  amountCents: z.number().int().nonnegative(),
})

const settlementSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  fromMemberId: idSchema,
  toMemberId: idSchema,
  amount: centsSchema,
  isPaid: z.boolean(),
  paidAt: timestampSchema.nullable(),
})

const personalTransactionSchema = z.object({
  id: idSchema,
  type: transactionTypeSchema,
  title: z.string().min(1),
  amount: centsSchema,
  currency: currencySchema,
  date: timestampSchema,
  category: optionalTextSchema,
  note: optionalTextSchema,
  accountLabel: optionalTextSchema,
  sourceRuleId: idSchema.nullable(),
  createdAt: timestampSchema,
})

const recurringRuleSchema = z.object({
  id: idSchema,
  type: transactionTypeSchema,
  title: z.string().min(1),
  amount: centsSchema,
  currency: currencySchema,
  category: optionalTextSchema,
  note: optionalTextSchema,
  accountLabel: optionalTextSchema,
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
  intervalCount: z.number().int().positive(),
  nextRunDate: timestampSchema,
  lastRunDate: timestampSchema.nullable(),
  active: z.boolean(),
  createdAt: timestampSchema,
})

const savingsGoalSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  targetAmount: centsSchema,
  currentAmount: z.number().int().nonnegative(),
  currency: currencySchema,
  targetDate: timestampSchema.nullable(),
  createdAt: timestampSchema,
})

const attachmentSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  expenseId: idSchema.nullable(),
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  createdAt: timestampSchema,
})

const backupDataSchema = z.object({
  groups: z.array(groupSchema),
  groupMembers: z.array(groupMemberSchema),
  expenses: z.array(expenseSchema),
  expenseParticipants: z.array(expenseParticipantSchema),
  settlements: z.array(settlementSchema),
  personalTransactions: z.array(personalTransactionSchema),
  // Added in v2; defaulted so older 6-entity fairtab.backup files still validate.
  recurringRules: z.array(recurringRuleSchema).default([]),
  savingsGoals: z.array(savingsGoalSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
})

const rowCountsSchema = z.object({
  groups: z.number().int().nonnegative(),
  groupMembers: z.number().int().nonnegative(),
  expenses: z.number().int().nonnegative(),
  expenseParticipants: z.number().int().nonnegative(),
  settlements: z.number().int().nonnegative(),
  personalTransactions: z.number().int().nonnegative(),
  recurringRules: z.number().int().nonnegative().default(0),
  savingsGoals: z.number().int().nonnegative().default(0),
  attachments: z.number().int().nonnegative().default(0),
})

const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().datetime(),
  app: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    commit: z.string().nullable(),
    buildTime: z.string().nullable(),
  }),
  rowCounts: rowCountsSchema,
  data: backupDataSchema,
})

function summarize(data?: Partial<BackupData>): Record<BackupTableName, number> {
  return {
    groups: data?.groups?.length ?? 0,
    groupMembers: data?.groupMembers?.length ?? 0,
    expenses: data?.expenses?.length ?? 0,
    expenseParticipants: data?.expenseParticipants?.length ?? 0,
    settlements: data?.settlements?.length ?? 0,
    personalTransactions: data?.personalTransactions?.length ?? 0,
    recurringRules: data?.recurringRules?.length ?? 0,
    savingsGoals: data?.savingsGoals?.length ?? 0,
    attachments: data?.attachments?.length ?? 0,
  }
}

function pathToString(path: (string | number | symbol)[]): string {
  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
    .join('.')
    .replaceAll('.[', '[')
}

function indexById<T extends { id: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

function addUniqueCheck<T>(
  rows: T[],
  label: string,
  getKey: (row: T) => string | number,
  errors: BackupValidationResult['errors']
) {
  const seen = new Map<string | number, number>()
  rows.forEach((row, index) => {
    const key = getKey(row)
    const previous = seen.get(key)
    if (previous !== undefined) {
      errors.push({
        code: 'duplicate',
        message: `${label} "${key}" is duplicated at rows ${previous} and ${index}.`,
      })
      return
    }
    seen.set(key, index)
  })
}

function addConflict(
  result: BackupValidationResult,
  table: BackupTableName,
  identifier: string,
  message: string
) {
  result.conflicts.push({ table, identifier, message })
}

function addFutureTimestampWarning(
  result: BackupValidationResult,
  path: string,
  value: number | string,
  maxExpectedTimestamp: number
) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : value
  if (!Number.isFinite(timestamp) || timestamp <= maxExpectedTimestamp) return

  result.warnings.push({
    code: 'future_timestamp',
    message: `${path} is later than expected for this restore environment.`,
    path,
  })
}

function addFutureTimestampWarnings(
  result: BackupValidationResult,
  backup: BackupFile,
  options: BackupValidationOptions
) {
  const now = options.now ?? new Date()
  const maxExpectedTimestamp = now.getTime() + (options.futureGraceMs ?? DEFAULT_FUTURE_GRACE_MS)

  addFutureTimestampWarning(result, 'exportedAt', backup.exportedAt, maxExpectedTimestamp)

  backup.data.groups.forEach((group, index) => {
    addFutureTimestampWarning(
      result,
      `data.groups[${index}].createdAt`,
      group.createdAt,
      maxExpectedTimestamp
    )
  })

  backup.data.expenses.forEach((expense, index) => {
    addFutureTimestampWarning(
      result,
      `data.expenses[${index}].date`,
      expense.date,
      maxExpectedTimestamp
    )
    addFutureTimestampWarning(
      result,
      `data.expenses[${index}].createdAt`,
      expense.createdAt,
      maxExpectedTimestamp
    )
  })

  backup.data.settlements.forEach((settlement, index) => {
    if (settlement.paidAt !== null) {
      addFutureTimestampWarning(
        result,
        `data.settlements[${index}].paidAt`,
        settlement.paidAt,
        maxExpectedTimestamp
      )
    }
  })

  backup.data.personalTransactions.forEach((transaction, index) => {
    addFutureTimestampWarning(
      result,
      `data.personalTransactions[${index}].date`,
      transaction.date,
      maxExpectedTimestamp
    )
    addFutureTimestampWarning(
      result,
      `data.personalTransactions[${index}].createdAt`,
      transaction.createdAt,
      maxExpectedTimestamp
    )
  })
}

export function createBackupFile(input: {
  data: BackupData
  exportedAt: Date
  app: BackupFile['app']
}): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    app: input.app,
    rowCounts: summarize(input.data),
    data: input.data,
  }
}

export function parseBackupFile(payload: unknown):
  | { success: true; backup: BackupFile }
  | { success: false; validation: BackupValidationResult } {
  const parsed = backupFileSchema.safeParse(payload)
  if (parsed.success) return { success: true, backup: parsed.data }

  return {
    success: false,
    validation: {
      valid: false,
      canRestore: false,
      summary: summarize(),
      errors: parsed.error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: pathToString(issue.path),
      })),
      warnings: [],
      conflicts: [],
    },
  }
}

export function validateBackupFile(
  payload: unknown,
  currentData?: BackupData,
  options: BackupValidationOptions = {}
): BackupValidationResult {
  const result: BackupValidationResult = {
    valid: false,
    canRestore: false,
    summary: summarize(),
    errors: [],
    warnings: [],
    conflicts: [],
  }

  const parsed = parseBackupFile(payload)
  if (currentData) result.currentSummary = summarize(currentData)
  if (!parsed.success) {
    return currentData
      ? { ...parsed.validation, currentSummary: summarize(currentData) }
      : parsed.validation
  }

  const backup = parsed.backup
  const data = backup.data
  result.summary = summarize(data)

  addFutureTimestampWarnings(result, backup, options)

  for (const table of TABLES) {
    if (backup.rowCounts[table] !== result.summary[table]) {
      result.warnings.push({
        code: 'row_count_mismatch',
        message: `Declared ${table} row count is ${backup.rowCounts[table]}, but backup contains ${result.summary[table]}.`,
        path: `rowCounts.${table}`,
      })
    }
  }

  addUniqueCheck(data.groups, 'Group id', (row) => row.id, result.errors)
  addUniqueCheck(data.groups, 'Group token', (row) => row.token, result.errors)
  addUniqueCheck(data.groupMembers, 'Member id', (row) => row.id, result.errors)
  addUniqueCheck(data.expenses, 'Expense id', (row) => row.id, result.errors)
  addUniqueCheck(data.expenseParticipants, 'Expense participant id', (row) => row.id, result.errors)
  addUniqueCheck(
    data.expenseParticipants,
    'Expense participant pair',
    (row) => `${row.expenseId}:${row.memberId}`,
    result.errors
  )
  addUniqueCheck(data.settlements, 'Settlement id', (row) => row.id, result.errors)
  addUniqueCheck(data.personalTransactions, 'Personal transaction id', (row) => row.id, result.errors)
  addUniqueCheck(
    data.personalTransactions.filter((row) => row.sourceRuleId !== null),
    'Recurring rule occurrence',
    (row) => `${row.sourceRuleId}:${row.date}`,
    result.errors
  )
  addUniqueCheck(data.recurringRules, 'Recurring rule id', (row) => row.id, result.errors)
  addUniqueCheck(data.savingsGoals, 'Savings goal id', (row) => row.id, result.errors)
  addUniqueCheck(data.attachments, 'Attachment id', (row) => row.id, result.errors)
  addUniqueCheck(data.attachments, 'Attachment storage key', (row) => row.storageKey, result.errors)

  const groupsById = indexById(data.groups)
  const membersById = indexById(data.groupMembers)
  const expensesById = indexById(data.expenses)
  const rulesById = indexById(data.recurringRules)

  for (const member of data.groupMembers) {
    if (!groupsById.has(member.groupId)) {
      result.errors.push({
        code: 'missing_group',
        message: `Member ${member.id} references missing group ${member.groupId}.`,
        path: 'data.groupMembers',
      })
    }
  }

  for (const expense of data.expenses) {
    const group = groupsById.get(expense.groupId)
    const paidBy = membersById.get(expense.paidById)
    if (!group) {
      result.errors.push({
        code: 'missing_group',
        message: `Expense ${expense.id} references missing group ${expense.groupId}.`,
        path: 'data.expenses',
      })
    }
    if (!paidBy) {
      result.errors.push({
        code: 'missing_member',
        message: `Expense ${expense.id} references missing payer ${expense.paidById}.`,
        path: 'data.expenses',
      })
    } else if (paidBy.groupId !== expense.groupId) {
      result.errors.push({
        code: 'cross_group_payer',
        message: `Expense ${expense.id} payer ${paidBy.id} does not belong to group ${expense.groupId}.`,
        path: 'data.expenses',
      })
    }
    if (group && expense.currency !== group.currency) {
      result.warnings.push({
        code: 'currency_mismatch',
        message: `Expense ${expense.id} uses ${expense.currency}, but group ${group.id} uses ${group.currency}.`,
        path: 'data.expenses',
      })
    }
  }

  const participantsByExpense = new Map<number, typeof data.expenseParticipants>()
  for (const participant of data.expenseParticipants) {
    const expense = expensesById.get(participant.expenseId)
    const member = membersById.get(participant.memberId)
    if (!expense) {
      result.errors.push({
        code: 'missing_expense',
        message: `Participant ${participant.id} references missing expense ${participant.expenseId}.`,
        path: 'data.expenseParticipants',
      })
    }
    if (!member) {
      result.errors.push({
        code: 'missing_member',
        message: `Participant ${participant.id} references missing member ${participant.memberId}.`,
        path: 'data.expenseParticipants',
      })
    }
    if (expense && member && member.groupId !== expense.groupId) {
      result.errors.push({
        code: 'cross_group_participant',
        message: `Participant ${participant.id} member ${member.id} does not belong to expense group ${expense.groupId}.`,
        path: 'data.expenseParticipants',
      })
    }
    participantsByExpense.set(participant.expenseId, [
      ...(participantsByExpense.get(participant.expenseId) ?? []),
      participant,
    ])
  }

  for (const expense of data.expenses) {
    const participants = participantsByExpense.get(expense.id) ?? []
    if (participants.length === 0) {
      result.errors.push({
        code: 'missing_participants',
        message: `Expense ${expense.id} has no participant rows.`,
        path: 'data.expenses',
      })
      continue
    }

    const participantTotal = participants.reduce((total, participant) => total + participant.amountCents, 0)
    if (participantTotal !== expense.amount) {
      result.errors.push({
        code: 'split_total_mismatch',
        message: `Expense ${expense.id} participant total is ${participantTotal}, expected ${expense.amount}.`,
        path: 'data.expenseParticipants',
      })
    }
  }

  for (const settlement of data.settlements) {
    const fromMember = membersById.get(settlement.fromMemberId)
    const toMember = membersById.get(settlement.toMemberId)
    if (!groupsById.has(settlement.groupId)) {
      result.errors.push({
        code: 'missing_group',
        message: `Settlement ${settlement.id} references missing group ${settlement.groupId}.`,
        path: 'data.settlements',
      })
    }
    if (!fromMember || !toMember) {
      result.errors.push({
        code: 'missing_member',
        message: `Settlement ${settlement.id} references a missing member.`,
        path: 'data.settlements',
      })
      continue
    }
    if (fromMember.id === toMember.id) {
      result.errors.push({
        code: 'self_settlement',
        message: `Settlement ${settlement.id} pays the same member.`,
        path: 'data.settlements',
      })
    }
    if (fromMember.groupId !== settlement.groupId || toMember.groupId !== settlement.groupId) {
      result.errors.push({
        code: 'cross_group_settlement',
        message: `Settlement ${settlement.id} members do not both belong to group ${settlement.groupId}.`,
        path: 'data.settlements',
      })
    }
    if (settlement.isPaid && settlement.paidAt === null) {
      result.errors.push({
        code: 'missing_paid_at',
        message: `Paid settlement ${settlement.id} is missing paidAt.`,
        path: 'data.settlements',
      })
    }
  }

  for (const attachment of data.attachments) {
    if (!groupsById.has(attachment.groupId)) {
      result.errors.push({
        code: 'missing_group',
        message: `Attachment ${attachment.id} references missing group ${attachment.groupId}.`,
        path: 'data.attachments',
      })
    }
    if (attachment.expenseId !== null && !expensesById.has(attachment.expenseId)) {
      result.errors.push({
        code: 'missing_expense',
        message: `Attachment ${attachment.id} references missing expense ${attachment.expenseId}.`,
        path: 'data.attachments',
      })
    }
  }

  // A transaction whose generating rule is absent restores fine (sourceRuleId is a
  // soft link with no FK), but flag it so the operator knows the badge will be stale.
  for (const transaction of data.personalTransactions) {
    if (transaction.sourceRuleId !== null && !rulesById.has(transaction.sourceRuleId)) {
      result.warnings.push({
        code: 'missing_recurring_rule',
        message: `Personal transaction ${transaction.id} references missing recurring rule ${transaction.sourceRuleId}.`,
        path: 'data.personalTransactions',
      })
    }
  }

  if (currentData) {
    const currentGroupsById = indexById(currentData.groups)
    const currentGroupTokens = new Set(currentData.groups.map((group) => group.token))
    const currentMembersById = indexById(currentData.groupMembers)
    const currentExpensesById = indexById(currentData.expenses)
    const currentParticipantsById = indexById(currentData.expenseParticipants)
    const currentSettlementsById = indexById(currentData.settlements)
    const currentTransactionsById = indexById(currentData.personalTransactions)
    const currentRulesById = indexById(currentData.recurringRules)
    const currentGoalsById = indexById(currentData.savingsGoals)
    const currentAttachmentsById = indexById(currentData.attachments)
    const currentStorageKeys = new Set(currentData.attachments.map((a) => a.storageKey))

    for (const group of data.groups) {
      if (currentGroupsById.has(group.id)) addConflict(result, 'groups', String(group.id), 'Group id already exists.')
      if (currentGroupTokens.has(group.token)) addConflict(result, 'groups', group.token, 'Group token already exists.')
    }
    for (const member of data.groupMembers) {
      if (currentMembersById.has(member.id)) addConflict(result, 'groupMembers', String(member.id), 'Member id already exists.')
    }
    for (const expense of data.expenses) {
      if (currentExpensesById.has(expense.id)) addConflict(result, 'expenses', String(expense.id), 'Expense id already exists.')
    }
    for (const participant of data.expenseParticipants) {
      if (currentParticipantsById.has(participant.id)) {
        addConflict(result, 'expenseParticipants', String(participant.id), 'Participant id already exists.')
      }
    }
    for (const settlement of data.settlements) {
      if (currentSettlementsById.has(settlement.id)) {
        addConflict(result, 'settlements', String(settlement.id), 'Settlement id already exists.')
      }
    }
    for (const transaction of data.personalTransactions) {
      if (currentTransactionsById.has(transaction.id)) {
        addConflict(result, 'personalTransactions', String(transaction.id), 'Personal transaction id already exists.')
      }
    }
    for (const rule of data.recurringRules) {
      if (currentRulesById.has(rule.id)) {
        addConflict(result, 'recurringRules', String(rule.id), 'Recurring rule id already exists.')
      }
    }
    for (const goal of data.savingsGoals) {
      if (currentGoalsById.has(goal.id)) {
        addConflict(result, 'savingsGoals', String(goal.id), 'Savings goal id already exists.')
      }
    }
    for (const attachment of data.attachments) {
      if (currentAttachmentsById.has(attachment.id)) {
        addConflict(result, 'attachments', String(attachment.id), 'Attachment id already exists.')
      }
      if (currentStorageKeys.has(attachment.storageKey)) {
        addConflict(result, 'attachments', attachment.storageKey, 'Attachment storage key already exists.')
      }
    }
  }

  result.valid = result.errors.length === 0
  result.canRestore = result.valid && result.conflicts.length === 0
  return result
}
