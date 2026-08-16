// Titanos Self-Auditing Engine — read-only diagnostic server functions.
// All functions require admin. No destructive writes on real tables.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
  const roles = (data ?? []).map((r) => r.role as string)
  if (!roles.includes('admin') && !roles.includes('superadmin')) {
    throw new Error('Admin role required')
  }
}

// ---------- Phase 0: Environment probe ----------
export const titanosProbeEnv = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const env = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      LOVABLE_API_KEY: !!process.env.LOVABLE_API_KEY,
    }
    let connectivity: { ok: boolean; message: string; count: number | null } = {
      ok: false,
      message: '',
      count: null,
    }
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      const { count, error } = await supabaseAdmin
        .from('catalog_products')
        .select('*', { head: true, count: 'exact' })
      connectivity = {
        ok: !error,
        message: error?.message ?? 'connected',
        count: count ?? null,
      }
    } catch (e) {
      connectivity.message = String((e as Error).message ?? e)
    }
    return { env, connectivity }
  })

// ---------- Phase 1: Schema integrity ----------
const REQUIRED_TABLES: Array<{ name: string; columns: string[] }> = [
  { name: 'catalog_products', columns: ['id', 'code', 'name', 'selling_price'] },
  {
    name: 'inv_stock_batches',
    columns: ['id', 'product_id', 'qty_on_hand', 'qty_reserved', 'selling_price', 'expiry_date'],
  },
  { name: 'orders', columns: ['id', 'customer_name', 'customer_phone', 'status'] },
  { name: 'cart_items', columns: ['user_id', 'product_id', 'quantity'] },
  { name: 'user_roles', columns: ['user_id', 'role'] },
  { name: 'inv_stock_movements', columns: ['product_id', 'batch_id', 'movement_type'] },
]

export const titanosCheckSchema = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const results: Array<{ table: string; exists: boolean; missingColumns: string[]; error: string | null }> = []
    for (const t of REQUIRED_TABLES) {
      // Ask for the specific columns; PostgREST returns column-level errors when missing.
      const cols = t.columns.join(',')
      const { error } = await (supabaseAdmin as unknown as { from: (n: string) => { select: (c: string, o: object) => { limit: (n: number) => Promise<{ error: { message: string; code?: string } | null }> } } })
        .from(t.name)
        .select(cols, { head: true, count: 'exact' })
        .limit(1)
      if (!error) {
        results.push({ table: t.name, exists: true, missingColumns: [], error: null })
        continue
      }
      const msg = error.message ?? ''
      // 42P01 = undefined_table, 42703 = undefined_column
      if (/does not exist/i.test(msg) && /relation/i.test(msg)) {
        results.push({ table: t.name, exists: false, missingColumns: t.columns, error: msg })
      } else if (/column .* does not exist/i.test(msg)) {
        const m = msg.match(/column "?([\w.]+)"? does not exist/i)
        results.push({
          table: t.name,
          exists: true,
          missingColumns: m ? [m[1].split('.').pop()!] : ['<unknown>'],
          error: msg,
        })
      } else {
        results.push({ table: t.name, exists: true, missingColumns: [], error: msg })
      }
    }
    return { results }
  })

// ---------- Phase 2: RLS live test ----------
export const titanosCheckRls = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabase: userClient, userId } = context
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // 2.3 admin: read all orders using service role (bypasses RLS — proxy for "admin can see all")
    const adminOrders = await supabaseAdmin
      .from('orders')
      .select('*', { head: true, count: 'exact' })

    // 2.2 auth: read user's own orders under RLS
    const myOrders = await userClient
      .from('orders')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', userId)

    // 2.1 anon read of catalog: use unauthenticated PostgREST call via publishable key
    let anonCatalog: { ok: boolean; count: number | null; error: string | null } = {
      ok: false,
      count: null,
      error: null,
    }
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
    }
  })

// ---------- Phase 4: FEFO RPC introspection (non-destructive) ----------
export const titanosCheckFefo = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    // Call the RPC with intentionally invalid args → we expect an error
    // whose message proves the function exists and executed validation.
    const { error } = await supabaseAdmin.rpc('checkout_cart_fefo', {
      p_customer_address: '__diag__',
      p_customer_name: '__diag__',
      p_customer_phone: '__diag__',
      p_payment_method_code: '__diag_no_such_method__',
      p_shipping_zone_id: '00000000-0000-0000-0000-000000000000',
    })
    // We WANT an error — that proves the function is reachable.
    // Success would be alarming (would mean it processed a bogus checkout).
    const msg = error?.message ?? ''
    const rpcMissing = /function .*checkout_cart_fefo.* does not exist/i.test(msg)
    return {
      rpcExists: !rpcMissing,
      probeError: msg || 'unexpected success — investigate',
    }
  })

// ---------- Phase 5: AI Kernel test ----------
export const titanosCheckAi = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: agent } = await supabaseAdmin
      .from('air_agents')
      .select('key, is_active, allowed_tools, model')
      .eq('key', 'catalog_advisor')
      .maybeSingle()

    if (!agent) return { agentExists: false, agentActive: false, dispatchOk: false, output: '', error: 'agent catalog_advisor not found' }
    if (!agent.is_active) return { agentExists: true, agentActive: false, dispatchOk: false, output: '', error: 'agent inactive' }

    try {
      const { dispatch } = await import('@/lib/ai/runtime/kernel.server')
      const { getActor } = await import('@/lib/session.server')
      const actor = await getActor()
      const res = await dispatch(actor, {
        agentKey: 'catalog_advisor',
        input: 'ping — return one short sentence confirming you are online.',
        tier: 'balanced',
      })
      return {
        agentExists: true,
        agentActive: true,
        dispatchOk: true,
        output: res.output.slice(0, 400),
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
