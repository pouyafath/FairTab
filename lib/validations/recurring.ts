import { z } from 'zod'

export const recurringRuleSchema = z.object({
  type: z.enum(['income', 'expense']),
  title: z.string().min(1, 'Title is required').max(200),
  amount: z.number().int().positive('Amount must be positive'), // cents
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
  category: z.string().nullish(),
  note: z.string().max(500).nullish(),
  accountLabel: z.string().max(100).nullish(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
  intervalCount: z.number().int().min(1).default(1),
  // epoch ms — used as nextRunDate on create. Bounded so a typo'd year cannot
  // queue decades of occurrences for materialization.
  startDate: z
    .number()
    .int()
    .min(Date.UTC(2000, 0, 1), 'Start date must be in 2000 or later')
    .max(Date.UTC(2100, 0, 1), 'Start date must be before 2100'),
})

export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>
