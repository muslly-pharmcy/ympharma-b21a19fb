import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { StockBatch, StockSummary, Warehouse } from '@/domain/inventory/schemas'

// R1.1 — F-07 remediation: gate warehouse/stock reads behind Supabase Auth.
// Tables are org-scoped (RLS: is_org_member). Anon reads always returned [];
// now we require an authenticated session so RLS evaluates against a real
// membership rather than silently degrading to empty results.

const sel = (s: string): string => s

export const listWarehouses = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Warehouse[]> => {
    const { data, error } = await context.supabase
      .from('wh_warehouses')
      .select(sel('*'))
      .eq('is_active', true)
      .order('name')
    if (error) {
      console.error('[listWarehouses]', error)
      return []
    }
    return (data ?? []) as unknown as Warehouse[]
  })

export const getStockSummary = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<StockSummary> => {
    const { data: batches, error } = await context.supabase
      .from('inv_stock_batches')
      .select(sel('qty_on_hand,qty_reserved,expiry_date'))
      .eq('product_id', data.productId)

    if (error || !batches) {
      return {
        productId: data.productId,
        totalOnHand: 0,
        totalReserved: 0,
        batches: 0,
        nearestExpiry: null,
      }
    }

    const rows = batches as unknown as Array<
      Pick<StockBatch, 'qty_on_hand' | 'qty_reserved' | 'expiry_date'>
    >
    const totalOnHand = rows.reduce((s, b) => s + Number(b.qty_on_hand ?? 0), 0)
    const totalReserved = rows.reduce((s, b) => s + Number(b.qty_reserved ?? 0), 0)
    const expiries = rows
      .map((b) => b.expiry_date)
      .filter((d): d is string => !!d)
      .sort()
    return {
      productId: data.productId,
      totalOnHand,
      totalReserved,
      batches: rows.length,
      nearestExpiry: expiries[0] ?? null,
    }
  })
