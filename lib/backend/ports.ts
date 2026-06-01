import type {
  Expense,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  RawExpenseData,
  SplitMethod,
  TransactionType,
} from '@/types'

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
  createdAt: Date
}

export interface RecordPaidSettlementInput {
  groupId: number
  fromMemberId: number
  toMemberId: number
  amount: number
  paidAt: Date
}

export interface GroupRepository {
  create(input: CreateGroupRecord): Promise<Group>
  findByToken(token: string): Promise<GroupWithMembers | null>
  addMember(input: AddMemberRecord): Promise<GroupMember>
}

export interface ExpenseRepository {
  createWithParticipants(input: CreateExpenseRecord): Promise<Expense>
  findForGroup(groupId: number): Promise<ExpenseWithParticipants[]>
  getBalanceData(groupId: number): Promise<BalanceData>
}

export interface PersonalRepository {
  create(input: CreatePersonalTransactionRecord): Promise<PersonalTransaction>
  findAll(): Promise<PersonalTransaction[]>
  delete(id: number): Promise<void>
}

export interface SettlementRepository {
  recordPaid(input: RecordPaidSettlementInput): Promise<void>
}

export interface AppRepositories {
  groups: GroupRepository
  expenses: ExpenseRepository
  personal: PersonalRepository
  settlements: SettlementRepository
}
