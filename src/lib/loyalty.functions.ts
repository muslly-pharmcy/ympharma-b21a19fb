import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  LoyaltyAccount, LoyaltyTier, LoyaltyTransaction, LoyaltyRule, Reward, RewardRedemption,
} from '@/domain/loyalty/schemas'

const sel = (s: string): string => s

export const listLoyaltyAccounts = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ search: z.string().optional(), status: z.enum(['active', 'frozen', 'closed', 'all']).optional() })
      .parse(raw ?? {}))
  .handler(async ({ data }): Promise<Array<LoyaltyAccount & { customer_name: string; customer_code: string }>> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.read')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabaseAdmin as any)
      .from('crm_loyalty_accounts')
      .select(sel('*, customer:crm_customers!inner(full_name, code)'))
      .eq('organization_id', actor.organizationId)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (data.status && data.status !== 'all') q = q.eq('status', data.status)
    if (data.search) {
      const like = `%${data.search}%`
      q = q.or(`full_name.ilike.${like},code.ilike.${like}`, { referencedTable: 'crm_customers' })
    }

    const { data: rows, error } = await q
    if (error) {
      console.error('[listLoyaltyAccounts]', error)
      return []
    }
    return ((rows ?? []) as Array<LoyaltyAccount & { customer: { full_name: string; code: string } }>)
      .map((r) => ({ ...r, customer_name: r.customer?.full_name ?? '', customer_code: r.customer?.code ?? '' }))
  })

export const getLoyaltyAccount = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }): Promise<{
    account: LoyaltyAccount
    tier: LoyaltyTier | null
    customer: { id: string; code: string; full_name: string }
    transactions: LoyaltyTransaction[]
    redemptions: RewardRedemption[]
  } | null> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.read')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: acc } = await sb.from('crm_loyalty_accounts')
      .select(sel('*, customer:crm_customers!inner(id, code, full_name), tier:crm_loyalty_tiers(*)'))
      .eq('id', data.id).eq('organization_id', actor.organizationId).maybeSingle()
    if (!acc) return null

    const [{ data: txns }, { data: reds }] = await Promise.all([
      sb.from('crm_loyalty_transactions').select(sel('*')).eq('account_id', data.id).order('created_at', { ascending: false }).limit(100),
      sb.from('crm_reward_redemptions').select(sel('*')).eq('account_id', data.id).order('created_at', { ascending: false }).limit(50),
    ])

    return {
      account: acc as LoyaltyAccount,
      tier: (acc.tier ?? null) as LoyaltyTier | null,
      customer: acc.customer as { id: string; code: string; full_name: string },
      transactions: (txns ?? []) as LoyaltyTransaction[],
      redemptions: (reds ?? []) as RewardRedemption[],
    }
  })

export const listLoyaltyTransactions = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z.object({ accountId: z.string().uuid().optional(), customerId: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional() })
      .parse(raw ?? {}))
  .handler(async ({ data }): Promise<LoyaltyTransaction[]> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.read')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabaseAdmin as any).from('crm_loyalty_transactions').select(sel('*'))
      .eq('organization_id', actor.organizationId)
      .order('created_at', { ascending: false }).limit(data.limit ?? 100)
    if (data.accountId) q = q.eq('account_id', data.accountId)
    if (data.customerId) q = q.eq('customer_id', data.customerId)
    const { data: rows } = await q
    return (rows ?? []) as LoyaltyTransaction[]
  })

export const listRewards = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => z.object({ activeOnly: z.boolean().optional() }).parse(raw ?? {}))
  .handler(async ({ data }): Promise<Reward[]> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'loyalty.read')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabaseAdmin as any).from('crm_reward_catalog').select(sel('*'))
      .eq('organization_id', actor.organizationId)
      .order('points_cost', { ascending: true }).limit(200)
    if (data.activeOnly) q = q.eq('is_active', true)
    const { data: rows } = await q
    return (rows ?? []) as Reward[]
  })

export const listLoyaltyRules = createServerFn({ method: 'GET' }).handler(async (): Promise<LoyaltyRule[]> => {
  const { getActor, requirePermission } = await import('./session.server')
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const actor = await getActor()
  requirePermission(actor, 'loyalty.read')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any).from('crm_loyalty_rules').select(sel('*'))
    .eq('organization_id', actor.organizationId).order('priority', { ascending: true })
  return (data ?? []) as LoyaltyRule[]
})

export const listLoyaltyTiers = createServerFn({ method: 'GET' }).handler(async (): Promise<LoyaltyTier[]> => {
  const { getActor, requirePermission } = await import('./session.server')
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const actor = await getActor()
  requirePermission(actor, 'loyalty.read')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any).from('crm_loyalty_tiers').select(sel('*'))
    .eq('organization_id', actor.organizationId).order('min_lifetime_points', { ascending: true })
  return (data ?? []) as LoyaltyTier[]
})
