export const DEFAULT_CURRENCY = 'CAD' as const

export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

export const GROUP_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Accommodation',
  'Entertainment',
  'Groceries',
  'Utilities',
  'Shopping',
  'Health',
  'Other',
] as const

export const PERSONAL_INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Other Income',
] as const

export const PERSONAL_EXPENSE_CATEGORIES = [
  'Housing',
  'Food & Dining',
  'Transport',
  'Utilities',
  'Entertainment',
  'Health',
  'Shopping',
  'Insurance',
  'Education',
  'Savings',
  'Other',
] as const

export const SPLIT_METHODS = [
  { value: 'equal', label: 'Split equally' },
  { value: 'exact', label: 'Exact amounts' },
  { value: 'percentage', label: 'By percentage' },
  { value: 'shares', label: 'By shares' },
] as const

export const GROUP_TOKEN_LENGTH = 8

export const DB_PATH = process.env.DATABASE_URL ?? './fairtab.db'
