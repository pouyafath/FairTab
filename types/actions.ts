import type {
  ActionResult,
  Expense,
  Group,
  GroupMember,
  PersonalTransaction,
} from '@/types'

export type CreateGroupAction = (formData: unknown) => Promise<ActionResult<Group>>

export type RenameGroupAction = (
  groupId: number,
  formData: unknown
) => Promise<ActionResult<Group>>

export type DeleteGroupAction = (groupId: number) => Promise<ActionResult<void>>

export type AddGroupMemberAction = (
  groupId: number,
  formData: unknown
) => Promise<ActionResult<GroupMember>>

export type UpdateGroupMemberAction = (
  memberId: number,
  formData: unknown
) => Promise<ActionResult<GroupMember>>

export type RemoveGroupMemberAction = (
  groupId: number,
  memberId: number
) => Promise<ActionResult<void>>

export type AddExpenseAction = (
  groupId: number,
  formData: unknown
) => Promise<ActionResult<Expense>>

export type UpdateExpenseAction = (
  expenseId: number,
  formData: unknown
) => Promise<ActionResult<Expense>>

export type DeleteExpenseAction = (expenseId: number) => Promise<ActionResult<void>>

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
