import type {
  Attachment,
  Expense,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  RawExpenseData,
  RecurringFrequency,
  RecurringRule,
  SavingsGoal,
  Settlement,
  SplitMethod,
  TransactionType,
} from '@/types'
import type {
  BackupData,
  BackupFile,
  BackupRestoreOptions,
  BackupRestoreResult,
  BackupValidationResult,
} from '@/lib/backups/types'

export interface CreateGroupRecord {
  name: string
  currency: string
  token: string
  createdAt: Date
}

export interface AddMemberRecord {
  groupId: number
  name: string
  email: string | null
}

export interface ExpenseParticipantRecord {
  memberId: number
  shareValue: number
  amountCents: number
}

export interface CreateExpenseRecord {
  groupId: number
  title: string
  amount: number
  currency: string
  paidById: number
  date: Date
  category: string | null
  notes: string | null
  splitMethod: SplitMethod
  createdAt: Date
  participants: ExpenseParticipantRecord[]
}

export interface UpdateExpenseRecord {
  title: string
  amount: number
  currency: string
  paidById: number
  date: Date
  category: string | null
  notes: string | null
  splitMethod: SplitMethod
  participants: ExpenseParticipantRecord[]
}

export interface BalanceData {
  members: GroupMember[]
  expenses: RawExpenseData[]
}

export interface CreatePersonalTransactionRecord {
  type: TransactionType
  title: string
  amount: number
  currency: string
  date: Date
  category: string | null
  note: string | null
  accountLabel: string | null
  sourceRuleId: number | null
  createdAt: Date
}

export interface UpdateGroupRecord {
  name?: string
  currency?: string
  isArchived?: boolean
}

export interface UpdateMemberRecord {
  name: string
  email: string | null
}

export interface UpdatePersonalTransactionRecord {
  type: TransactionType
  title: string
  amount: number
  currency: string
  date: Date
  category: string | null
  note: string | null
  accountLabel: string | null
  // Set to null to detach a rule-materialized transaction from its rule.
  sourceRuleId?: number | null
}

export interface RecordPaidSettlementInput {
  groupId: number
  fromMemberId: number
  toMemberId: number
  amount: number
  paidAt: Date
}

export interface CreateRecurringRuleRecord {
  type: TransactionType
  title: string
  amount: number
  currency: string
  category: string | null
  note: string | null
  accountLabel: string | null
  frequency: RecurringFrequency
  intervalCount: number
  anchorDay: number | null
  nextRunDate: Date
  createdAt: Date
}

export interface UpdateRecurringRuleRecord {
  type: TransactionType
  title: string
  amount: number
  currency: string
  category: string | null
  note: string | null
  accountLabel: string | null
  frequency: RecurringFrequency
  intervalCount: number
  anchorDay: number | null
  nextRunDate: Date
}

export interface GroupRepository {
  create(input: CreateGroupRecord): Promise<Group>
  findByToken(token: string): Promise<GroupWithMembers | null>
  findById(groupId: number): Promise<GroupWithMembers | null>
  findByMemberId(memberId: number): Promise<GroupWithMembers | null>
  update(groupId: number, input: UpdateGroupRecord): Promise<Group>
  delete(groupId: number): Promise<void>
  addMember(input: AddMemberRecord): Promise<GroupMember>
  updateMember(memberId: number, input: UpdateMemberRecord): Promise<GroupMember>
  removeMember(memberId: number): Promise<void>
}

export interface ExpenseRepository {
  createWithParticipants(input: CreateExpenseRecord): Promise<Expense>
  findForGroup(groupId: number): Promise<ExpenseWithParticipants[]>
  findById(expenseId: number): Promise<ExpenseWithParticipants | null>
  updateWithParticipants(expenseId: number, input: UpdateExpenseRecord): Promise<Expense>
  delete(expenseId: number): Promise<void>
  getBalanceData(groupId: number): Promise<BalanceData>
  memberHasExpenses(memberId: number): Promise<boolean>
  groupHasExpenses(groupId: number): Promise<boolean>
}

export interface PersonalRepository {
  create(input: CreatePersonalTransactionRecord): Promise<PersonalTransaction>
  createIfAbsent(input: CreatePersonalTransactionRecord): Promise<PersonalTransaction | null>
  findById(id: number): Promise<PersonalTransaction | null>
  findAll(): Promise<PersonalTransaction[]>
  update(id: number, input: UpdatePersonalTransactionRecord): Promise<PersonalTransaction>
  delete(id: number): Promise<void>
}

export interface SettlementRepository {
  recordPaid(input: RecordPaidSettlementInput): Promise<void>
  findById(settlementId: number): Promise<Settlement | null>
  findPaidForGroup(groupId: number): Promise<Settlement[]>
  undo(settlementId: number): Promise<void>
  memberHasSettlements(memberId: number): Promise<boolean>
}

export interface RecurringRepository {
  create(input: CreateRecurringRuleRecord): Promise<RecurringRule>
  findAll(): Promise<RecurringRule[]>
  findDue(asOf: Date): Promise<RecurringRule[]>
  update(id: number, input: UpdateRecurringRuleRecord): Promise<RecurringRule>
  toggle(id: number, active: boolean): Promise<RecurringRule>
  advance(id: number, nextRunDate: Date, lastRunDate: Date): Promise<void>
  delete(id: number): Promise<void>
}

export interface CreateSavingsGoalRecord {
  name: string
  targetAmount: number
  currentAmount: number
  currency: string
  targetDate: Date | null
  createdAt: Date
}

export interface UpdateSavingsGoalRecord {
  name: string
  targetAmount: number
  currency: string
  targetDate: Date | null
}

export interface SavingsGoalRepository {
  create(input: CreateSavingsGoalRecord): Promise<SavingsGoal>
  findAll(): Promise<SavingsGoal[]>
  update(id: number, input: UpdateSavingsGoalRecord): Promise<SavingsGoal>
  contribute(id: number, amount: number): Promise<SavingsGoal>
  delete(id: number): Promise<void>
}

export interface CreateAttachmentRecord {
  groupId: number
  expenseId: number | null
  storageKey: string
  filename: string
  contentType: string
  size: number
  createdAt: Date
}

export interface AttachmentRepository {
  create(input: CreateAttachmentRecord): Promise<Attachment>
  findById(id: number): Promise<Attachment | null>
  findByExpense(expenseId: number): Promise<Attachment[]>
  findByGroup(groupId: number): Promise<Attachment[]>
  delete(id: number): Promise<void>
}

export interface BackupRepository {
  readSnapshot(): Promise<BackupData>
  restoreSnapshot(data: BackupData, options: { replace: boolean }): Promise<void>
}

export interface AppRepositories {
  groups: GroupRepository
  expenses: ExpenseRepository
  personal: PersonalRepository
  settlements: SettlementRepository
  recurring: RecurringRepository
  savings: SavingsGoalRepository
  attachments: AttachmentRepository
  backups: BackupRepository
}

export interface BackupService {
  createBackup(): Promise<BackupFile>
  validateBackup(payload: unknown): Promise<BackupValidationResult>
  restoreBackup(payload: unknown, options: BackupRestoreOptions): Promise<BackupRestoreResult>
}
