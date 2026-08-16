import { createServerFn } from '@tanstack/react-start'
import {
  createPromotionInput, updatePromotionInput, transitionPromotionInput,
  createCouponInput, archiveCouponInput, redeemCouponInput,
  type CreatePromotionInput, type UpdatePromotionInput, type TransitionPromotionInput,
  type CreateCouponInput, type ArchiveCouponInput, type RedeemCouponInput,
} from '@/domain/promotions/commands'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event, p_source: 'promotions-mutations',
    p_payload: payload as unknown as never, p_priority: 'normal', p_correlation_id: correlation,
  })
}

export const createPromotion = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreatePromotionInput => createPromotionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = newCorrelationId('promo-create')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createPromotion', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabaseAdmin as any
      const { data: row, error } = await sb.from('crm_promotions').insert({
        organization_id: actor.organizationId,
        code: data.code, name: data.name, description: data.description ?? null,
        kind: data.kind, config: data.config as unknown as never,
        priority: data.priority, stackable: data.stackable,
        min_spend: data.min_spend ?? null, max_discount: data.max_discount ?? null,
        starts_at: data.starts_at ?? null, expires_at: data.expires_at ?? null,
        usage_limit: data.usage_limit ?? null, per_customer_limit: data.per_customer_limit ?? null,
        created_by: actor.userId, status: 'draft',
      }).select('id, code').single()
      if (error) throw new Error(error.message)

      if (data.targets.length) {
        await sb.from('crm_promotion_targets').insert(
          data.targets.map((t) => ({ organization_id: actor.organizationId, promotion_id: row.id, ...t })),
        )
      }
      if (data.eligibility.length) {
        await sb.from('crm_promotion_eligibility').insert(
          data.eligibility.map((e) => ({
            organization_id: actor.organizationId, promotion_id: row.id,
            kind: e.kind, value: e.value ?? null,
          })),
        )
      }
      await emit('PromotionCreated', { promotion_id: row.id, code: row.code, kind: data.kind }, correlation)
      await audit(actor, { action: 'promotion.create', resourceType: 'promotion', resourceId: row.id, payload: { code: row.code, kind: data.kind } })
      return { id: row.id as string, code: row.code as string, correlationId: correlation }
    })
  })

export const updatePromotion = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdatePromotionInput => updatePromotionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: existing } = await sb.from('crm_promotions').select('id, organization_id, status').eq('id', data.id).maybeSingle()
    if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Promotion not found')
    if (existing.status === 'archived') throw new Error('Cannot edit an archived promotion')

    const patch: Record<string, unknown> = {}
    for (const k of ['name','description','config','priority','stackable','min_spend','max_discount','starts_at','expires_at','usage_limit','per_customer_limit'] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    if (Object.keys(patch).length) {
      const { error } = await sb.from('crm_promotions').update(patch).eq('id', data.id)
      if (error) throw new Error(error.message)
    }
    if (data.targets) {
      await sb.from('crm_promotion_targets').delete().eq('promotion_id', data.id)
      if (data.targets.length) {
        await sb.from('crm_promotion_targets').insert(
          data.targets.map((t) => ({ organization_id: actor.organizationId, promotion_id: data.id, ...t })),
        )
      }
    }
    if (data.eligibility) {
      await sb.from('crm_promotion_eligibility').delete().eq('promotion_id', data.id)
      if (data.eligibility.length) {
        await sb.from('crm_promotion_eligibility').insert(
          data.eligibility.map((e) => ({
            organization_id: actor.organizationId, promotion_id: data.id,
            kind: e.kind, value: e.value ?? null,
          })),
        )
      }
    }
    await audit(actor, { action: 'promotion.update', resourceType: 'promotion', resourceId: data.id, payload: { patch } })
    return { id: data.id }
  })

const LEGAL_PROMO: Record<string, string[]> = {
  draft: ['active','archived'],
  active: ['paused','archived','expired'],
  paused: ['active','archived','expired'],
  expired: ['archived'],
  archived: [],
}
export const transitionPromotion = createServerFn({ method: 'POST' })
  .validator((raw: unknown): TransitionPromotionInput => transitionPromotionInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = newCorrelationId('promo-transition')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: existing } = await sb.from('crm_promotions').select('id, organization_id, status').eq('id', data.id).maybeSingle()
    if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Promotion not found')
    const allowed = LEGAL_PROMO[existing.status] ?? []
    if (!allowed.includes(data.next)) throw new Error(`Illegal transition ${existing.status} -> ${data.next}`)
    const { error } = await sb.from('crm_promotions').update({ status: data.next }).eq('id', data.id)
    if (error) throw new Error(error.message)
    const evName =
      data.next === 'active' ? 'PromotionActivated' :
      data.next === 'paused' ? 'PromotionDeactivated' :
      data.next === 'archived' ? 'PromotionArchived' :
      data.next === 'expired' ? 'PromotionExpired' :
      'PromotionTransitioned'
    await emit(evName, { promotion_id: data.id, from: existing.status, to: data.next }, correlation)
    await audit(actor, { action: `promotion.${data.next}`, resourceType: 'promotion', resourceId: data.id, payload: { from: existing.status, to: data.next } })
    return { id: data.id, status: data.next }
  })

// ================ Coupons ================
export const createCoupon = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateCouponInput => createCouponInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = newCorrelationId('coupon-create')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createCoupon', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabaseAdmin as any
      const { data: coup, error } = await sb.from('crm_coupons').insert({
        organization_id: actor.organizationId,
        promotion_id: data.promotion_id ?? null, name: data.name,
        description: data.description ?? null, mode: data.mode,
        global_limit: data.global_limit ?? null,
        per_customer_limit: data.per_customer_limit ?? (data.mode === 'one_per_customer' ? 1 : null),
        min_spend: data.min_spend ?? null, max_discount: data.max_discount ?? null,
        stackable: data.stackable, starts_at: data.starts_at ?? null,
        expires_at: data.expires_at ?? null, created_by: actor.userId, status: 'active',
      }).select('id').single()
      if (error) throw new Error(error.message)

      const { error: codesErr } = await sb.from('crm_coupon_codes').insert(
        data.codes.map((c) => ({
          organization_id: actor.organizationId, coupon_id: coup.id,
          code: c.code.toUpperCase(),
          usage_limit: c.usage_limit ?? (data.mode === 'single' ? 1 : null),
          expires_at: c.expires_at ?? data.expires_at ?? null,
        })),
      )
      if (codesErr) throw new Error(codesErr.message)

      await emit('CouponCreated', { coupon_id: coup.id, code_count: data.codes.length }, correlation)
      await audit(actor, { action: 'coupon.create', resourceType: 'coupon', resourceId: coup.id, payload: { code_count: data.codes.length } })
      return { id: coup.id as string, correlationId: correlation }
    })
  })

export const archiveCoupon = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ArchiveCouponInput => archiveCouponInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: existing } = await sb.from('crm_coupons').select('id, organization_id').eq('id', data.id).maybeSingle()
    if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Coupon not found')
    await sb.from('crm_coupons').update({ status: 'archived' }).eq('id', data.id)
    await sb.from('crm_coupon_codes').update({ is_active: false }).eq('coupon_id', data.id)
    await audit(actor, { action: 'coupon.archive', resourceType: 'coupon', resourceId: data.id })
    return { id: data.id }
  })

export const redeemCoupon = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RedeemCouponInput => redeemCouponInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = data.correlationId ?? newCorrelationId('coupon-redeem')

    return withIdempotency(data.idempotencyKey, actor.userId, 'redeemCoupon', async () => {
      const { data: row, error } = await (supabaseAdmin.rpc as unknown as RpcFn)('crm_coupon_redeem', {
        p_org: actor.organizationId,
        p_code: data.code.toUpperCase(),
        p_customer: data.customerId ?? null,
        p_order_ref: data.orderRef ?? null,
        p_discount: data.discountAmount,
        p_created_by: actor.userId,
      })
      if (error) throw new Error(error.message)
      const rec = Array.isArray(row) ? (row[0] as { redemption_id: string; coupon_id: string; promotion_id: string | null }) : (row as { redemption_id: string; coupon_id: string; promotion_id: string | null })
      await emit('CouponRedeemed', {
        redemption_id: rec.redemption_id, coupon_id: rec.coupon_id,
        promotion_id: rec.promotion_id, customer_id: data.customerId ?? null,
        discount: data.discountAmount,
      }, correlation)
      if (rec.promotion_id) {
        await emit('PromotionApplied', {
          promotion_id: rec.promotion_id, customer_id: data.customerId ?? null,
          discount: data.discountAmount, source: 'coupon',
        }, correlation)
      }
      await audit(actor, { action: 'coupon.redeem', resourceType: 'coupon', resourceId: rec.coupon_id, payload: { code: data.code, discount: data.discountAmount } })
      return { ...rec, correlationId: correlation }
    })
  })
