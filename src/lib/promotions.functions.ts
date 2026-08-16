import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { previewPromotionInput, type PreviewPromotionInput } from '@/domain/promotions/commands'
import type {
  Promotion, PromotionTarget, PromotionEligibility, Coupon, CouponCode,
} from '@/domain/promotions/schemas'

export const listPromotions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase
    const { data, error } = await sb.from('crm_promotions').select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Promotion[]
  })

export const getPromotion = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => {
    const d = raw as { id?: string }
    if (!d?.id) throw new Error('id required')
    return { id: d.id }
  })
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase
    const [{ data: p }, { data: targets }, { data: eligibility }, { data: redemptions }] = await Promise.all([
      sb.from('crm_promotions').select('*').eq('id', data.id).maybeSingle(),
      sb.from('crm_promotion_targets').select('*').eq('promotion_id', data.id),
      sb.from('crm_promotion_eligibility').select('*').eq('promotion_id', data.id),
      sb.from('crm_promotion_redemptions').select('id, customer_id, order_ref, discount_amount, redeemed_at')
        .eq('promotion_id', data.id).order('redeemed_at', { ascending: false }).limit(50),
    ])
    if (!p) throw new Error('Promotion not found')
    return {
      promotion: p as Promotion,
      targets: (targets ?? []) as PromotionTarget[],
      eligibility: (eligibility ?? []) as PromotionEligibility[],
      redemptions: (redemptions ?? []) as Array<{ id: string; customer_id: string | null; order_ref: string | null; discount_amount: number; redeemed_at: string }>,
    }
  })

export const listCoupons = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase
    const [{ data: coupons }, { data: codes }] = await Promise.all([
      sb.from('crm_coupons').select('*').order('created_at', { ascending: false }),
      sb.from('crm_coupon_codes').select('*'),
    ])
    return {
      coupons: (coupons ?? []) as Coupon[],
      codes: (codes ?? []) as CouponCode[],
    }
  })

export const previewPromotion = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): PreviewPromotionInput => previewPromotionInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { evaluatePromotions } = await import('./promotions/engine.server')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase
    let promoQuery = sb.from('crm_promotions').select('*').eq('status', 'active')
    if (data.promotion_id) promoQuery = promoQuery.eq('id', data.promotion_id)
    const { data: promos } = await promoQuery
    const ids = ((promos ?? []) as Array<{ id: string }>).map((r) => r.id)
    const [{ data: targets }, { data: eligibility }] = ids.length
      ? await Promise.all([
          sb.from('crm_promotion_targets').select('*').in('promotion_id', ids),
          sb.from('crm_promotion_eligibility').select('*').in('promotion_id', ids),
        ])
      : [{ data: [] }, { data: [] }]
    const bucketT = new Map<string, PromotionTarget[]>()
    for (const t of (targets ?? []) as PromotionTarget[]) {
      const arr = bucketT.get(t.promotion_id) ?? []; arr.push(t); bucketT.set(t.promotion_id, arr)
    }
    const bucketE = new Map<string, PromotionEligibility[]>()
    for (const e of (eligibility ?? []) as PromotionEligibility[]) {
      const arr = bucketE.get(e.promotion_id) ?? []; arr.push(e); bucketE.set(e.promotion_id, arr)
    }
    const pwm = ((promos ?? []) as Promotion[]).map((p) => ({
      promotion: p,
      targets: bucketT.get(p.id) ?? [],
      eligibility: bucketE.get(p.id) ?? [],
    }))

    let couponInfo: { code: string; valid: boolean; reason?: string; coupon?: Coupon } | null = null
    if (data.couponCode) {
      const { data: cc } = await sb.from('crm_coupon_codes').select('*, crm_coupons(*)')
        .eq('code', data.couponCode).maybeSingle()
      const coupon = cc?.crm_coupons as Coupon | undefined
      const now = new Date()
      if (!cc) couponInfo = { code: data.couponCode, valid: false, reason: 'not_found' }
      else if (!cc.is_active) couponInfo = { code: data.couponCode, valid: false, reason: 'inactive' }
      else if (cc.expires_at && new Date(cc.expires_at) < now) couponInfo = { code: data.couponCode, valid: false, reason: 'expired' }
      else if (cc.usage_limit != null && cc.usage_count >= cc.usage_limit) couponInfo = { code: data.couponCode, valid: false, reason: 'exhausted' }
      else if (coupon && coupon.status !== 'active') couponInfo = { code: data.couponCode, valid: false, reason: 'coupon_disabled' }
      else couponInfo = { code: data.couponCode, valid: true, coupon }
    }

    const evalResult = evaluatePromotions(pwm, {
      cart: data.cart, customerId: data.customerId, branchId: data.branchId,
      loyaltyTier: data.loyaltyTier, isFirstPurchase: data.isFirstPurchase,
    })
    return { ...evalResult, coupon: couponInfo }
  })
