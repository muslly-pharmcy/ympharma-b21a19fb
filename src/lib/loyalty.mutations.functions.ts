import { createServerFn } from '@tanstack/react-start'
import {
  issuePointsInput, redeemPointsInput, reversePointsInput, expirePointsInput,
  adjustPointsInput, createRewardInput, redeemRewardInput, upsertRuleInput,
  type IssuePointsInput, type RedeemPointsInput, type ReversePointsInput,
  type ExpirePointsInput, type AdjustPointsInput, type CreateRewardInput,
  type RedeemRewardInput, type UpsertRuleInput,
} from '@/domain/loyalty/commands'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'loyalty-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

// Ensures the customer has a loyalty account (creates it + seeds tiers on first use).
async function ensureAccount(orgId: string, customerId: string): Promise<{ accountId: string; created: boolean }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin as any
  const { data: existing } = await sb.from('crm_loyalty_accounts')
    .select('id').eq('organization_id', orgId).eq('customer_id', customerId).maybeSingle()
  if (existing?.id) return { accountId: existing.id as string, created: false }

  await (supabaseAdmin.rpc as unknown as RpcFn)('crm_loyalty_seed_tiers', { p_org: orgId })
  const { data: row, error } = await sb.from('crm_loyalty_accounts')
    .insert({ organization_id: orgId, customer_id: customerId })
    .select('id').single()
  if (error) throw new Error(error.message)
  return { accountId: row.id as string, created: true }
}

async function applyLedger(args: {
  accountId: string
  kind: 'earn' | 'redeem' | 'reverse' | 'expire' | 'adjust' | 'bonus'
  points: number
  reason?: string | null
  sourceRef?: string | null
  correlationId: string
  metadata?: Record<string, unknown>
  createdBy: string
}): Promise<{ transactionId: string; newBalance: number }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await (supabaseAdmin.rpc as unknown as RpcFn)('crm_loyalty_apply_txn', {
    p_account_id: args.accountId,
    p_kind: args.kind,
    p_points: args.points,
    p_reason: args.reason ?? null,
    p_source_ref: args.sourceRef ?? null,
    p_correlation_id: args.correlationId,
    p_metadata: (args.metadata ?? {}) as unknown as never,
    p_created_by: args.createdBy,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? (data[0] as { transaction_id: string; new_balance: number }) : (data as { transaction_id: string; new_balance: number })
  return { transactionId: row.transaction_id, newBalance: row.new_balance }
}

// ---------------- Issue / Bonus (positive delta) ----------------
export const issuePoints = createServerFn({ method: 'POST' })
  .validator((raw: unknown): IssuePointsInput => issuePointsInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.write')
    const correlation = data.correlationId ?? newCorrelationId('loyalty-issue')

    return withIdempotency(data.idempotencyKey, actor.userId, 'issuePoints', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabaseAdmin as any
      const { data: customer } = await sb.from('crm_customers')
        .select('id, organization_id').eq('id', data.customerId).maybeSingle()
      if (!customer || customer.organization_id !== actor.organizationId) throw new Error('Customer not found')

      const { accountId, created } = await ensureAccount(actor.organizationId, data.customerId)
      if (created) await emit('LoyaltyAccountCreated', { account_id: accountId, customer_id: data.customerId }, correlation)

      let awardedPoints = data.points ?? 0
      let ruleTrace: unknown = null
      if (data.computeFromRules) {
        const { evaluateRules } = await import('./loyalty/rule-engine.server')
        const { data: rules } = await sb.from('crm_loyalty_rules').select('*')
          .eq('organization_id', actor.organizationId).eq('is_active', true)
        const result = evaluateRules(rules ?? [], {
          customerId: data.customerId,
          amountSpent: data.amountSpent,
          category: data.category,
        })
        awardedPoints += result.total
        ruleTrace = result.awards
      }
      if (awardedPoints <= 0) throw new Error('No points to issue (check rules or provide points)')

      const kind = data.computeFromRules ? 'earn' : 'bonus'
      const applied = await applyLedger({
        accountId, kind, points: awardedPoints,
        reason: data.reason ?? (data.computeFromRules ? 'auto (rules)' : 'manual bonus'),
        sourceRef: data.sourceRef ?? null, correlationId: correlation,
        metadata: { rules: ruleTrace, amountSpent: data.amountSpent, category: data.category },
        createdBy: actor.userId,
      })

      await emit('PointsIssued', { account_id: accountId, customer_id: data.customerId, points: awardedPoints, kind, transaction_id: applied.transactionId, new_balance: applied.newBalance }, correlation)
      await audit(actor, { action: 'loyalty.issue', resourceType: 'loyalty_account', resourceId: accountId, payload: { points: awardedPoints, kind, transaction_id: applied.transactionId } })
      return { accountId, ...applied, awarded: awardedPoints, correlationId: correlation }
    })
  })

// ---------------- Redeem (negative delta) ----------------
export const redeemPoints = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RedeemPointsInput => redeemPointsInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.redeem')
    const correlation = data.correlationId ?? newCorrelationId('loyalty-redeem')

    return withIdempotency(data.idempotencyKey, actor.userId, 'redeemPoints', async () => {
      const { accountId } = await ensureAccount(actor.organizationId, data.customerId)
      const applied = await applyLedger({
        accountId, kind: 'redeem', points: -Math.abs(data.points),
        reason: data.reason ?? 'manual redeem', sourceRef: data.sourceRef ?? null,
        correlationId: correlation, createdBy: actor.userId,
      })
      await emit('PointsRedeemed', { account_id: accountId, customer_id: data.customerId, points: data.points, transaction_id: applied.transactionId, new_balance: applied.newBalance }, correlation)
      await audit(actor, { action: 'loyalty.redeem', resourceType: 'loyalty_account', resourceId: accountId, payload: { points: data.points, transaction_id: applied.transactionId } })
      return { accountId, ...applied, correlationId: correlation }
    })
  })

// ---------------- Reverse (undo a prior earn/bonus) ----------------
export const reversePoints = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ReversePointsInput => reversePointsInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.adjust')
    const correlation = data.correlationId ?? newCorrelationId('loyalty-reverse')

    return withIdempotency(data.idempotencyKey, actor.userId, 'reversePoints', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabaseAdmin as any
      const { data: orig } = await sb.from('crm_loyalty_transactions')
        .select('id, organization_id, account_id, points, kind').eq('id', data.transactionId).maybeSingle()
      if (!orig || orig.organization_id !== actor.organizationId) throw new Error('Transaction not found')
      if (orig.kind === 'reverse') throw new Error('Cannot reverse a reversal')

      const applied = await applyLedger({
        accountId: orig.account_id, kind: 'reverse', points: -orig.points,
        reason: data.reason ?? `reversal of ${orig.id}`, sourceRef: orig.id,
        correlationId: correlation, metadata: { original_transaction_id: orig.id }, createdBy: actor.userId,
      })
      await emit('PointsReversed', { account_id: orig.account_id, original_transaction_id: orig.id, transaction_id: applied.transactionId, new_balance: applied.newBalance }, correlation)
      await audit(actor, { action: 'loyalty.reverse', resourceType: 'loyalty_transaction', resourceId: orig.id, payload: { transaction_id: applied.transactionId } })
      return { ...applied, correlationId: correlation }
    })
  })

// ---------------- Expire (scheduled or manual) ----------------
export const expirePoints = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ExpirePointsInput => expirePointsInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.adjust')
    const correlation = data.correlationId ?? newCorrelationId('loyalty-expire')

    return withIdempotency(data.idempotencyKey, actor.userId, 'expirePoints', async () => {
      const { accountId } = await ensureAccount(actor.organizationId, data.customerId)
      const applied = await applyLedger({
        accountId, kind: 'expire', points: -Math.abs(data.points),
        reason: data.reason ?? 'policy expiry', correlationId: correlation, createdBy: actor.userId,
      })
      await emit('PointsExpired', { account_id: accountId, customer_id: data.customerId, points: data.points, transaction_id: applied.transactionId, new_balance: applied.newBalance }, correlation)
      await audit(actor, { action: 'loyalty.expire', resourceType: 'loyalty_account', resourceId: accountId, payload: { points: data.points, transaction_id: applied.transactionId } })
      return { accountId, ...applied, correlationId: correlation }
    })
  })

// ---------------- Manual adjust (signed) ----------------
export const adjustPoints = createServerFn({ method: 'POST' })
  .validator((raw: unknown): AdjustPointsInput => adjustPointsInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.adjust')
    const correlation = data.correlationId ?? newCorrelationId('loyalty-adjust')

    return withIdempotency(data.idempotencyKey, actor.userId, 'adjustPoints', async () => {
      const { accountId } = await ensureAccount(actor.organizationId, data.customerId)
      const applied = await applyLedger({
        accountId, kind: 'adjust', points: data.points, reason: data.reason,
        correlationId: correlation, createdBy: actor.userId,
      })
      await emit('PointsAdjusted', { account_id: accountId, customer_id: data.customerId, points: data.points, transaction_id: applied.transactionId, new_balance: applied.newBalance, reason: data.reason }, correlation)
      await audit(actor, { action: 'loyalty.adjust', resourceType: 'loyalty_account', resourceId: accountId, payload: { points: data.points, transaction_id: applied.transactionId, reason: data.reason } })
      return { accountId, ...applied, correlationId: correlation }
    })
  })

// ---------------- Reward catalog ----------------
export const createReward = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateRewardInput => createRewardInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.write')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin as any).from('crm_reward_catalog').insert({
      organization_id: actor.organizationId,
      code: data.code, name: data.name, description: data.description ?? null,
      points_cost: data.points_cost, stock: data.stock ?? null,
      is_active: data.is_active ?? true, expires_at: data.expires_at ?? null,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'reward.create', resourceType: 'reward', resourceId: row.id, payload: { code: data.code, points_cost: data.points_cost } })
    return { id: row.id as string }
  })

export const redeemReward = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RedeemRewardInput => redeemRewardInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.redeem')
    const correlation = data.correlationId ?? newCorrelationId('reward-redeem')

    return withIdempotency(data.idempotencyKey, actor.userId, 'redeemReward', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabaseAdmin as any
      const { data: reward } = await sb.from('crm_reward_catalog')
        .select('id, organization_id, points_cost, stock, is_active, expires_at')
        .eq('id', data.rewardId).maybeSingle()
      if (!reward || reward.organization_id !== actor.organizationId) throw new Error('Reward not found')
      if (!reward.is_active) throw new Error('Reward is inactive')
      if (reward.expires_at && new Date(reward.expires_at) < new Date()) throw new Error('Reward has expired')
      if (reward.stock !== null && reward.stock <= 0) throw new Error('Reward is out of stock')

      const { accountId } = await ensureAccount(actor.organizationId, data.customerId)
      const applied = await applyLedger({
        accountId, kind: 'redeem', points: -reward.points_cost,
        reason: `reward:${reward.id}`, sourceRef: reward.id,
        correlationId: correlation, metadata: { reward_id: reward.id }, createdBy: actor.userId,
      })
      const { data: red, error: redErr } = await sb.from('crm_reward_redemptions').insert({
        organization_id: actor.organizationId, reward_id: reward.id, account_id: accountId,
        customer_id: data.customerId, transaction_id: applied.transactionId,
        points_spent: reward.points_cost, status: 'issued', created_by: actor.userId,
      }).select('id').single()
      if (redErr) throw new Error(redErr.message)

      if (reward.stock !== null) {
        await sb.from('crm_reward_catalog').update({ stock: reward.stock - 1 }).eq('id', reward.id)
      }

      await emit('RewardRedeemed', { redemption_id: red.id, reward_id: reward.id, customer_id: data.customerId, points_spent: reward.points_cost, transaction_id: applied.transactionId }, correlation)
      await audit(actor, { action: 'reward.redeem', resourceType: 'reward_redemption', resourceId: red.id, payload: { reward_id: reward.id, points: reward.points_cost } })
      return { redemptionId: red.id as string, ...applied, correlationId: correlation }
    })
  })

// ---------------- Rule authoring ----------------
export const upsertLoyaltyRule = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpsertRuleInput => upsertRuleInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.write')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin as any).from('crm_loyalty_rules').upsert({
      organization_id: actor.organizationId,
      key: data.key, name: data.name, kind: data.kind,
      config: data.config as unknown as never,
      priority: data.priority ?? 100, is_active: data.is_active ?? true,
      valid_from: data.valid_from ?? null, valid_to: data.valid_to ?? null,
    }, { onConflict: 'organization_id,key' }).select('id').single()
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'loyalty.rule.upsert', resourceType: 'loyalty_rule', resourceId: row.id, payload: { key: data.key, kind: data.kind } })
    return { id: row.id as string }
  })
