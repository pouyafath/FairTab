import type {
  AppRepositories,
  BalanceData,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  ExpenseParticipantRecord,
  RecordPaidSettlementInput,
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
          .map((expense) => ({
            ...expense,
            paidBy: state.members.find((member) => member.id === expense.paidById)!,
            participants: state.expenseParticipants
              .filter((participant) => participant.expenseId === expense.id)
              .map((participant) => ({
                ...participant,
                member: state.members.find((member) => member.id === participant.memberId)!,
              })),
          }))
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

      async findAll(): Promise<PersonalTransaction[]> {
        return [...state.personalTransactions].sort(byNewestDate)
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
    },
  }

  return { repositories, state }
}
