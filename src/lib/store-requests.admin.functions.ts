// Admin-only reads and status updates for storefront requests
// (prescriptions, refill subscriptions, bundle orders) + AI usage stats.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

type AdminContext = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }
  userId: string
}

async function assertAdmin(context: AdminContext) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'admin',
  })
  if (!isAdmin) {
    const { data: isOwner } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'owner',
    })
    if (!isOwner) throw new Error('صلاحيات المدير مطلوبة')
  }
}

export interface PrescriptionRow {
  id: string
  full_name: string
  phone: string
  notes: string | null
  file_path: string | null
  status: string
  created_at: string
  signedUrl: string | null
}

/** Prescription uploads with fresh signed preview links. */
export const listPrescriptionUploads = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrescriptionRow[]> => {
    await assertAdmin(context as unknown as AdminContext)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin
      .from('store_prescription_uploads')
      .select('id, full_name, phone, notes, file_path, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)

    const rows = data ?? []
    const out: PrescriptionRow[] = []
    for (const r of rows) {
      let signedUrl: string | null = null
      if (r.file_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from('prescriptions')
          .createSignedUrl(r.file_path as string, 60 * 60)
        signedUrl = signed?.signedUrl ?? null
      }
      out.push({
        id: r.id as string,
        full_name: r.full_name as string,
        phone: r.phone as string,
        notes: (r.notes as string) ?? null,
        file_path: (r.file_path as string) ?? null,
        status: r.status as string,
        created_at: r.created_at as string,
        signedUrl,
      })
    }
    return out
  })

/** Chronic refill subscriptions. */
export const listRefillSubscriptions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminContext)
    const { data, error } = await context.supabase
      .from('store_refill_subscriptions')
      .select('id, full_name, phone, product_name, condition_tag, next_reminder_at, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)
    return data ?? []
  })

/** Health bundle orders. */
export const listBundleOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminContext)
    const { data, error } = await context.supabase
      .from('store_bundle_orders')
      .select('id, bundle_title, full_name, phone, notes, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)
    return data ?? []
  })

const statusSchema = z.object({
  table: z.enum(['prescriptions', 'refills', 'bundles']),
  id: z.string().uuid(),
  status: z.enum(['new', 'processing', 'closed', 'active', 'paused']),
})

const TABLE_MAP = {
  prescriptions: 'store_prescription_uploads',
  refills: 'store_refill_subscriptions',
  bundles: 'store_bundle_orders',
} as const

/** Move a request through its workflow. */
export const updateRequestStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => statusSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext)
    const { error } = await context.supabase
      .from(TABLE_MAP[data.table])
      .update({ status: data.status })
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export interface StorefrontTelemetry {
  assistantSessions: number
  assistantMessages: number
  toolRuns: number
  rxModalOpens: number
  pendingPrescriptions: number
  activeRefills: number
  bundleOrders: number
}

/** Storefront AI + tools usage (last 24h) for the Sun Core board. */
export const getStorefrontTelemetry = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorefrontTelemetry> => {
    await assertAdmin(context as unknown as AdminContext)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()

    const { data: events } = await supabaseAdmin
      .from('ai_widget_events')
      .select('kind')
      .gte('created_at', since)
      .limit(5000)
    const rows = events ?? []
    const count = (k: string) => rows.filter((r) => r.kind === k).length

    const [rx, refills, bundles] = await Promise.all([
      supabaseAdmin
        .from('store_prescription_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new'),
      supabaseAdmin
        .from('store_refill_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabaseAdmin
        .from('store_bundle_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),
    ])

    return {
      assistantSessions: count('assistant_open'),
      assistantMessages: count('assistant_message'),
      toolRuns: count('tool_bmi') + count('tool_pediatric') + count('tool_interactions'),
      rxModalOpens: count('rx_modal_open'),
      pendingPrescriptions: rx.count ?? 0,
      activeRefills: refills.count ?? 0,
      bundleOrders: bundles.count ?? 0,
    }
  })
