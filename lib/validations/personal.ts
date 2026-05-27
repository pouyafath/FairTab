import { z } from 'zod'

export const addTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  title: z.string().min(1, 'Title is required').max(200),
  amount: z.number().int().positive('Amount must be positive'), // cents
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
  date: z.number().int(),
  category: z.string().optional(),
  note: z.string().max(500).optional(),
  accountLabel: z.string().max(100).optional(),
})

export type AddTransactionInput = z.infer<typeof addTransactionSchema>
