// Public-facing store reads from the `store_products` view (catalog + stock).
// Authenticated + org-scoped; uses the authenticated Supabase client so RLS on
// the underlying catalog_products applies.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export interface StoreProductRow {
  id: string | null
  store_code: string | null
  barcode: string | null
  name: string | null
  name_ar: string | null
  name_en: string | null
  brand: string | null
  supplier_name_text: string | null
  pack_unit: string | null
  strength: string | null
  dosage_form: string | null
  price: number | null
  stock_balance: number | null
  image_url: string | null
  requires_prescription: boolean | null
}

const searchInput = z.object({
  query: z.string().trim().max(120).optional(),
  supplier: z.string().trim().max(120).optional(),
  sort: z
    .enum(['name_asc', 'name_desc', 'price_asc', 'price_desc', 'stock_desc'])
    .default('name_asc'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(60).default(20),
})

export const searchStoreProducts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => searchInput.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const from = (data.page - 1) * data.limit
    const to = from + data.limit - 1

    let q = supabase
      .from('store_products')
      .select(
        'id, store_code, barcode, name, name_ar, name_en, brand, supplier_name_text, pack_unit, strength, dosage_form, price, stock_balance, image_url, requires_prescription',
        { count: 'exact' },
      )

    if (data.query) {
      const term = `%${data.query.replace(/[,()*"']/g, ' ')}%`
      q = q.or(
        `name_ar.ilike.${term},name_en.ilike.${term},brand.ilike.${term},store_code.ilike.${term},barcode.ilike.${term}`,
      )
    }
    if (data.supplier) q = q.ilike('supplier_name_text', `%${data.supplier}%`)

    switch (data.sort) {
      case 'name_desc': q = q.order('name_ar', { ascending: false }); break
      case 'price_asc': q = q.order('price', { ascending: true, nullsFirst: false }); break
      case 'price_desc': q = q.order('price', { ascending: false, nullsFirst: false }); break
      case 'stock_desc': q = q.order('stock_balance', { ascending: false, nullsFirst: false }); break
      default: q = q.order('name_ar', { ascending: true })
    }

    q = q.range(from, to)
    const { data: rows, count, error } = await q
    if (error) throw new Error(error.message)
    const items = (rows ?? []) as unknown as StoreProductRow[]
    const total = count ?? 0
    return {
      items,
      total,
      page: data.page,
      limit: data.limit,
      hasMore: from + items.length < total,
      nextPage: from + items.length < total ? data.page + 1 : null,
    }
  })

export const getStoreProductByCode = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ code: z.string().min(1).max(80) }).parse(raw))
  .handler(async ({ data, context }): Promise<StoreProductRow | null> => {
    const { data: row, error } = await context.supabase
      .from('store_products')
      .select(
        'id, store_code, barcode, name, name_ar, name_en, brand, supplier_name_text, pack_unit, strength, dosage_form, price, stock_balance, image_url, requires_prescription',
      )
      .eq('store_code', data.code)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    return (row ?? null) as unknown as StoreProductRow | null
  })

export const getUniqueSuppliers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from('store_products')
      .select('supplier_name_text')
      .not('supplier_name_text', 'is', null)
      .limit(2000)
    if (error) throw new Error(error.message)
    const set = new Set<string>()
    for (const r of (data ?? []) as Array<{ supplier_name_text: string | null }>) {
      const v = (r.supplier_name_text ?? '').trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  })
