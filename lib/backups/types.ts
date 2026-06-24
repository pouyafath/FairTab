import type {
  Attachment,
  Expense,
  ExpenseParticipant,
  Group,
  GroupMember,
  PersonalTransaction,
  RecurringRule,
  SavingsGoal,
  Settlement,
} from '@/types'

export const BACKUP_FORMAT = 'fairtab.backup'
export const BACKUP_VERSION = 1

export interface BackupData {
  groups: Group[]
  groupMembers: GroupMember[]
  expenses: Expense[]
  expenseParticipants: ExpenseParticipant[]
  settlements: Settlement[]
  personalTransactions: PersonalTransaction[]
  recurringRules: RecurringRule[]
  savingsGoals: SavingsGoal[]
  attachments: Attachment[]
}

export type BackupTableName = keyof BackupData

export type BackupRestoreMode = 'empty' | 'replace'

export const REPLACE_BACKUP_CONFIRMATION = 'REPLACE ALL FAIRTAB DATA'

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  app: {
    name: string
    version: string
    commit: string | null
    buildTime: string | null
  }
  rowCounts: Record<BackupTableName, number>
  data: BackupData
}

export interface BackupValidationIssue {
  code: string
  message: string
  path?: string
}

export interface BackupValidationConflict {
  table: BackupTableName
  identifier: string
  message: string
}

export interface BackupValidationResult {
  valid: boolean
  canRestore: boolean
  summary: Record<BackupTableName, number>
  currentSummary?: Record<BackupTableName, number>
  errors: BackupValidationIssue[]
  warnings: BackupValidationIssue[]
  conflicts: BackupValidationConflict[]
}

export interface BackupValidationOptions {
  now?: Date
  futureGraceMs?: number
}

export interface BackupRestoreOptions {
  mode: BackupRestoreMode
  confirmation?: string
}

export interface BackupRestoreResult {
  restored: boolean
  mode: BackupRestoreMode
  restoredAt: string | null
  summary: Record<BackupTableName, number>
  validation: BackupValidationResult
  error?: string
}
