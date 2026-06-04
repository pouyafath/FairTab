import type {
  AppRepositories,
  BalanceData,
  CreateAttachmentRecord,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  ExpenseParticipantRecord,
  RecordPaidSettlementInput,
  UpdateExpenseRecord,
  UpdateGroupRecord,
  UpdateMemberRecord,
  UpdatePersonalTransactionRecord,
} from '@/lib/backend/ports'
import type {
  Attachment,
  Expense,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  Settlement,
} from '@/types'

export interface InMemoryRepositoryState {
  groups: Group[]
  members: GroupMember[]
  expenses: Expense[]
  expenseParticipants: ExpenseParticipant[]
  personalTransactions: PersonalTransaction[]
  settlements: Settlement[]
  attachments: Attachment[]
}

interface Counters {
  groupId: number
  memberId: number
  expenseId: number
  expenseParticipantId: number
  personalTransactionId: number
  settlementId: number
  attachmentId: number
}

function byNewestDate<T extends { date: number }>(a: T, b: T) {
  return b.date - a.date
}

function createCounters(): Counters {
  return {
    groupId: 1,
    memberId: 1,
    expenseId: 1,
    expenseParticipantId: 1,
    personalTransactionId: 1,
    settlementId: 1,
    attachmentId: 1,
  }
}

function participantRows(
  input: CreateExpenseRecord,
  counters: Counters
): ExpenseParticipant[] {
  return input.participants.map((participant: ExpenseParticipantRecord) => ({
    id: counters.expenseParticipantId++,
    expenseId: counters.expenseId,
    memberId: participant.memberId,
    shareValue: participant.shareValue,
    amountCents: participant.amountCents,
  }))
}

export function createInMemoryRepositories(initialState?: Partial<InMemoryRepositoryState>) {
  const state: InMemoryRepositoryState = {
    groups: initialState?.groups ?? [],
    members: initialState?.members ?? [],
    expenses: initialState?.expenses ?? [],
    expenseParticipants: initialState?.expenseParticipants ?? [],
    personalTransactions: initialState?.personalTransactions ?? [],
    settlements: initialState?.settlements ?? [],
    attachments: initialState?.attachments ?? [],
  }
  const counters = createCounters()

  function withParticipants(expense: Expense): ExpenseWithParticipants {
    return {
      ...expense,
      paidBy: state.members.find((member) => member.id === expense.paidById)!,
      participants: state.expenseParticipants
        .filter((participant) => participant.expenseId === expense.id)
        .map((participant) => ({
          ...participant,
          member: state.members.find((member) => member.id === participant.memberId)!,
        })),
      attachments: state.attachments.filter((a) => a.expenseId === expense.id),
    }
  }

  const repositories: AppRepositories = {
    groups: {
      async create(input: CreateGroupRecord): Promise<Group> {
        const group: Group = {
          id: counters.groupId++,
          name: input.name,
          token: input.token,
          currency: input.currency,
          createdAt: input.createdAt.getTime(),
        }
        state.groups.push(group)
        return group
      },

      async findByToken(token: string): Promise<GroupWithMembers | null> {
        const group = state.groups.find((candidate) => candidate.token === token)
        if (!group) return null

        return {
          ...group,
          members: state.members.filter((member) => member.groupId === group.id),
        }
      },

      async update(groupId: number, input: UpdateGroupRecord): Promise<Group> {
        const group = state.groups.find((g) => g.id === groupId)!
        group.name = input.name
        return group
      },

      async delete(groupId: number): Promise<void> {
        const expenseIds = state.expenses.filter((e) => e.groupId === groupId).map((e) => e.id)
        state.expenseParticipants = state.expenseParticipants.filter(
          (p) => !expenseIds.includes(p.expenseId)
        )
        state.attachments = state.attachments.filter((a) => a.groupId !== groupId)
        state.settlements = state.settlements.filter((s) => s.groupId !== groupId)
        state.expenses = state.expenses.filter((e) => e.groupId !== groupId)
        state.members = state.members.filter((m) => m.groupId !== groupId)
        state.groups = state.groups.filter((g) => g.id !== groupId)
      },

      async addMember(input): Promise<GroupMember> {
        const member: GroupMember = {
          id: counters.memberId++,
          groupId: input.groupId,
          name: input.name,
          email: input.email,
        }
        state.members.push(member)
        return member
      },

      async updateMember(memberId: number, input: UpdateMemberRecord): Promise<GroupMember> {
        const member = state.members.find((m) => m.id === memberId)!
        member.name = input.name
        member.email = input.email
        return member
      },

      async removeMember(memberId: number): Promise<void> {
        state.members = state.members.filter((m) => m.id !== memberId)
      },
    },

    expenses: {
      async createWithParticipants(input: CreateExpenseRecord): Promise<Expense> {
        const expense: Expense = {
          id: counters.expenseId,
          groupId: input.groupId,
          title: input.title,
          amount: input.amount,
          currency: input.currency,
          paidById: input.paidById,
          date: input.date.getTime(),
          category: input.category,
          notes: input.notes,
          splitMethod: input.splitMethod,
          createdAt: input.createdAt.getTime(),
        }
        state.expenses.push(expense)
        state.expenseParticipants.push(...participantRows(input, counters))
        counters.expenseId++
        return expense
      },

      async findForGroup(groupId: number): Promise<ExpenseWithParticipants[]> {
        return state.expenses
          .filter((expense) => expense.groupId === groupId)
          .sort(byNewestDate)
          .map((expense) => withParticipants(expense))
      },

      async findById(expenseId: number): Promise<ExpenseWithParticipants | null> {
        const expense = state.expenses.find((candidate) => candidate.id === expenseId)
        return expense ? withParticipants(expense) : null
      },

      async updateWithParticipants(
        expenseId: number,
        input: UpdateExpenseRecord
      ): Promise<Expense> {
        const expense = state.expenses.find((candidate) => candidate.id === expenseId)!
        expense.title = input.title
        expense.amount = input.amount
        expense.currency = input.currency
        expense.paidById = input.paidById
        expense.date = input.date.getTime()
        expense.category = input.category
        expense.notes = input.notes
        expense.splitMethod = input.splitMethod

        state.expenseParticipants = state.expenseParticipants.filter(
          (participant) => participant.expenseId !== expenseId
        )
        state.expenseParticipants.push(
          ...input.participants.map((participant: ExpenseParticipantRecord) => ({
            id: counters.expenseParticipantId++,
            expenseId,
            memberId: participant.memberId,
            shareValue: participant.shareValue,
            amountCents: participant.amountCents,
          }))
        )

        return expense
      },

      async delete(expenseId: number): Promise<void> {
        state.expenses = state.expenses.filter((expense) => expense.id !== expenseId)
        state.expenseParticipants = state.expenseParticipants.filter(
          (participant) => participant.expenseId !== expenseId
        )
        state.attachments = state.attachments.filter((a) => a.expenseId !== expenseId)
      },

      async memberHasExpenses(memberId: number): Promise<boolean> {
        if (state.expenses.some((e) => e.paidById === memberId)) return true
        return state.expenseParticipants.some((p) => p.memberId === memberId)
      },

      async getBalanceData(groupId: number): Promise<BalanceData> {
        return {
          members: state.members.filter((member) => member.groupId === groupId),
          expenses: state.expenses
            .filter((expense) => expense.groupId === groupId)
            .map((expense) => ({
              paidById: expense.paidById,
              totalAmount: expense.amount,
              participantShares: state.expenseParticipants
                .filter((participant) => participant.expenseId === expense.id)
                .map((participant) => ({
                  memberId: participant.memberId,
                  amountCents: participant.amountCents,
                })),
            })),
        }
      },
    },

    personal: {
      async create(input: CreatePersonalTransactionRecord): Promise<PersonalTransaction> {
        const tx: PersonalTransaction = {
          id: counters.personalTransactionId++,
          type: input.type,
          title: input.title,
          amount: input.amount,
          currency: input.currency,
          date: input.date.getTime(),
          category: input.category,
          note: input.note,
          accountLabel: input.accountLabel,
          createdAt: input.createdAt.getTime(),
        }
        state.personalTransactions.push(tx)
        return tx
      },

      async findById(id: number): Promise<PersonalTransaction | null> {
        return state.personalTransactions.find((tx) => tx.id === id) ?? null
      },

      async findAll(): Promise<PersonalTransaction[]> {
        return [...state.personalTransactions].sort(byNewestDate)
      },

      async update(id: number, input: UpdatePersonalTransactionRecord): Promise<PersonalTransaction> {
        const tx = state.personalTransactions.find((t) => t.id === id)!
        tx.type = input.type
        tx.title = input.title
        tx.amount = input.amount
        tx.currency = input.currency
        tx.date = input.date.getTime()
        tx.category = input.category
        tx.note = input.note
        tx.accountLabel = input.accountLabel
        return tx
      },

      async delete(id: number): Promise<void> {
        state.personalTransactions = state.personalTransactions.filter((tx) => tx.id !== id)
      },
    },

    attachments: {
      async create(input: CreateAttachmentRecord): Promise<Attachment> {
        const attachment: Attachment = {
          id: counters.attachmentId++,
          groupId: input.groupId,
          expenseId: input.expenseId,
          storageKey: input.storageKey,
          filename: input.filename,
          contentType: input.contentType,
          size: input.size,
          createdAt: input.createdAt.getTime(),
        }
        state.attachments.push(attachment)
        return attachment
      },

      async findById(id: number): Promise<Attachment | null> {
        return state.attachments.find((a) => a.id === id) ?? null
      },

      async findByExpense(expenseId: number): Promise<Attachment[]> {
        return state.attachments.filter((a) => a.expenseId === expenseId)
      },

      async findByGroup(groupId: number): Promise<Attachment[]> {
        return state.attachments.filter((a) => a.groupId === groupId)
      },

      async delete(id: number): Promise<void> {
        state.attachments = state.attachments.filter((a) => a.id !== id)
      },
    },

    settlements: {
      async recordPaid(input: RecordPaidSettlementInput): Promise<void> {
        state.settlements.push({
          id: counters.settlementId++,
          groupId: input.groupId,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: input.amount,
          isPaid: true,
          paidAt: input.paidAt.getTime(),
        })
      },

      async findPaidForGroup(groupId: number): Promise<Settlement[]> {
        return state.settlements.filter((s) => s.groupId === groupId && s.isPaid)
      },

      async undo(settlementId: number): Promise<void> {
        state.settlements = state.settlements.filter((s) => s.id !== settlementId)
      },
    },
  }

  return { repositories, state }
}
