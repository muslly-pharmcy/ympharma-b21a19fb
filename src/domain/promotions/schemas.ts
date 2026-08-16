export type PromotionKind =
  | 'percentage' | 'fixed' | 'bogo' | 'free_shipping'
  | 'free_gift' | 'category_discount' | 'tier_discount'

export type PromotionStatus = 'draft'|'active'|'paused'|'archived'|'expired'
export type CouponMode = 'single'|'multi'|'one_per_customer'
export type CouponStatus = 'active'|'paused'|'archived'
export type PromoTargetKind = 'include'|'exclude'
export type PromoEntityKind = 'product'|'category'|'manufacturer'|'branch'|'loyalty_tier'
export type EligibilityKind = 'first_purchase'|'customer'|'segment'|'loyalty_tier'|'all'

// JSON-safe config bag. Keys interpreted by kind:
// percentage: { percent }; fixed: { amount }; bogo: { buy, get, discount_percent };
// category_discount: { category, percent }; tier_discount: { tier, percent };
// free_shipping: { shipping_cost }; free_gift: { gift_product, qty }.
export type PromotionConfig = Record<string, string | number | boolean | null>

export interface Promotion {
  id: string
  organization_id: string
  code: string
  name: string
  description: string | null
  kind: PromotionKind
  config: PromotionConfig
  status: PromotionStatus
  priority: number
  stackable: boolean
  min_spend: number | null
  max_discount: number | null
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  usage_count: number
  per_customer_limit: number | null
  created_at: string
  updated_at: string
}

export interface PromotionTarget {
  id: string
  promotion_id: string
  target_kind: PromoTargetKind
  entity_kind: PromoEntityKind
  entity_ref: string
}

export interface PromotionEligibility {
  id: string
  promotion_id: string
  kind: EligibilityKind
  value: string | null
}

export interface Coupon {
  id: string
  organization_id: string
  promotion_id: string | null
  name: string
  description: string | null
  mode: CouponMode
  status: CouponStatus
  global_limit: number | null
  per_customer_limit: number | null
  min_spend: number | null
  max_discount: number | null
  stackable: boolean
  starts_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface CouponCode {
  id: string
  organization_id: string
  coupon_id: string
  code: string
  usage_limit: number | null
  usage_count: number
  branch_scope: string[]
  is_active: boolean
  expires_at: string | null
  created_at: string
}

// ----- Runtime evaluation types (pure engine) -----
export interface CartLine {
  productId: string
  category?: string | null
  manufacturer?: string | null
  qty: number
  unitPrice: number
}
export interface PromoEvalContext {
  cart: CartLine[]
  customerId?: string | null
  branchId?: string | null
  loyaltyTier?: string | null
  isFirstPurchase?: boolean
  now?: Date
}
export interface PromoWithMeta {
  promotion: Promotion
  targets: PromotionTarget[]
  eligibility: PromotionEligibility[]
}
export interface AppliedDiscount {
  promotionId: string
  code: string
  kind: PromotionKind
  amount: number
  detail: string
}
export interface EvalResult {
  subtotal: number
  discountTotal: number
  finalTotal: number
  applied: AppliedDiscount[]
  skipped: Array<{ promotionId: string; code: string; reason: string }>
}
