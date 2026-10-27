import type {
  AppRepositories,
  BalanceData,
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
}

interface Counters {
  groupId: number
  memberId: number
  expenseId: number
  expenseParticipantId: number
  personalTransactionId: number
  settlementId: number
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
  }
}

function nextId<T extends { id: number }>(rows: T[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
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
    }
  }

  const repositories: AppRepositories = {
    groups: {
      async create(input: CreateGroupRecord): Promise<Group> {
        const group: Group = {
          id: counters.groupId++,
          name: input.name,
          token: input.token,
          isArchived: false,
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

      async findById(groupId: number): Promise<GroupWithMembers | null> {
        const group = state.groups.find((candidate) => candidate.id === groupId)
        if (!group) return null

        return {
          ...group,
          members: state.members.filter((member) => member.groupId === group.id),
        }
      },

      async findByMemberId(memberId: number): Promise<GroupWithMembers | null> {
        const member = state.members.find((candidate) => candidate.id === memberId)
        if (!member) return null

        const group = state.groups.find((candidate) => candidate.id === member.groupId)
        if (!group) return null

        return {
          ...group,
          members: state.members.filter((candidate) => candidate.groupId === group.id),
        }
      },

      async update(groupId: number, input: UpdateGroupRecord): Promise<Group> {
        const group = state.groups.find((g) => g.id === groupId)
        if (!group) throw new Error('Group not found')
        if (input.name !== undefined) {
          group.name = input.name
        }
        if (input.isArchived !== undefined) {
          group.isArchived = input.isArchived
        }
        return group
      },

      async delete(groupId: number): Promise<void> {
        const expenseIds = state.expenses.filter((e) => e.groupId === groupId).map((e) => e.id)
        state.expenseParticipants = state.expenseParticipants.filter(
          (p) => !expenseIds.includes(p.expenseId)
        )
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
        const member = state.members.find((m) => m.id === memberId)
        if (!member) throw new Error('Member not found')
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
        const expense = state.expenses.find((candidate) => candidate.id === expenseId)
        if (!expense) throw new Error('Expense not found')
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
        const tx = state.personalTransactions.find((t) => t.id === id)
        if (!tx) throw new Error('Transaction not found')
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

      async findById(settlementId: number): Promise<Settlement | null> {
        return state.settlements.find((settlement) => settlement.id === settlementId) ?? null
      },

      async findPaidForGroup(groupId: number): Promise<Settlement[]> {
        return state.settlements
          .filter((s) => s.groupId === groupId && s.isPaid)
          .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
      },

      async undo(settlementId: number): Promise<void> {
        state.settlements = state.settlements.filter((s) => s.id !== settlementId)
      },
    },

    backups: {
      async readSnapshot() {
        return {
          groups: [...state.groups].sort((a, b) => a.id - b.id),
          groupMembers: [...state.members].sort((a, b) => a.id - b.id),
          expenses: [...state.expenses].sort((a, b) => a.id - b.id),
          expenseParticipants: [...state.expenseParticipants].sort((a, b) => a.id - b.id),
          settlements: [...state.settlements].sort((a, b) => a.id - b.id),
          personalTransactions: [...state.personalTransactions].sort((a, b) => a.id - b.id),
        }
      },

      async restoreSnapshot(data, options) {
        if (options.replace) {
          state.groups = []
          state.members = []
          state.expenses = []
          state.expenseParticipants = []
          state.personalTransactions = []
          state.settlements = []
        }

        state.groups.push(...data.groups.map((group) => ({ ...group })))
        state.members.push(...data.groupMembers.map((member) => ({ ...member })))
        state.expenses.push(...data.expenses.map((expense) => ({ ...expense })))
        state.expenseParticipants.push(
          ...data.expenseParticipants.map((participant) => ({ ...participant }))
        )
        state.settlements.push(...data.settlements.map((settlement) => ({ ...settlement })))
        state.personalTransactions.push(
          ...data.personalTransactions.map((transaction) => ({ ...transaction }))
        )

        counters.groupId = nextId(state.groups)
        counters.memberId = nextId(state.members)
        counters.expenseId = nextId(state.expenses)
        counters.expenseParticipantId = nextId(state.expenseParticipants)
        counters.personalTransactionId = nextId(state.personalTransactions)
        counters.settlementId = nextId(state.settlements)
      },
    },
  }

  return { repositories, state }
}
