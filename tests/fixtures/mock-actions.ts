import {
  mockExpenses,
  mockGroup,
  mockPersonalTransactions,
  mockSettlementSuggestions,
} from './fairtab-data'
import type {
  AddExpenseAction,
  AddGroupMemberAction,
  AddPersonalTransactionAction,
  CreateGroupAction,
  DeletePersonalTransactionAction,
  MarkSettlementPaidAction,
} from '@/types/actions'

export const createGroupAction: CreateGroupAction = async () => ({
  success: true,
  data: mockGroup,
})

export const addMemberAction: AddGroupMemberAction = async () => ({
  success: true,
  data: mockGroup.members[0],
})

export const addExpenseAction: AddExpenseAction = async () => ({
  success: true,
  data: mockExpenses[0],
})

export const addPersonalTransactionAction: AddPersonalTransactionAction = async () => ({
  success: true,
  data: mockPersonalTransactions[0],
})

export const deletePersonalTransactionAction: DeletePersonalTransactionAction = async () => ({
  success: true,
  data: undefined,
})

export const markSettlementPaidAction: MarkSettlementPaidAction = async () => ({
  success: true,
  data: undefined,
})

export const mockActions = {
  createGroupAction,
  addMemberAction,
  addExpenseAction,
  addPersonalTransactionAction,
  deletePersonalTransactionAction,
  markSettlementPaidAction,
}

export const mockUiData = {
  group: mockGroup,
  expenses: mockExpenses,
  settlements: mockSettlementSuggestions,
  personalTransactions: mockPersonalTransactions,
}
