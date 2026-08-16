// AI Tool Registry — narrow, read-only tools invoked by agents.
// Each tool is server-only, org-scoped, and returns compact JSON-serializable data.
// Table types for our newly created domain tables aren't in the generated
// Supabase types yet, so we cast the admin client through `any` here.
import type { Actor } from '../session.server'

export interface ToolContext {
  actor: Actor
}

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
}

export type ToolExecutor = (ctx: ToolContext, input: Record<string, unknown>) => Promise<ToolResult>

export interface ToolDefinition {
  key: string
  description: string
  execute: ToolExecutor
}

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

const TOOLS: Record<string, ToolDefinition> = {
  search_products: {
    key: 'search_products',
    description:
      'Search store_products (catalog + stock) by name, store_code, barcode, or supplier. Input: { query?: string, code?: string, supplier?: string, limit?: number }',
    execute: async ({ actor }, input) => {
      const q = String(input.query ?? '').trim()
      const code = String(input.code ?? '').trim()
      const supplier = String(input.supplier ?? '').trim()
      if (!q && !code && !supplier) {
        return { ok: false, error: 'query, code, or supplier is required' }
      }
      const limit = Math.min(Math.max(Number(input.limit ?? 15), 1), 50)
      const sb = await admin()
      let qb = sb
        .from('store_products')
        .select(
          'id, name, name_ar, name_en, brand, store_code, barcode, price, stock_balance, supplier_name_text, pack_unit, image_url, requires_prescription',
        )
        .eq('organization_id', actor.organizationId)
        .limit(limit)
      if (code) qb = qb.eq('store_code', code)
      if (supplier) qb = qb.ilike('supplier_name_text', `%${supplier}%`)
      if (q) {
        const term = `%${q.replace(/[,()*"']/g, ' ')}%`
        qb = qb.or(
          `name_ar.ilike.${term},name_en.ilike.${term},brand.ilike.${term},generic_name.ilike.${term},barcode.ilike.${term},store_code.ilike.${term}`,
        )
      }
      const { data, error } = await qb
      if (error) return { ok: false, error: error.message }
      return { ok: true, data }
    },
  },
  store_query: {
    key: 'store_query',
    description:
      'Return a compact structured summary of one catalog product (name, price, total on-hand stock, supplier, category, generic name, description, requires_prescription). Input: { productId: string }',
    execute: async ({ actor }, input) => {
      const pid = String(input.productId ?? '').trim()
      if (!pid) return { ok: false, error: 'productId is required' }
      const sb = await admin()
      const { data: p, error } = await sb
        .from('catalog_products')
        .select(
          'id, name_ar, name_en, brand, manufacturer, generic_name, dosage_form, strength, active_ingredients, description_ar, sbdma_official_price, requires_prescription, agent_name, manufacturer_country, category_id',
        )
        .eq('id', pid)
        .maybeSingle()
      if (error) return { ok: false, error: error.message }
      if (!p) return { ok: false, error: 'product_not_found' }
      const { data: batches } = await sb
        .from('inv_stock_batches')
        .select('qty_on_hand')
        .eq('organization_id', actor.organizationId)
        .eq('product_id', pid)
      const stock_total = ((batches ?? []) as Array<{ qty_on_hand: number }>).reduce(
        (s, r) => s + Number(r.qty_on_hand ?? 0),
        0,
      )
      return {
        ok: true,
        data: {
          name: p.name_ar ?? p.name_en,
          name_en: p.name_en,
          generic_name: p.generic_name,
          brand: p.brand,
          manufacturer: p.manufacturer ?? p.agent_name,
          manufacturer_country: p.manufacturer_country,
          dosage_form: p.dosage_form,
          strength: p.strength,
          active_ingredients: p.active_ingredients,
          description: p.description_ar,
          price_yer: p.sbdma_official_price,
          requires_prescription: p.requires_prescription,
          stock_total,
        },
      }
    },
  },
  get_product_stock: {
    key: 'get_product_stock',
    description: 'Return on-hand stock per batch for a product. Input: { product_id: string }',
    execute: async ({ actor }, input) => {
      const pid = String(input.product_id ?? '').trim()
      if (!pid) return { ok: false, error: 'product_id is required' }
      const sb = await admin()
      const { data, error } = await sb
        .from('inv_stock_batches')
        .select('warehouse_id, qty_on_hand, qty_reserved, expiry_date')
        .eq('organization_id', actor.organizationId)
        .eq('product_id', pid)
        .gt('qty_on_hand', 0)
        .order('expiry_date', { ascending: true })
        .limit(20)
      if (error) return { ok: false, error: error.message }
      return { ok: true, data }
    },
  },
  list_low_stock: {
    key: 'list_low_stock',
    description: 'List products whose total on-hand is at or below a threshold. Input: { threshold?: number }',
    execute: async ({ actor }, input) => {
      const threshold = Math.max(Number(input.threshold ?? 10), 0)
      const sb = await admin()
      const { data, error } = await sb
        .from('inv_stock_batches')
        .select('product_id, qty_on_hand')
        .eq('organization_id', actor.organizationId)
      if (error) return { ok: false, error: error.message }
      const totals = new Map<string, number>()
      for (const r of (data ?? []) as Array<{ product_id: string; qty_on_hand: number }>) {
        totals.set(r.product_id, (totals.get(r.product_id) ?? 0) + Number(r.qty_on_hand ?? 0))
      }
      const low = Array.from(totals.entries())
        .filter(([, q]) => q <= threshold)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 25)
        .map(([product_id, total_on_hand]) => ({ product_id, total_on_hand }))
      return { ok: true, data: { threshold, count: low.length, items: low } }
    },
  },
  list_expiring_soon: {
    key: 'list_expiring_soon',
    description: 'List batches expiring within N days. Input: { days?: number }',
    execute: async ({ actor }, input) => {
      const days = Math.min(Math.max(Number(input.days ?? 60), 1), 365)
      const sb = await admin()
      const cutoff = new Date(Date.now() + days * 86400 * 1000).toISOString().slice(0, 10)
      const { data, error } = await sb
        .from('inv_stock_batches')
        .select('id, product_id, batch_no, expiry_date, qty_on_hand')
        .eq('organization_id', actor.organizationId)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', cutoff)
        .gt('qty_on_hand', 0)
        .order('expiry_date', { ascending: true })
        .limit(50)
      if (error) return { ok: false, error: error.message }
      return { ok: true, data: { horizon_days: days, count: (data ?? []).length, items: data } }
    },
  },
  ops_snapshot: {
    key: 'ops_snapshot',
    description: 'Snapshot of open POs, active prescriptions, and pending claims for the org.',
    execute: async ({ actor }) => {
      const sb = await admin()
      const org = actor.organizationId
      const [po, rx, cl] = await Promise.all([
        sb.from('purchase_orders').select('id, status')
          .eq('organization_id', org)
          .in('status', ['draft', 'submitted', 'approved', 'received_partial']).limit(100),
        sb.from('hc_prescriptions').select('id, status')
          .eq('organization_id', org)
          .in('status', ['submitted', 'validated', 'approved']).limit(100),
        sb.from('insv2_claims').select('id, status')
          .eq('organization_id', org)
          .in('status', ['submitted', 'in_review']).limit(100),
      ])
      return {
        ok: true,
        data: {
          open_purchase_orders: po.data?.length ?? 0,
          active_prescriptions: rx.data?.length ?? 0,
          pending_claims: cl.data?.length ?? 0,
        },
      }
    },
  },
  get_loyalty_balance: {
    key: 'get_loyalty_balance',
    description: 'Return current loyalty balance/tier for a customer. Input: { customer_id: string }',
    execute: async ({ actor }, input) => {
      const cid = String(input.customer_id ?? '').trim()
      if (!cid) return { ok: false, error: 'customer_id is required' }
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'ai.loyalty.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const { data } = await sb.from('crm_loyalty_accounts')
        .select('id, points_balance, points_lifetime_earned, status, tier:crm_loyalty_tiers(name, multiplier)')
        .eq('organization_id', actor.organizationId).eq('customer_id', cid).maybeSingle()
      return { ok: true, data: data ?? null }
    },
  },
  customer_loyalty_history: {
    key: 'customer_loyalty_history',
    description: 'Return recent loyalty ledger entries for a customer. Input: { customer_id: string, limit?: number }',
    execute: async ({ actor }, input) => {
      const cid = String(input.customer_id ?? '').trim()
      if (!cid) return { ok: false, error: 'customer_id is required' }
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'ai.loyalty.read')) return { ok: false, error: 'permission denied' }
      const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100)
      const sb = await admin()
      const { data } = await sb.from('crm_loyalty_transactions')
        .select('id, kind, points, reason, created_at')
        .eq('organization_id', actor.organizationId).eq('customer_id', cid)
        .order('created_at', { ascending: false }).limit(limit)
      return { ok: true, data: data ?? [] }
    },
  },
  suggest_rewards: {
    key: 'suggest_rewards',
    description: 'Suggest rewards the customer can afford right now. Input: { customer_id: string }',
    execute: async ({ actor }, input) => {
      const cid = String(input.customer_id ?? '').trim()
      if (!cid) return { ok: false, error: 'customer_id is required' }
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'ai.loyalty.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const { data: acc } = await sb.from('crm_loyalty_accounts')
        .select('points_balance').eq('organization_id', actor.organizationId).eq('customer_id', cid).maybeSingle()
      const balance = Number(acc?.points_balance ?? 0)
      const { data: rewards } = await sb.from('crm_reward_catalog')
        .select('id, code, name, points_cost, stock')
        .eq('organization_id', actor.organizationId).eq('is_active', true)
        .lte('points_cost', balance).order('points_cost', { ascending: false }).limit(10)
      return { ok: true, data: { balance, suggestions: rewards ?? [] } }
    },
  },
  campaign_statistics: {
    key: 'campaign_statistics',
    description: 'Aggregate campaign stats for the org. Input: { limit?: number }',
    execute: async ({ actor }, input) => {
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'ai.campaign.read')) return { ok: false, error: 'permission denied' }
      const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100)
      const sb = await admin()
      const { data } = await sb.from('crm_campaigns')
        .select('id, code, name, status, audience_size, sent_count, failed_count, channel, created_at')
        .eq('organization_id', actor.organizationId).order('created_at', { ascending: false }).limit(limit)
      return { ok: true, data: data ?? [] }
    },
  },
  segment_preview: {
    key: 'segment_preview',
    description: 'Preview a segment (existing) by id. Input: { segment_id: string }',
    execute: async ({ actor }, input) => {
      const sid = String(input.segment_id ?? '').trim()
      if (!sid) return { ok: false, error: 'segment_id is required' }
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'ai.campaign.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const { data: seg } = await sb.from('crm_segments')
        .select('id, name, member_count, last_recalculated_at')
        .eq('organization_id', actor.organizationId).eq('id', sid).maybeSingle()
      return { ok: true, data: seg ?? null }
    },
  },
  recommend_campaign: {
    key: 'recommend_campaign',
    description: 'Suggest a channel + template angle for a segment based on its size and existing campaign history.',
    execute: async ({ actor }, input) => {
      const sid = String(input.segment_id ?? '').trim()
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'ai.campaign.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const { data: seg } = await sb.from('crm_segments').select('member_count')
        .eq('organization_id', actor.organizationId).eq('id', sid).maybeSingle()
      const size = Number(seg?.member_count ?? 0)
      const channel = size > 500 ? 'email' : size > 100 ? 'sms' : 'whatsapp'
      const angle = size > 500 ? 'newsletter (email)' : size > 100 ? 'promo alert (sms)' : 'personal outreach (whatsapp)'
      return { ok: true, data: { segment_size: size, recommended_channel: channel, angle } }
    },
  },
  validate_coupon: {
    key: 'validate_coupon',
    description: 'Validate a coupon code without redeeming it. Input: { code: string }',
    execute: async ({ actor }, input) => {
      const code = String(input.code ?? '').trim().toUpperCase()
      if (!code) return { ok: false, error: 'code required' }
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'campaign.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const { data: cc } = await sb.from('crm_coupon_codes')
        .select('id, code, usage_limit, usage_count, is_active, expires_at, coupon_id, crm_coupons(status, expires_at, starts_at, name)')
        .eq('organization_id', actor.organizationId).eq('code', code).maybeSingle()
      if (!cc) return { ok: true, data: { valid: false, reason: 'not_found' } }
      const now = new Date()
      if (!cc.is_active) return { ok: true, data: { valid: false, reason: 'inactive' } }
      if (cc.expires_at && new Date(cc.expires_at) < now) return { ok: true, data: { valid: false, reason: 'expired' } }
      if (cc.usage_limit != null && cc.usage_count >= cc.usage_limit) return { ok: true, data: { valid: false, reason: 'exhausted' } }
      const coup = (cc as { crm_coupons?: { status: string; expires_at: string | null; starts_at: string | null; name: string } }).crm_coupons
      if (coup && coup.status !== 'active') return { ok: true, data: { valid: false, reason: 'coupon_disabled' } }
      return { ok: true, data: { valid: true, coupon: coup?.name ?? null } }
    },
  },
  promotion_statistics: {
    key: 'promotion_statistics',
    description: 'Aggregate active promotions and recent redemption counts.',
    execute: async ({ actor }) => {
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'campaign.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const [{ data: promos }, { data: recent }] = await Promise.all([
        sb.from('crm_promotions').select('id, code, kind, status, usage_count, usage_limit')
          .eq('organization_id', actor.organizationId).order('usage_count', { ascending: false }).limit(20),
        sb.from('crm_promotion_redemptions').select('promotion_id, discount_amount, redeemed_at')
          .eq('organization_id', actor.organizationId).order('redeemed_at', { ascending: false }).limit(50),
      ])
      const totalDiscount = ((recent ?? []) as Array<{ discount_amount: number }>).reduce((s, r) => s + Number(r.discount_amount || 0), 0)
      return { ok: true, data: { promotions: promos ?? [], recent_discount_total: Math.round(totalDiscount * 100) / 100, recent_count: (recent ?? []).length } }
    },
  },
  suggest_promotions: {
    key: 'suggest_promotions',
    description: 'Suggest active promotions applicable to a category or a specific customer tier.',
    execute: async ({ actor }, input) => {
      const category = input.category ? String(input.category) : null
      const tier = input.tier ? String(input.tier) : null
      const { hasPermission } = await import('../session.server')
      if (!hasPermission(actor, 'campaign.read')) return { ok: false, error: 'permission denied' }
      const sb = await admin()
      const { data } = await sb.from('crm_promotions').select('id, code, name, kind, config, priority, stackable')
        .eq('organization_id', actor.organizationId).eq('status', 'active').order('priority', { ascending: true }).limit(15)
      const rows = ((data ?? []) as Array<{ kind: string; config: Record<string, unknown>; code: string; name: string; priority: number; stackable: boolean }>)
      const matches = rows.filter((p) => {
        if (category && p.kind === 'category_discount') return String(p.config?.category ?? '') === category
        if (tier && p.kind === 'tier_discount') return String(p.config?.tier ?? '') === tier
        return true
      })
      return { ok: true, data: matches }
    },
  },
}

export function getTool(key: string): ToolDefinition | undefined {
  return TOOLS[key]
}

export function listTools(): ToolDefinition[] {
  return Object.values(TOOLS)
}
