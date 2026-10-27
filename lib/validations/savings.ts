import { z } from 'zod'

export const savingsGoalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  targetAmount: z.number().int().positive('Target must be positive'), // cents
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
  targetDate: z.number().int().nullable().optional(),
})

export const contributeSchema = z.object({
  amount: z.number().int().refine((v) => v !== 0, 'Amount cannot be zero'),
})

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>
