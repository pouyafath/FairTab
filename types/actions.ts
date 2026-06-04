import type {
  ActionResult,
  Attachment,
  Expense,
  Group,
  GroupMember,
  PersonalTransaction,
} from '@/types'

export type UpdatePersonalTransactionAction = (
  id: number,
  formData: unknown
) => Promise<ActionResult<PersonalTransaction>>

export type UndoSettlementAction = (
  token: string,
  settlementId: number
) => Promise<ActionResult<void>>

export type CreateGroupAction = (formData: unknown) => Promise<ActionResult<Group>>

export type RenameGroupAction = (
  token: string,
  formData: unknown
) => Promise<ActionResult<Group>>

export type DeleteGroupAction = (token: string) => Promise<ActionResult<void>>

export type ArchiveGroupAction = (
  token: string,
  archive: boolean
) => Promise<ActionResult<Group>>

export type AddGroupMemberAction = (
  token: string,
  formData: unknown
) => Promise<ActionResult<GroupMember>>

export type UpdateGroupMemberAction = (
  token: string,
  memberId: number,
  formData: unknown
) => Promise<ActionResult<GroupMember>>

export type RemoveGroupMemberAction = (
  token: string,
  memberId: number
) => Promise<ActionResult<void>>

export type AddExpenseAction = (
  token: string,
  formData: unknown
) => Promise<ActionResult<Expense>>

export type UpdateExpenseAction = (
  token: string,
  expenseId: number,
  formData: unknown
) => Promise<ActionResult<Expense>>

export type DeleteExpenseAction = (
  token: string,
  expenseId: number
) => Promise<ActionResult<void>>

export type AddPersonalTransactionAction = (
  formData: unknown
) => Promise<ActionResult<PersonalTransaction>>

export type DeletePersonalTransactionAction = (id: number) => Promise<ActionResult<void>>

export type MarkSettlementPaidAction = (
  token: string,
  fromMemberId: number,
  toMemberId: number,
  amount: number
) => Promise<ActionResult<void>>

export type DeleteAttachmentAction = (attachmentId: number) => Promise<ActionResult<void>>

export type UploadAttachmentResult = { attachment: Attachment } | { error: string }
