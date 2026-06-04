export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares'

export type TransactionType = 'income' | 'expense'

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface Group {
  id: number
  name: string
  token: string
  currency: string
  isArchived: boolean
  createdAt: number
}

export interface GroupMember {
  id: number
  groupId: number
  name: string
  email: string | null
}

export interface Expense {
  id: number
  groupId: number
  title: string
  amount: number // cents
  currency: string
  paidById: number
  date: number // Unix ms
  category: string | null
  notes: string | null
  splitMethod: SplitMethod
  createdAt: number
}

export interface ExpenseParticipant {
  id: number
  expenseId: number
  memberId: number
  shareValue: number // raw input per split method
  amountCents: number // computed exact cents owed
}

export interface Settlement {
  id: number
  groupId: number
  fromMemberId: number
  toMemberId: number
  amount: number // cents
  isPaid: boolean
  paidAt: number | null
}

export interface PersonalTransaction {
  id: number
  type: TransactionType
  title: string
  amount: number // cents
  currency: string
  date: number // Unix ms
  category: string | null
  note: string | null
  accountLabel: string | null
  sourceRuleId: number | null
  createdAt: number
}

export interface RecurringRule {
  id: number
  type: TransactionType
  title: string
  amount: number // cents
  currency: string
  category: string | null
  note: string | null
  accountLabel: string | null
  frequency: RecurringFrequency
  intervalCount: number
  nextRunDate: number // epoch ms
  lastRunDate: number | null // epoch ms
  active: boolean
  createdAt: number
}

// Derived / computed types for UI

export interface MemberBalance {
  member: GroupMember
  totalPaid: number // cents
  totalOwed: number // cents
  netBalance: number // cents, positive = is owed, negative = owes
}

export interface SettlementSuggestion {
  fromMember: GroupMember
  toMember: GroupMember
  amount: number // cents
}

export interface ExpenseWithParticipants extends Expense {
  participants: (ExpenseParticipant & { member: GroupMember })[]
  paidBy: GroupMember
}

export interface GroupWithMembers extends Group {
  members: GroupMember[]
}

export interface PersonalSummary {
  totalIncome: number // cents
  totalExpenses: number // cents
  netSavings: number // cents
  byCategory: { category: string; amount: number; count: number }[]
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface RawExpenseData {
  paidById: number
  totalAmount: number // cents
  participantShares: { memberId: number; amountCents: number }[]
}
