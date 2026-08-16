import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export interface InvoiceJobRow {
  id: string
  row_index: number
  decision: string
  reason: string | null
  matched_product_id: string | null
  name: string
  quantity: number | null
  unit_cost: number | null
  expiry_date: string | null
  batch_no: string | null
}

async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
): Promise<void> {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  const { data: owner } = await supabase.rpc('has_role', { _user_id: userId, _role: 'owner' })
  if (data !== true && owner !== true) throw new Error('صلاحيات المدير مطلوبة')
}

/** Rows extracted by the invoice OCR job, shaped for the review table. */
export const listInvoiceJobRows = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ jobId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<InvoiceJobRow[]> => {
    await assertAdmin(context.supabase as never, context.userId)
    const { data: rows, error } = await context.supabase
      .from('catalog_import_rows')
      .select('id, row_index, decision, reason, matched_product_id, payload')
      .eq('job_id', data.jobId)
      .order('row_index')
    if (error) throw new Error(error.message)

    return (rows ?? []).map((r) => {
      const row = r as {
        id: string
        row_index: number
        decision: string
        reason: string | null
        matched_product_id: string | null
        payload: Record<string, unknown> | null
      }
      const p = row.payload ?? {}
      const num = (v: unknown): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null
      const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
      return {
        id: row.id,
        row_index: row.row_index,
        decision: row.decision,
        reason: row.reason,
        matched_product_id: row.matched_product_id,
        name: str(p['name_ar']) ?? '—',
        quantity: num(p['_quantity']),
        unit_cost: num(p['_unit_cost']),
        expiry_date: str(p['_expiry_date']),
        batch_no: str(p['_batch_no']),
      }
    })
  })

const draftInput = z.object({
  jobId: z.string().uuid(),
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  currency: z.string().length(3).default('YER'),
  notes: z.string().max(2000).optional().nullable(),
})

export interface DraftPoResult {
  ok: boolean
  poId?: string
  code?: string
  linesCreated?: number
  skipped?: number
  error?: string
}

/**
 * Turns the matched rows of an OCR invoice job into a draft purchase order
 * for one-click pharmacist verification. Unmatched rows are skipped and
 * reported back so nothing is silently invented.
 */
export const createDraftPoFromInvoice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => draftInput.parse(raw))
  .handler(async ({ data, context }): Promise<DraftPoResult> => {
    try {
      await assertAdmin(context.supabase as never, context.userId)
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

      const { data: mem } = await context.supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', context.userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      const organizationId = (mem as { organization_id: string } | null)?.organization_id
      if (!organizationId) return { ok: false, error: 'لا توجد مؤسسة نشطة للمستخدم' }

      const { data: rows, error: rowsErr } = await supabaseAdmin
        .from('catalog_import_rows')
        .select('row_index, decision, matched_product_id, payload')
        .eq('job_id', data.jobId)
        .order('row_index')
      if (rowsErr) return { ok: false, error: rowsErr.message }

      const all = (rows ?? []) as Array<{
        row_index: number
        decision: string
        matched_product_id: string | null
        payload: Record<string, unknown> | null
      }>
      const usable = all.filter((r) => r.decision === 'matched' && r.matched_product_id)
      if (usable.length === 0) {
        return { ok: false, error: 'لا توجد أصناف مطابقة يمكن تحويلها لأمر شراء' }
      }

      const code = `PO-OCR-${Date.now().toString(36).toUpperCase()}`
      const lines = usable.map((r, idx) => {
        const p = r.payload ?? {}
        const qty = typeof p['_quantity'] === 'number' && p['_quantity']! > 0 ? (p['_quantity'] as number) : 1
        const cost = typeof p['_unit_cost'] === 'number' ? (p['_unit_cost'] as number) : 0
        return {
          line_no: idx + 1,
          product_id: r.matched_product_id as string,
          qty_ordered: qty,
          unit_cost: cost,
          batch_no: typeof p['_batch_no'] === 'string' ? p['_batch_no'] : null,
          expiry_date: typeof p['_expiry_date'] === 'string' ? p['_expiry_date'] : null,
        }
      })
      const total = lines.reduce((s, l) => s + l.qty_ordered * l.unit_cost, 0)

      const { data: po, error: poErr } = await supabaseAdmin
        .from('purchase_orders')
        .insert({
          organization_id: organizationId,
          supplier_id: data.supplierId,
          warehouse_id: data.warehouseId,
          code,
          currency: data.currency,
          notes: data.notes ?? `مُنشأ من فاتورة ممسوحة ضوئيًا (job ${data.jobId})`,
          total_amount: total,
          status: 'draft',
          created_by: context.userId,
        } as never)
        .select('id')
        .single()
      if (poErr || !po) return { ok: false, error: poErr?.message ?? 'تعذّر إنشاء أمر الشراء' }

      const poId = (po as { id: string }).id
      const { error: linesErr } = await supabaseAdmin
        .from('purchase_order_lines')
        .insert(lines.map((l) => ({ ...l, po_id: poId })) as never)
      if (linesErr) return { ok: false, error: linesErr.message }

      return {
        ok: true,
        poId,
        code,
        linesCreated: lines.length,
        skipped: all.length - lines.length,
      }
    } catch (err) {
      console.error('[createDraftPoFromInvoice]', err)
      return { ok: false, error: err instanceof Error ? err.message : 'خطأ غير متوقع' }
    }
  })
