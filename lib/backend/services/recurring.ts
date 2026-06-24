import { recurringRuleSchema } from '@/lib/validations/recurring'
import { nextDate } from '@/lib/calculations/recurring'
import { validationError } from './result'
import type { ActionResult, RecurringRule } from '@/types'
import type { BackendServiceDeps } from './types'

export function createRecurringService({ repositories, now }: BackendServiceDeps) {
  return {
    async addRecurringRule(formData: unknown): Promise<ActionResult<RecurringRule>> {
      const parsed = recurringRuleSchema.safeParse(formData)
      if (!parsed.success) return validationError<RecurringRule>(parsed.error)

      const data = parsed.data
      const rule = await repositories.recurring.create({
        type: data.type,
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        category: data.category ?? null,
        note: data.note ?? null,
        accountLabel: data.accountLabel ?? null,
        frequency: data.frequency,
        intervalCount: data.intervalCount,
        nextRunDate: new Date(data.startDate),
        createdAt: now(),
      })

      return { success: true, data: rule }
    },

    async getRecurringRules(): Promise<RecurringRule[]> {
      return repositories.recurring.findAll()
    },

    async updateRecurringRule(
      id: number,
      formData: unknown
    ): Promise<ActionResult<RecurringRule>> {
      const parsed = recurringRuleSchema.safeParse(formData)
      if (!parsed.success) return validationError<RecurringRule>(parsed.error)

      const existing = await repositories.recurring.findAll().then((rules) =>
        rules.find((r) => r.id === id)
      )
      if (!existing) return { success: false, error: 'Rule not found' }

      const data = parsed.data
      const rule = await repositories.recurring.update(id, {
        type: data.type,
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        category: data.category ?? null,
        note: data.note ?? null,
        accountLabel: data.accountLabel ?? null,
        frequency: data.frequency,
        intervalCount: data.intervalCount,
        nextRunDate: new Date(data.startDate),
      })

      return { success: true, data: rule }
    },

    async toggleRecurringRule(
      id: number,
      active: boolean
    ): Promise<ActionResult<RecurringRule>> {
      const rule = await repositories.recurring.toggle(id, active)
      return { success: true, data: rule }
    },

    async deleteRecurringRule(id: number): Promise<ActionResult<void>> {
      await repositories.recurring.delete(id)
      return { success: true, data: undefined }
    },

    async materializeDueRecurring(asOf: Date): Promise<number> {
      const dueRules = await repositories.recurring.findDue(asOf)
      let count = 0

      for (const rule of dueRules) {
        let runDate = new Date(rule.nextRunDate)
        let lastRun: Date | null = null

        while (runDate <= asOf) {
          const created = await repositories.personal.createIfAbsent({
            type: rule.type,
            title: rule.title,
            amount: rule.amount,
            currency: rule.currency,
            date: runDate,
            category: rule.category,
            note: rule.note,
            accountLabel: rule.accountLabel,
            sourceRuleId: rule.id,
            createdAt: now(),
          })
          if (created) count++
          lastRun = runDate
          runDate = nextDate(runDate, rule.frequency, rule.intervalCount)
        }

        if (lastRun) {
          await repositories.recurring.advance(rule.id, runDate, lastRun)
        }
      }

      return count
    },
  }
}
