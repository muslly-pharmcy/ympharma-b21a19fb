// Predictive reorder engine — server-only.
//
// Computes a daily burn rate per (warehouse, product) from real STOCK_SOLD
// movements, then derives safety stock, reorder point and a suggested order
// quantity. Written to `public.inv_reorder_suggestions` for the purchasing UI.

export interface ReorderParams {
  organizationId: string
  windowDays?: number
  leadTimeDays?: number
  /** Target days of cover the suggested quantity should restore. */
  coverDays?: number
  /** Z-factor applied to demand variability for safety stock. */
  serviceFactor?: number
}

export interface ReorderRow {
  warehouse_id: string
  product_id: string
  supplier_id: string | null
  on_hand: number
  daily_burn_rate: number
  lead_time_days: number
  safety_stock: number
  reorder_point: number
  suggested_qty: number
  days_of_cover: number | null
}

const DEFAULTS = { windowDays: 90, leadTimeDays: 14, coverDays: 45, serviceFactor: 1.65 }

interface MovementRow {
  warehouse_id: string | null
  product_id: string | null
  qty_delta: number | string | null
  occurred_at: string
}

interface BatchRow {
  warehouse_id: string | null
  product_id: string | null
  qty_on_hand: number | string | null
  qty_reserved: number | string | null
  supplier_id: string | null
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

const key = (w: string, p: string) => `${w}::${p}`

/** Sample standard deviation of daily consumption. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export async function computeReorderSuggestions(params: ReorderParams): Promise<ReorderRow[]> {
  const cfg = { ...DEFAULTS, ...params }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const since = new Date(Date.now() - cfg.windowDays * 86_400_000).toISOString()

  const { data: movements } = await supabaseAdmin
    .from('inv_stock_movements')
    .select('warehouse_id, product_id, qty_delta, occurred_at')
    .eq('organization_id', cfg.organizationId)
    .eq('movement_type', 'STOCK_SOLD')
    .gte('occurred_at', since)
    .limit(50_000)

  // daily consumption series per (warehouse, product)
  const daily = new Map<string, Map<string, number>>()
  for (const row of (movements ?? []) as MovementRow[]) {
    if (!row.warehouse_id || !row.product_id) continue
    const k = key(row.warehouse_id, row.product_id)
    const day = row.occurred_at.slice(0, 10)
    const series = daily.get(k) ?? new Map<string, number>()
    series.set(day, (series.get(day) ?? 0) + Math.abs(num(row.qty_delta)))
    daily.set(k, series)
  }

  const { data: batches } = await supabaseAdmin
    .from('inv_stock_batches')
    .select('warehouse_id, product_id, qty_on_hand, qty_reserved, supplier_id')
    .eq('organization_id', cfg.organizationId)
    .gt('qty_on_hand', 0)
    .limit(50_000)

  const onHand = new Map<string, { qty: number; supplierId: string | null; warehouseId: string; productId: string }>()
  for (const row of (batches ?? []) as BatchRow[]) {
    if (!row.warehouse_id || !row.product_id) continue
    const k = key(row.warehouse_id, row.product_id)
    const prev = onHand.get(k)
    onHand.set(k, {
      // available = on hand minus what is already reserved for open orders
      qty: (prev?.qty ?? 0) + Math.max(0, num(row.qty_on_hand) - num(row.qty_reserved)),
      supplierId: prev?.supplierId ?? row.supplier_id ?? null,
      warehouseId: row.warehouse_id,
      productId: row.product_id,
    })
  }

  // Union of everything we have signal for: consumed items may already be at zero.
  const keys = new Set<string>([...daily.keys(), ...onHand.keys()])
  const suggestions: ReorderRow[] = []

  for (const k of keys) {
    const stock = onHand.get(k)
    const series = daily.get(k)
    const [warehouseId, productId] = k.split('::')
    if (!warehouseId || !productId) continue

    const consumedTotal = series ? Array.from(series.values()).reduce((a, b) => a + b, 0) : 0
    const burn = consumedTotal / cfg.windowDays
    if (burn <= 0) continue // no demand signal → nothing to predict

    const dailyValues = Array.from({ length: cfg.windowDays }, (_, i) => {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
      return series?.get(day) ?? 0
    })

    const sigma = stdDev(dailyValues)
    const safetyStock = Math.ceil(cfg.serviceFactor * sigma * Math.sqrt(cfg.leadTimeDays))
    const reorderPoint = Math.ceil(burn * cfg.leadTimeDays + safetyStock)
    const qtyOnHand = stock?.qty ?? 0

    if (qtyOnHand > reorderPoint) continue // healthy

    const target = Math.ceil(burn * cfg.coverDays + safetyStock)
    const suggestedQty = Math.max(0, target - qtyOnHand)
    if (suggestedQty <= 0) continue

    suggestions.push({
      warehouse_id: warehouseId,
      product_id: productId,
      supplier_id: stock?.supplierId ?? null,
      on_hand: Number(qtyOnHand.toFixed(3)),
      daily_burn_rate: Number(burn.toFixed(4)),
      lead_time_days: cfg.leadTimeDays,
      safety_stock: safetyStock,
      reorder_point: reorderPoint,
      suggested_qty: suggestedQty,
      days_of_cover: burn > 0 ? Number((qtyOnHand / burn).toFixed(2)) : null,
    })
  }

  suggestions.sort((a, b) => (a.days_of_cover ?? 0) - (b.days_of_cover ?? 0))
  return suggestions
}

/** Recompute and persist suggestions for an organization. */
export async function refreshReorderSuggestions(params: ReorderParams): Promise<{
  computed: number
  persisted: number
}> {
  const cfg = { ...DEFAULTS, ...params }
  const rows = await computeReorderSuggestions(cfg)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  if (rows.length === 0) return { computed: 0, persisted: 0 }

  const payload = rows.map((row) => ({
    ...row,
    organization_id: cfg.organizationId,
    window_days: cfg.windowDays,
    status: 'open',
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { error, count } = await supabaseAdmin
    .from('inv_reorder_suggestions')
    .upsert(payload, {
      onConflict: 'organization_id,warehouse_id,product_id',
      count: 'exact',
    })

  if (error) throw error
  return { computed: rows.length, persisted: count ?? rows.length }
}
