import { z } from 'zod'

const positiveInt = z.number().int().positive()
const nonZeroInt = z.number().int().refine((n) => n !== 0, 'must be non-zero')

export const issuePointsInput = z.object({
  customerId: z.string().uuid(),
  points: positiveInt.optional(),
  amountSpent: z.number().nonnegative().optional(),
  category: z.string().trim().max(60).optional(),
  reason: z.string().trim().max(300).optional(),
  sourceRef: z.string().trim().max(120).optional(),
  computeFromRules: z.boolean().optional(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
}).refine((v) => v.points !== undefined || v.computeFromRules === true, {
  message: 'either points or computeFromRules must be provided',
})
export type IssuePointsInput = z.infer<typeof issuePointsInput>

export const redeemPointsInput = z.object({
  customerId: z.string().uuid(),
  points: positiveInt,
  reason: z.string().trim().max(300).optional(),
  sourceRef: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type RedeemPointsInput = z.infer<typeof redeemPointsInput>

export const reversePointsInput = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type ReversePointsInput = z.infer<typeof reversePointsInput>

export const expirePointsInput = z.object({
  customerId: z.string().uuid(),
  points: positiveInt,
  reason: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type ExpirePointsInput = z.infer<typeof expirePointsInput>

export const adjustPointsInput = z.object({
  customerId: z.string().uuid(),
  points: nonZeroInt,
  reason: z.string().trim().min(1).max(300),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type AdjustPointsInput = z.infer<typeof adjustPointsInput>

export const createRewardInput = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  points_cost: positiveInt,
  stock: z.number().int().nonnegative().optional().nullable(),
  is_active: z.boolean().optional(),
  expires_at: z.string().datetime().optional().nullable(),
})
export type CreateRewardInput = z.infer<typeof createRewardInput>

export const redeemRewardInput = z.object({
  rewardId: z.string().uuid(),
  customerId: z.string().uuid(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type RedeemRewardInput = z.infer<typeof redeemRewardInput>

export const upsertRuleInput = z.object({
  key: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(200),
  kind: z.enum(['spend_earn', 'birthday_bonus', 'category_bonus', 'first_purchase_bonus', 'double_points_window']),
  config: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_to: z.string().datetime().nullable().optional(),
})
export type UpsertRuleInput = z.infer<typeof upsertRuleInput>
