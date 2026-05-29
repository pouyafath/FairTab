import type {
  ActionResult,
  Expense,
  Group,
  GroupMember,
  PersonalTransaction,
} from '@/types'

export type CreateGroupAction = (formData: unknown) => Promise<ActionResult<Group>>

export type AddGroupMemberAction = (
  groupId: number,
  formData: unknown
) => Promise<ActionResult<GroupMember>>

export type AddExpenseAction = (
  groupId: number,
  formData: unknown
) => Promise<ActionResult<Expense>>

export type AddPersonalTransactionAction = (
  formData: unknown
) => Promise<ActionResult<PersonalTransaction>>

export type DeletePersonalTransactionAction = (id: number) => Promise<ActionResult<void>>

export type MarkSettlementPaidAction = (
  groupId: number,
  fromMemberId: number,
  toMemberId: number,
  amount: number
) => Promise<ActionResult<void>>
