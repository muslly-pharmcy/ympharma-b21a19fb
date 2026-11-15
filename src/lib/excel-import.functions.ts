import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Bulk upsert products from a client-parsed Excel sheet.
// Admin-only. Client parses the .xlsx (with the `xlsx` package) and posts
// normalized rows here — we upsert into catalog_products (by store_code),
// Stock receipt requires a separate reviewed batch/expiry workflow.
import { excelProductRow } from '@/lib/excel-import-schema'
export type { ExcelProductRow } from '@/lib/excel-import-schema'

export const bulkImportExcel = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ rows: z.array(excelProductRow).min(1).max(5000) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    // Admin check
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (roleError || !isAdmin) throw new Error('Admin only')

    const { getActorFromSupabase, requirePermission } = await import('@/lib/session.server')
    const actor = await getActorFromSupabase(supabase, userId)
    requirePermission(actor, 'catalog.write')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Preload category slug → id map (global categories)
    const { data: cats, error: categoriesError } = await supabaseAdmin
      .from('catalog_categories')
      .select('id, slug')
      .is('organization_id', null)
    if (categoriesError) throw new Error(categoriesError.message)
    const catMap = new Map<string, string>((cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]))

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: Array<{ store_code: string; error: string }> = []

    for (const row of data.rows) {
      try {
        const category_id = row.category_slug ? catMap.get(row.category_slug) ?? null : null
        // Check existing by store_code
        const { data: existing, error: lookupError } = await supabaseAdmin
          .from('catalog_products')
          .select('id')
          .eq('store_code', row.store_code)
          .eq('organization_id', actor.organizationId)
          .maybeSingle()
        if (lookupError) throw lookupError

        const payload = {
          store_code: row.store_code,
          name_ar: row.name_ar,
          name_en: row.name_en ?? null,
          brand: row.brand ?? null,
          manufacturer: row.manufacturer ?? null,
          barcode: row.barcode ?? null,
          strength: row.strength ?? null,
          dosage_form: row.dosage_form ?? null,
          sbdma_official_price: row.price ?? null,
          category_id,
        }

        if (existing?.id) {
          const { data: changed, error } = await supabaseAdmin
            .from('catalog_products')
            .update(payload)
            .eq('id', existing.id)
            .eq('organization_id', actor.organizationId)
            .select('id')
            .maybeSingle()
          if (error) throw error
          if (!changed) throw new Error('Product changed during import; retry after review')
          updated++
        } else {
          const { error } = await supabaseAdmin
            .from('catalog_products')
            .insert({ ...payload, organization_id: actor.organizationId, status: 'draft', is_public: false, requires_prescription: true })
            .select('id')
            .single()
          if (error) throw error
          inserted++
        }

      } catch (e) {
        skipped++
        errors.push({ store_code: row.store_code, error: (e as Error).message })
      }
    }

    return { inserted, updated, skipped, total: data.rows.length, errors: errors.slice(0, 50) }
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
