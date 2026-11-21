import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { validateOcrPurchaseDraft } from './ocr-purchase-draft-validation'

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
    // Admin role alone must not disclose another user's private OCR upload.
    const { data: job, error: jobError } = await context.supabase
      .from('catalog_import_jobs')
      .select('id')
      .eq('id', data.jobId)
      .eq('uploaded_by', context.userId)
      .maybeSingle()
    if (jobError || !job) throw new Error('الفاتورة غير موجودة أو ليست ضمن حسابك')
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
  currency: z.enum(['YER', 'SAR', 'USD']),
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

      const { getActorFromSupabase, requirePermission } = await import('./session.server')
      const actor = await getActorFromSupabase(context.supabase, context.userId)
      requirePermission(actor, 'purchase.write')
      const organizationId = actor.organizationId

      // The legacy OCR job does not store an organization_id. Do not guess
      // an organization for a user with multiple active memberships.
      const { data: memberships, error: membershipsError } = await context.supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', context.userId)
        .eq('status', 'active')
        .limit(2)
      if (membershipsError) return { ok: false, error: 'تعذّر التحقق من المؤسسة' }
      if ((memberships ?? []).length !== 1) {
        return { ok: false, error: 'لا يمكن تحديد مؤسسة واحدة للفاتورة؛ تحتاج مطابقة المؤسسة يدويًا' }
      }

      const { data: job, error: jobError } = await context.supabase
        .from('catalog_import_jobs')
        .select('id, uploaded_by, status, dry_run')
        .eq('id', data.jobId)
        .eq('uploaded_by', context.userId)
        .maybeSingle()
      if (jobError || !job || job.status !== 'analyzed' || job.dry_run !== true) {
        return { ok: false, error: 'مهمة الفاتورة غير موجودة أو لم تكتمل مراجعتها' }
      }

      const [supplierCheck, warehouseCheck] = await Promise.all([
        supabaseAdmin.from('sup_suppliers').select('id')
          .eq('id', data.supplierId).eq('organization_id', organizationId).maybeSingle(),
        supabaseAdmin.from('wh_warehouses').select('id')
          .eq('id', data.warehouseId).eq('organization_id', organizationId).maybeSingle(),
      ])
      if (supplierCheck.error || !supplierCheck.data || warehouseCheck.error || !warehouseCheck.data) {
        return { ok: false, error: 'المورد أو المستودع لا يتبع المؤسسة المحددة' }
      }

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
      const verified = validateOcrPurchaseDraft(all)
      if (!verified.ok) {
        return {
          ok: false,
          error: 'بيانات OCR غير مكتملة؛ صحح الفاتورة قبل إنشاء الأمر: ' +
            verified.errors.slice(0, 4).map((e) => `صف ${e.rowIndex + 1}: ${e.reason}`).join('؛ '),
        }
      }

      const { lines, totalAmount } = verified
      const productIds = [...new Set(lines.map((l) => l.product_id))]
      const { data: products, error: productsError } = await supabaseAdmin
        .from('catalog_products')
        .select('id')
        .eq('organization_id', organizationId)
        .in('id', productIds)
      if (productsError || (products ?? []).length !== productIds.length) {
        return { ok: false, error: 'يوجد صنف خارج مؤسسة الفاتورة أو غير موجود في الكتالوج' }
      }

      // Stable per-job code prevents creating multiple draft POs on retries.
      // This is not a substitute for a fully transactional PO+lines RPC.
      const code = `PO-OCR-${data.jobId}`

      const { data: po, error: poErr } = await supabaseAdmin
        .from('purchase_orders')
        .insert({
          organization_id: organizationId,
          supplier_id: data.supplierId,
          warehouse_id: data.warehouseId,
          code,
          currency: data.currency,
          notes: data.notes ?? `مُنشأ من فاتورة ممسوحة ضوئيًا (job ${data.jobId})`,
          total_amount: totalAmount,
          status: 'draft',
          metadata: { source: 'invoice-ocr', source_job_id: data.jobId, review_state: 'needs_confirmation' },
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
        skipped: verified.skipped,
      }
    } catch (err) {
      console.error('[createDraftPoFromInvoice]', err)
      return { ok: false, error: err instanceof Error ? err.message : 'خطأ غير متوقع' }
    }
  })
