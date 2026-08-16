import { z } from 'zod'

export const promotionKind = z.enum([
  'percentage','fixed','bogo','free_shipping','free_gift','category_discount','tier_discount',
])
export const promotionStatus = z.enum(['draft','active','paused','archived','expired'])

const targetInput = z.object({
  target_kind: z.enum(['include','exclude']),
  entity_kind: z.enum(['product','category','manufacturer','branch','loyalty_tier']),
  entity_ref: z.string().min(1).max(200),
})
const eligibilityInput = z.object({
  kind: z.enum(['first_purchase','customer','segment','loyalty_tier','all']),
  value: z.string().max(200).nullable().optional(),
})

export const createPromotionInput = z.object({
  code: z.string().trim().min(2).max(60).regex(/^[A-Z0-9_-]+$/i, 'code must be alphanumeric'),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  kind: promotionKind,
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  priority: z.number().int().min(0).max(10_000).default(100),
  stackable: z.boolean().default(false),
  min_spend: z.number().nonnegative().nullable().optional(),
  max_discount: z.number().nonnegative().nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_customer_limit: z.number().int().positive().nullable().optional(),
  targets: z.array(targetInput).default([]),
  eligibility: z.array(eligibilityInput).default([]),
  idempotencyKey: z.string().min(6).max(120),
})
export type CreatePromotionInput = z.infer<typeof createPromotionInput>

export const updatePromotionInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  stackable: z.boolean().optional(),
  min_spend: z.number().nonnegative().nullable().optional(),
  max_discount: z.number().nonnegative().nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_customer_limit: z.number().int().positive().nullable().optional(),
  targets: z.array(targetInput).optional(),
  eligibility: z.array(eligibilityInput).optional(),
})
export type UpdatePromotionInput = z.infer<typeof updatePromotionInput>

export const transitionPromotionInput = z.object({
  id: z.string().uuid(),
  next: promotionStatus,
})
export type TransitionPromotionInput = z.infer<typeof transitionPromotionInput>

export const previewPromotionInput = z.object({
  promotion_id: z.string().uuid().optional(),
  cart: z.array(z.object({
    productId: z.string().min(1),
    category: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    qty: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  customerId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  loyaltyTier: z.string().nullable().optional(),
  isFirstPurchase: z.boolean().optional(),
  couponCode: z.string().trim().max(60).optional(),
})
export type PreviewPromotionInput = z.infer<typeof previewPromotionInput>

// ----- Coupons -----
export const createCouponInput = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  promotion_id: z.string().uuid().nullable().optional(),
  mode: z.enum(['single','multi','one_per_customer']).default('multi'),
  global_limit: z.number().int().positive().nullable().optional(),
  per_customer_limit: z.number().int().positive().nullable().optional(),
  min_spend: z.number().nonnegative().nullable().optional(),
  max_discount: z.number().nonnegative().nullable().optional(),
  stackable: z.boolean().default(false),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  codes: z.array(z.object({
    code: z.string().trim().min(3).max(60).regex(/^[A-Z0-9_-]+$/i),
    usage_limit: z.number().int().positive().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
  })).min(1),
  idempotencyKey: z.string().min(6).max(120),
})
export type CreateCouponInput = z.infer<typeof createCouponInput>

export const archiveCouponInput = z.object({ id: z.string().uuid() })
export type ArchiveCouponInput = z.infer<typeof archiveCouponInput>

export const redeemCouponInput = z.object({
  code: z.string().trim().min(3).max(60),
  customerId: z.string().uuid().nullable().optional(),
  orderRef: z.string().max(120).nullable().optional(),
  discountAmount: z.number().nonnegative(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type RedeemCouponInput = z.infer<typeof redeemCouponInput>
