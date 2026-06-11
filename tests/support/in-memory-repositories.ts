import type {
  AppRepositories,
  BalanceData,
  CreateAttachmentRecord,
  CreateExpenseRecord,
  CreateGroupRecord,
  CreatePersonalTransactionRecord,
  CreateRecurringRuleRecord,
  CreateSavingsGoalRecord,
  ExpenseParticipantRecord,
  RecordPaidSettlementInput,
  UpdateExpenseRecord,
  UpdateGroupRecord,
  UpdateMemberRecord,
  UpdatePersonalTransactionRecord,
  UpdateRecurringRuleRecord,
  UpdateSavingsGoalRecord,
} from '@/lib/backend/ports'
import type {
  Attachment,
  BackupData,
  Expense,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupMember,
  GroupWithMembers,
  PersonalTransaction,
  RecurringRule,
  SavingsGoal,
  Settlement,
} from '@/types'

export interface InMemoryRepositoryState {
  groups: Group[]
  members: GroupMember[]
  expenses: Expense[]
  expenseParticipants: ExpenseParticipant[]
  personalTransactions: PersonalTransaction[]
  settlements: Settlement[]
  recurringRules: RecurringRule[]
  savingsGoals: SavingsGoal[]
  attachments: Attachment[]
}

interface Counters {
  groupId: number
  memberId: number
  expenseId: number
  expenseParticipantId: number
  personalTransactionId: number
  settlementId: number
  recurringRuleId: number
  savingsGoalId: number
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
    recurringRuleId: 1,
    savingsGoalId: 1,
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
    recurringRules: initialState?.recurringRules ?? [],
    savingsGoals: initialState?.savingsGoals ?? [],
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
          sourceRuleId: input.sourceRuleId,
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
        return state.settlements
          .filter((s) => s.groupId === groupId && s.isPaid)
          .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
      },

      async undo(settlementId: number): Promise<void> {
        state.settlements = state.settlements.filter((s) => s.id !== settlementId)
      },
    },

    recurring: {
      async create(input: CreateRecurringRuleRecord): Promise<RecurringRule> {
        const rule: RecurringRule = {
          id: counters.recurringRuleId++,
          type: input.type,
          title: input.title,
          amount: input.amount,
          currency: input.currency,
          category: input.category,
          note: input.note,
          accountLabel: input.accountLabel,
          frequency: input.frequency,
          intervalCount: input.intervalCount,
          nextRunDate: input.nextRunDate.getTime(),
          lastRunDate: null,
          active: true,
          createdAt: input.createdAt.getTime(),
        }
        state.recurringRules.push(rule)
        return rule
      },

      async findAll(): Promise<RecurringRule[]> {
        return [...state.recurringRules].sort((a, b) => b.createdAt - a.createdAt)
      },

      async findDue(asOf: Date): Promise<RecurringRule[]> {
        const asOfMs = asOf.getTime()
        return state.recurringRules.filter((r) => r.active && r.nextRunDate <= asOfMs)
      },

      async update(id: number, input: UpdateRecurringRuleRecord): Promise<RecurringRule> {
        const rule = state.recurringRules.find((r) => r.id === id)
        if (!rule) throw new Error('Recurring rule not found')
        rule.type = input.type
        rule.title = input.title
        rule.amount = input.amount
        rule.currency = input.currency
        rule.category = input.category
        rule.note = input.note
        rule.accountLabel = input.accountLabel
        rule.frequency = input.frequency
        rule.intervalCount = input.intervalCount
        rule.nextRunDate = input.nextRunDate.getTime()
        return rule
      },

      async toggle(id: number, active: boolean): Promise<RecurringRule> {
        const rule = state.recurringRules.find((r) => r.id === id)
        if (!rule) throw new Error('Recurring rule not found')
        rule.active = active
        return rule
      },

      async advance(id: number, nextRunDate: Date, lastRunDate: Date): Promise<void> {
        const rule = state.recurringRules.find((r) => r.id === id)
        if (!rule) throw new Error('Recurring rule not found')
        rule.nextRunDate = nextRunDate.getTime()
        rule.lastRunDate = lastRunDate.getTime()
      },

      async delete(id: number): Promise<void> {
        state.recurringRules = state.recurringRules.filter((r) => r.id !== id)
      },
    },

    savings: {
      async create(input: CreateSavingsGoalRecord): Promise<SavingsGoal> {
        const goal: SavingsGoal = {
          id: counters.savingsGoalId++,
          name: input.name,
          targetAmount: input.targetAmount,
          currentAmount: input.currentAmount,
          currency: input.currency,
          targetDate: input.targetDate ? input.targetDate.getTime() : null,
          createdAt: input.createdAt.getTime(),
        }
        state.savingsGoals.push(goal)
        return goal
      },

      async findAll(): Promise<SavingsGoal[]> {
        return [...state.savingsGoals].sort((a, b) => b.createdAt - a.createdAt)
      },

      async update(id: number, input: UpdateSavingsGoalRecord): Promise<SavingsGoal> {
        const goal = state.savingsGoals.find((g) => g.id === id)
        if (!goal) throw new Error('Savings goal not found')
        goal.name = input.name
        goal.targetAmount = input.targetAmount
        goal.currency = input.currency
        goal.targetDate = input.targetDate ? input.targetDate.getTime() : null
        return goal
      },

      async contribute(id: number, amount: number): Promise<SavingsGoal> {
        const goal = state.savingsGoals.find((g) => g.id === id)
        if (!goal) throw new Error('Savings goal not found')
        goal.currentAmount = Math.max(0, goal.currentAmount + amount)
        return goal
      },

      async delete(id: number): Promise<void> {
        state.savingsGoals = state.savingsGoals.filter((g) => g.id !== id)
      },
    },

    backup: {
      async exportAll(): Promise<BackupData> {
        return structuredClone({
          groups: state.groups,
          members: state.members,
          expenses: state.expenses,
          expenseParticipants: state.expenseParticipants,
          settlements: state.settlements,
          personalTransactions: state.personalTransactions,
          recurringRules: state.recurringRules,
          savingsGoals: state.savingsGoals,
          attachments: state.attachments,
        })
      },

      async importAll(data: BackupData): Promise<void> {
        const mapId = (map: Map<number, number>, oldId: number, entity: string): number => {
          const newId = map.get(oldId)
          if (newId === undefined) {
            throw new Error(`Backup references a missing ${entity} (id ${oldId})`)
          }
          return newId
        }

        state.groups = []
        state.members = []
        state.expenses = []
        state.expenseParticipants = []
        state.settlements = []
        state.personalTransactions = []
        state.recurringRules = []
        state.savingsGoals = []
        state.attachments = []

        const groupIds = new Map<number, number>()
        for (const row of data.groups) {
          const id = counters.groupId++
          groupIds.set(row.id, id)
          state.groups.push({ ...row, id })
        }

        const memberIds = new Map<number, number>()
        for (const row of data.members) {
          const id = counters.memberId++
          memberIds.set(row.id, id)
          state.members.push({ ...row, id, groupId: mapId(groupIds, row.groupId, 'group') })
        }

        const expenseIds = new Map<number, number>()
        for (const row of data.expenses) {
          const id = counters.expenseId++
          expenseIds.set(row.id, id)
          state.expenses.push({
            ...row,
            id,
            groupId: mapId(groupIds, row.groupId, 'group'),
            paidById: mapId(memberIds, row.paidById, 'member'),
          })
        }

        for (const row of data.expenseParticipants) {
          state.expenseParticipants.push({
            ...row,
            id: counters.expenseParticipantId++,
            expenseId: mapId(expenseIds, row.expenseId, 'expense'),
            memberId: mapId(memberIds, row.memberId, 'member'),
          })
        }

        for (const row of data.settlements) {
          state.settlements.push({
            ...row,
            id: counters.settlementId++,
            groupId: mapId(groupIds, row.groupId, 'group'),
            fromMemberId: mapId(memberIds, row.fromMemberId, 'member'),
            toMemberId: mapId(memberIds, row.toMemberId, 'member'),
          })
        }

        const ruleIds = new Map<number, number>()
        for (const row of data.recurringRules) {
          const id = counters.recurringRuleId++
          ruleIds.set(row.id, id)
          state.recurringRules.push({ ...row, id })
        }

        for (const row of data.personalTransactions) {
          state.personalTransactions.push({
            ...row,
            id: counters.personalTransactionId++,
            sourceRuleId:
              row.sourceRuleId === null ? null : (ruleIds.get(row.sourceRuleId) ?? null),
          })
        }

        for (const row of data.savingsGoals) {
          state.savingsGoals.push({ ...row, id: counters.savingsGoalId++ })
        }

        for (const row of data.attachments) {
          state.attachments.push({
            ...row,
            id: counters.attachmentId++,
            groupId: mapId(groupIds, row.groupId, 'group'),
            expenseId:
              row.expenseId === null ? null : mapId(expenseIds, row.expenseId, 'expense'),
          })
        }
      },
    },
  }

  return { repositories, state }
}
