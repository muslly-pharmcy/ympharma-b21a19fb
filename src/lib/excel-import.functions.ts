import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { toPendingReviewProduct } from './excel-review'

/**
 * Excel upload is an ingestion step for CATALOG REVIEW ONLY.
 * Stock, official prices, clinical approval and public exposure are never
 * modified by this endpoint. The review/approval workflow owns publication.
 */
const RowSchema = z.object({
  store_code: z.string().trim().min(1).max(120),
  name_ar: z.string().trim().min(1).max(500),
  name_en: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  dosage_form: z.string().optional().nullable(),
  price: z.number().finite().nonnegative().optional().nullable(),
  qty: z.number().finite().nonnegative().optional().nullable(),
  category_slug: z.string().optional().nullable(),
})
export type ExcelProductRow = z.infer<typeof RowSchema>

export const bulkImportExcel = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ rows: z.array(RowSchema).min(1).max(500) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    const { data: cats, error: categoriesError } = await supabaseAdmin
      .from('catalog_categories')
      .select('id, slug')
      .is('organization_id', null)
    if (categoriesError) throw new Error('تعذر قراءة التصنيفات؛ لم يبدأ الاستيراد.')
    const categories = new Map<string, string>(
      (cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]),
    )

    let inserted = 0
    let skipped = 0
    let deferredStockRows = 0
    const errors: Array<{ store_code: string; error: string }> = []
    const seenCodes = new Set<string>()

    // Each row is an independent, nonpublic pending-review insert.
    // Uniqueness constraints prevent duplicates under concurrent retries.
    // Failures are reported per-row; no "all-or-nothing" guarantee is claimed.
    for (const row of data.rows) {
      const code = row.store_code.trim()
      if (seenCodes.has(code)) {
        skipped++
        errors.push({ store_code: code, error: 'كود مكرر داخل الملف.' })
        continue
      }
      seenCodes.add(code)
      try {
        const { data: existing, error: lookupError } = await supabaseAdmin
          .from('catalog_products')
          .select('id')
          .eq('organization_id', actor.organizationId)
          .eq('store_code', code)
          .maybeSingle()
        if (lookupError) throw new Error('تعذر التحقق من تكرار الصنف.')
        if (existing?.id) {
          skipped++
          errors.push({ store_code: code, error: 'الصنف موجود بهذه المؤسسة؛ التعديل يتطلب مراجعة منفصلة.' })
          continue
        }
        const categoryId = row.category_slug
          ? categories.get(row.category_slug) ?? null
          : null
        const payload = toPendingReviewProduct(
          row, actor.organizationId, actor.userId, categoryId,
        )
        const { error: insertError } = await supabaseAdmin
          .from('catalog_products')
          .insert(payload)
        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('الكود مستخدم بالفعل؛ لن يتم تعديل منتج آخر.')
          }
          throw new Error('تعذر حفظ سجل المراجعة؛ راجع الكود والبيانات.')
        }
        inserted++
        if ((row.qty ?? 0) > 0) deferredStockRows++
      } catch (err) {
        skipped++
        errors.push({
          store_code: code,
          error: err instanceof Error ? err.message : 'تعذر إضافة الصنف للمراجعة.',
        })
      }
    }
    return {
      inserted,
      updated: 0,
      skipped,
      total: data.rows.length,
      errors: errors.slice(0, 200),
      staged: true as const,
      deferredStockRows,
    }
  })

// Read-only status of the image-generation queue (admin dashboard).
export const getImageQueueStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    if (!isAdmin) throw new Error('Admin only')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('image_generation_queue')
      .select('status')
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as Array<{ status: string }>) {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    }
    return { total: (data ?? []).length, by_status: counts }
  })
