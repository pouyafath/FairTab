import { z } from 'zod'

export const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(100),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
})

export const updateGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(100),
})

export const addMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
})

export const updateMemberSchema = addMemberSchema

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
