import { z } from 'zod'

const participantInputSchema = z.object({
  memberId: z.number().int().positive(),
  shareValue: z.number().int().min(0),
})

export const addExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  amount: z.number().int().positive('Amount must be positive'), // cents
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
  paidById: z.number().int().positive('Please select who paid'),
  date: z.number().int(),
  category: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares']),
  participants: z.array(participantInputSchema).min(1, 'At least one participant required'),
})

export type AddExpenseInput = z.infer<typeof addExpenseSchema>
