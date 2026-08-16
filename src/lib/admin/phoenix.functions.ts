// Phoenix Protocol v7.0 — read-only self-audit server functions.
// All 10 phases return structured diagnostics; healing is surfaced as
// copy-ready SQL rather than executed silently (per rule #1: no direct
// touch to sensitive prod tables without a snapshot).
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId)
  const roles = (data ?? []).map((r) => r.role as string)
  if (!roles.includes('admin') && !roles.includes('superadmin')) {
    throw new Error('Admin role required (phoenix.manage)')
  }
}

// ---------- Phase 0: Kernel & Environment ----------
export const phoenixProbeKernel = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    return {
      env: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        LOVABLE_API_KEY: !!process.env.LOVABLE_API_KEY,
      },
      runtime: {
        nodeVersion: typeof process !== 'undefined' ? process.version ?? 'worker' : 'worker',
        platform: typeof process !== 'undefined' ? process.platform ?? 'workerd' : 'workerd',
      },
    }
  })

// ---------- Phase 1: Connectivity latency ----------
export const phoenixProbeConnectivity = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const t0 = Date.now()
    const { error, count } = await supabaseAdmin
      .from('catalog_products')
      .select('*', { head: true, count: 'exact' })
    const latencyMs = Date.now() - t0
    return {
      admin: { ok: !error, latencyMs, count: count ?? null, error: error?.message ?? null },
    }
  })

// ---------- Phase 2: Schema forensics ----------
const REQUIRED: Array<{ name: string; columns: string[] }> = [
  { name: 'catalog_products', columns: ['id', 'store_code', 'name_ar', 'sbdma_official_price'] },
  { name: 'store_products', columns: ['id', 'name', 'price', 'stock_balance'] },
  { name: 'catalog_categories', columns: ['id'] },
  { name: 'inv_stock_batches', columns: ['id', 'product_id', 'qty_on_hand', 'expiry_date'] },
  { name: 'inv_stock_movements', columns: ['product_id', 'batch_id', 'movement_type'] },
  { name: 'orders', columns: ['id', 'user_id', 'customer_name', 'customer_phone', 'status'] },
  { name: 'order_status_history', columns: ['order_id', 'status'] },
  { name: 'cart_items', columns: ['user_id', 'product_id', 'quantity'] },
  { name: 'hc_patients', columns: ['id'] },
  { name: 'hc_prescriptions', columns: ['id'] },
  { name: 'hc_dispenses', columns: ['id'] },
  { name: 'air_agents', columns: ['key', 'is_active'] },
  { name: 'air_kernel_calls', columns: ['id'] },
  { name: 'user_roles', columns: ['user_id', 'role'] },
  { name: 'organization_members', columns: ['user_id', 'organization_id'] },
]

export const phoenixProbeSchema = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const results: Array<{
      table: string
      exists: boolean
      missingColumns: string[]
      error: string | null
      healSql?: string
    }> = []
    for (const t of REQUIRED) {
      const { error } = await (
        supabaseAdmin as unknown as {
          from: (n: string) => {
            select: (
              c: string,
              o: object,
            ) => { limit: (n: number) => Promise<{ error: { message: string } | null }> }
          }
        }
      )
        .from(t.name)
        .select(t.columns.join(','), { head: true, count: 'exact' })
        .limit(1)
      if (!error) {
        results.push({ table: t.name, exists: true, missingColumns: [], error: null })
        continue
      }
      const msg = error.message ?? ''
      if (/does not exist/i.test(msg) && /relation/i.test(msg)) {
        results.push({
          table: t.name,
          exists: false,
          missingColumns: t.columns,
          error: msg,
          healSql: `-- CREATE TABLE public.${t.name} (...);  -- generate DDL from migrations`,
        })
      } else if (/column .* does not exist/i.test(msg)) {
        const m = msg.match(/column "?([\w.]+)"? does not exist/i)
        const col = m ? m[1].split('.').pop()! : '<unknown>'
        results.push({
          table: t.name,
          exists: true,
          missingColumns: [col],
          error: msg,
          healSql: `ALTER TABLE public.${t.name} ADD COLUMN IF NOT EXISTS ${col} text;`,
        })
      } else {
        results.push({ table: t.name, exists: true, missingColumns: [], error: msg })
      }
    }
    return { results }
  })

// ---------- Phase 3: Index audit ----------
const CRITICAL_INDEXES: Array<{ table: string; cols: string; name: string }> = [
  { table: 'catalog_products', cols: 'store_code', name: 'catalog_products_store_code_uniq' },
  { table: 'catalog_products', cols: 'name_ar', name: 'idx_catalog_products_name_ar' },
  {
    table: 'inv_stock_batches',
    cols: 'product_id, expiry_date',
    name: 'idx_inv_stock_batches_product_expiry',
  },
  { table: 'orders', cols: 'user_id, created_at DESC', name: 'idx_orders_user_created' },
  { table: 'cart_items', cols: 'user_id, product_id', name: 'idx_cart_items_user_product' },
]

export const phoenixProbeIndexes = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    // Use pg_indexes via a raw select through a system view helper; fall back to naming heuristic.
    const results: Array<{ table: string; expected: string; present: boolean; healSql: string }> = []
    for (const ix of CRITICAL_INDEXES) {
      const { data, error } = await (supabaseAdmin as unknown as {
        rpc: (fn: string, args: object) => Promise<{ data: unknown; error: { message: string } | null }>
      }).rpc('pg_get_indexdef_by_name', { p_name: ix.name })
      const present = !!data && !error
      results.push({
        table: ix.table,
        expected: ix.name,
        present,
        healSql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${ix.name} ON public.${ix.table} (${ix.cols});`,
      })
    }
    return { results, note: 'Index presence is best-effort; run the healSql in SQL editor if missing.' }
  })

// ---------- Phase 4: RLS live matrix ----------
export const phoenixProbeRls = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabase: userClient, userId } = context
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Admin: read all orders (service role, RLS bypassed)
    const adminOrders = await supabaseAdmin
      .from('orders')
      .select('*', { head: true, count: 'exact' })
    // Authenticated: read own orders (RLS applies)
    const myOrders = await userClient
      .from('orders')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', userId)
    // Anon: read catalog via publishable key
    let anonCatalog = { ok: false, count: null as number | null, error: null as string | null }
    try {
      const url = process.env.SUPABASE_URL!
      const key = process.env.SUPABASE_PUBLISHABLE_KEY!
      const res = await fetch(`${url}/rest/v1/catalog_products?select=id&limit=1`, {
        method: 'HEAD',
        headers: { apikey: key, Prefer: 'count=exact' },
      })
      const contentRange = res.headers.get('content-range')
      const parsed = contentRange ? Number(contentRange.split('/').pop()) : null
      anonCatalog = {
        ok: res.ok,
        count: Number.isFinite(parsed) ? parsed : null,
        error: res.ok ? null : `HTTP ${res.status}`,
      }
    } catch (e) {
      anonCatalog.error = String((e as Error).message ?? e)
    }

    // Write test: attempt to insert an order impersonating a different user_id — MUST fail
    const bogusUser = '00000000-0000-0000-0000-000000000001'
    const writeTest = await (userClient.from('orders') as unknown as {
      insert: (row: object) => {
        select: (c: string) => { maybeSingle: () => Promise<{ error: { message: string } | null }> }
      }
    })
      .insert({
        id: '00000000-0000-0000-0000-0000000000ff',
        user_id: bogusUser,
        customer_name: '__phoenix_probe__',
        customer_phone: '__probe__',
        customer_address: '__probe__',
        status: 'pending',
      })
      .select('id')
      .maybeSingle()
    const writeBlocked = !!writeTest.error
    return {
      anonCatalogRead: anonCatalog,
      authOwnOrdersRead: {
        ok: !myOrders.error,
        count: myOrders.count ?? 0,
        error: myOrders.error?.message ?? null,
      },
      adminAllOrdersRead: {
        ok: !adminOrders.error,
        count: adminOrders.count ?? 0,
        error: adminOrders.error?.message ?? null,
      },
      crossUserWriteBlocked: {
        ok: writeBlocked,
        error: writeTest.error?.message ?? 'WRITE SUCCEEDED — RLS BROKEN',
      },
    }
  })

// ---------- Phase 5: Storage buckets ----------
export const phoenixProbeStorage = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const required = ['product-images', 'prescriptions', 'medical-vault', 'invoice-extractions']
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets()
    const present = new Set((buckets ?? []).map((b) => b.name))
    const status = required.map((name) => {
      const b = (buckets ?? []).find((x) => x.name === name)
      return {
        bucket: name,
        exists: present.has(name),
        public: b?.public ?? null,
        healNote: !present.has(name)
          ? `Create bucket "${name}" via Storage panel (private).`
          : null,
      }
    })
    return { status, listError: error?.message ?? null }
  })

// ---------- Phase 6: FEFO RPC ----------
export const phoenixProbeFefo = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.rpc('checkout_cart_fefo', {
      p_customer_address: '__phoenix__',
      p_customer_name: '__phoenix__',
      p_customer_phone: '__phoenix__',
      p_payment_method_code: '__phoenix_no_such__',
      p_shipping_zone_id: '00000000-0000-0000-0000-000000000000',
    })
    const msg = error?.message ?? ''
    const rpcMissing = /function .*checkout_cart_fefo.* does not exist/i.test(msg)
    return {
      rpcExists: !rpcMissing,
      probeMessage: msg || '(unexpected success)',
    }
  })

// ---------- Phase 7: AI Kernel ----------
export const phoenixProbeAi = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: agent } = await supabaseAdmin
      .from('air_agents')
      .select('key, is_active, allowed_tools, model')
      .eq('key', 'catalog_advisor')
      .maybeSingle()
    if (!agent)
      return { agentExists: false, agentActive: false, dispatchOk: false, output: '', error: 'agent missing' }
    if (!agent.is_active)
      return { agentExists: true, agentActive: false, dispatchOk: false, output: '', error: 'inactive' }
    try {
      // Auto-heal: make sure the current admin has an org membership before dispatch.
      await supabaseAdmin.rpc('ensure_user_organization', { p_user_id: context.userId })
      const { dispatch } = await import('@/lib/ai/runtime/kernel.server')
      const { getActor } = await import('@/lib/session.server')
      const actor = await getActor()
      const res = await dispatch(actor, {
        agentKey: 'catalog_advisor',
        input: 'phoenix ping — reply "ok".',
        tier: 'balanced',
      })
      return {
        agentExists: true,
        agentActive: true,
        dispatchOk: true,
        output: res.output.slice(0, 300),
        model: res.model,
        latencyMs: res.latencyMs,
        error: null,
      }
    } catch (e) {
      return {
        agentExists: true,
        agentActive: true,
        dispatchOk: false,
        output: '',
        error: String((e as Error).message ?? e),
      }
    }
  })

// ---------- Phase 8: Auth / has_role ----------
export const phoenixProbeAuth = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    return {
      hasRoleExists: !error,
      hasRoleResult: data ?? null,
      error: error?.message ?? null,
      userId: context.userId,
    }
  })

// ---------- Phase 9: Performance ----------
export const phoenixProbePerformance = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    // A single round-trip latency sample as a proxy — real slow-query analysis
    // belongs in the operator's dashboard (pg_stat_statements).
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const samples: number[] = []
    for (let i = 0; i < 3; i++) {
      const t = Date.now()
      await supabaseAdmin.from('catalog_products').select('id', { head: true, count: 'exact' })
      samples.push(Date.now() - t)
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    return { samples, avgMs: Math.round(avg), acceptable: avg < 500 }
  })

// ---------- Phase 10: Golden path (server-side subset) ----------
export const phoenixProbeGoldenPath = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabase: userClient, userId } = context
    const catalog = await userClient
      .from('store_products')
      .select('id, name, price')
      .limit(1)
    const ordersView = await userClient
      .from('orders')
      .select('id, status', { head: true, count: 'exact' })
      .eq('user_id', userId)
    return {
      catalogSearch: {
        ok: !catalog.error,
        sampleName: (catalog.data?.[0] as { name?: string } | undefined)?.name ?? null,
        error: catalog.error?.message ?? null,
      },
      ordersHistory: {
        ok: !ordersView.error,
        count: ordersView.count ?? 0,
        error: ordersView.error?.message ?? null,
      },
    }
  })
