import type {
  ExpenseWithParticipants,
  GroupWithMembers,
  PersonalTransaction,
  SettlementSuggestion,
} from '@/types'

export const mockGroup: GroupWithMembers = {
  id: 1,
  name: 'Montreal Trip',
  token: 'trip1234',
  currency: 'CAD',
  createdAt: Date.UTC(2026, 4, 1, 12),
  members: [
    { id: 1, groupId: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, groupId: 1, name: 'Bob', email: null },
    { id: 3, groupId: 1, name: 'Cara', email: null },
  ],
}

export const mockExpenses: ExpenseWithParticipants[] = [
  {
    id: 1,
    groupId: mockGroup.id,
    title: 'Cabin rental',
    amount: 9000,
    currency: 'CAD',
    paidById: 1,
    date: Date.UTC(2026, 4, 10, 12),
    category: 'Lodging',
    notes: null,
    splitMethod: 'equal',
    createdAt: Date.UTC(2026, 4, 10, 12),
    paidBy: mockGroup.members[0],
    participants: mockGroup.members.map((member, index) => ({
      id: index + 1,
      expenseId: 1,
      memberId: member.id,
      shareValue: 1,
      amountCents: 3000,
      member,
    })),
  },
]

export const mockSettlementSuggestions: SettlementSuggestion[] = [
  {
    fromMember: mockGroup.members[1],
    toMember: mockGroup.members[0],
    amount: 3000,
  },
  {
    fromMember: mockGroup.members[2],
    toMember: mockGroup.members[0],
    amount: 3000,
  },
]

export const mockPersonalTransactions: PersonalTransaction[] = [
  {
    id: 1,
    type: 'income',
    title: 'Paycheque',
    amount: 250000,
    currency: 'CAD',
    date: Date.UTC(2026, 4, 15, 12),
    category: 'Salary',
    note: null,
    accountLabel: 'Chequing',
    createdAt: Date.UTC(2026, 4, 15, 12),
  },
  {
    id: 2,
    type: 'expense',
    title: 'Groceries',
    amount: 8450,
    currency: 'CAD',
    date: Date.UTC(2026, 4, 16, 12),
    category: 'Groceries',
    note: null,
    accountLabel: 'Credit Card',
    createdAt: Date.UTC(2026, 4, 16, 12),
  },
]
