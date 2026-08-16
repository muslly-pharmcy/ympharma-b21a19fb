import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const uuid = z.string().uuid()

// ---------- Update product price (SBDMA official price) ----------
export const updateProductPrice = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z.object({ productId: uuid, price: z.number().nonnegative() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('catalog_products')
      .select('organization_id, sbdma_official_price')
      .eq('id', data.productId)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (existing.organization_id !== actor.organizationId) {
      throw new Error('Forbidden: cross-org update')
    }

    const { error } = await supabaseAdmin
      .from('catalog_products')
      .update({ sbdma_official_price: data.price })
      .eq('id', data.productId)
    if (error) throw new Error(error.message)

    await audit(actor, {
      action: 'catalog.product.price',
      resourceType: 'catalog_product',
      resourceId: data.productId,
      payload: { before: existing.sbdma_official_price, after: data.price },
    })
    return { ok: true }
  })

// ---------- Update product image URL (path in product-images bucket) ----------
export const updateProductImage = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z
      .object({
        productId: uuid,
        storagePath: z.string().min(1).max(500),
        bucket: z.string().default('product-images'),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('catalog_products')
      .select('organization_id')
      .eq('id', data.productId)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (existing.organization_id !== actor.organizationId) {
      throw new Error('Forbidden: cross-org update')
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.storagePath, 60 * 60 * 24 * 365)

    const image_url = signed?.signedUrl ?? data.storagePath

    const { error } = await supabaseAdmin
      .from('catalog_products')
      .update({ image_url })
      .eq('id', data.productId)
    if (error) throw new Error(error.message)

    // Register in media table too (best-effort).
    try {
      await (supabaseAdmin.from('catalog_product_media') as unknown as {
        insert: (row: unknown) => Promise<unknown>
      }).insert({
        product_id: data.productId,
        organization_id: existing.organization_id,
        storage_bucket: data.bucket,
        storage_path: data.storagePath,
        kind: 'image',
        status: 'approved',
        sort_order: 0,
      })
    } catch { /* ignore duplicate/media noise */ }

    await audit(actor, {
      action: 'catalog.product.image',
      resourceType: 'catalog_product',
      resourceId: data.productId,
      payload: { storagePath: data.storagePath, bucket: data.bucket },
    })
    return { ok: true, image_url }
  })

// ---------- Set absolute stock balance (creates single adjustment batch) ----------
export const setProductStockBalance = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z
      .object({
        productId: uuid,
        newBalance: z.number().int().min(0),
        reason: z.string().min(2).max(200).default('admin manual set'),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    // Ensure product belongs to actor org
    const { data: p, error: pErr } = await supabaseAdmin
      .from('catalog_products')
      .select('organization_id')
      .eq('id', data.productId)
      .single()
    if (pErr) throw new Error(pErr.message)
    if (p.organization_id !== actor.organizationId) {
      throw new Error('Forbidden: cross-org update')
    }

    // Get / create default warehouse for this org
    const { data: wh } = await supabaseAdmin
      .from('wh_warehouses')
      .select('id')
      .eq('organization_id', actor.organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let warehouseId = wh?.id as string | undefined
    if (!warehouseId) {
      const { data: newWh, error: whErr } = await supabaseAdmin
        .from('wh_warehouses')
        .insert({
          organization_id: actor.organizationId,
          code: 'MAIN',
          name: 'المخزن الرئيسي',
          kind: 'central',
          is_active: true,
        })
        .select('id')
        .single()
      if (whErr) throw new Error(whErr.message)
      warehouseId = newWh.id
    }

    // Sum existing on-hand for this product in org
    const { data: existingBatches } = await supabaseAdmin
      .from('inv_stock_batches')
      .select('id, qty_on_hand')
      .eq('organization_id', actor.organizationId)
      .eq('product_id', data.productId)

    const currentTotal = ((existingBatches ?? []) as Array<{ qty_on_hand: number }>).reduce(
      (s, r) => s + Number(r.qty_on_hand ?? 0),
      0,
    )
    const delta = data.newBalance - currentTotal

    if (delta === 0) return { ok: true, delta: 0, newBalance: data.newBalance }

    // Add a single adjustment batch (positive) or reduce first batches (negative)
    if (delta > 0) {
      const { error } = await supabaseAdmin.from('inv_stock_batches').insert({
        organization_id: actor.organizationId,
        warehouse_id: warehouseId,
        product_id: data.productId,
        qty_on_hand: delta,
        qty_reserved: 0,
      })
      if (error) throw new Error(error.message)
    } else {
      let toRemove = -delta
      for (const b of (existingBatches ?? []) as Array<{ id: string; qty_on_hand: number }>) {
        if (toRemove <= 0) break
        const take = Math.min(Number(b.qty_on_hand ?? 0), toRemove)
        if (take <= 0) continue
        const newQty = Number(b.qty_on_hand) - take
        const { error } = await supabaseAdmin
          .from('inv_stock_batches')
          .update({ qty_on_hand: newQty })
          .eq('id', b.id)
        if (error) throw new Error(error.message)
        toRemove -= take
      }
    }

    await audit(actor, {
      action: 'catalog.product.stock_set',
      resourceType: 'catalog_product',
      resourceId: data.productId,
      payload: { delta, newBalance: data.newBalance, reason: data.reason },
    })

    return { ok: true, delta, newBalance: data.newBalance }
  })

// ---------- List for admin inventory table ----------
export const listStoreProductsAdmin = createServerFn({ method: 'GET' })
  .validator((raw: unknown) =>
    z
      .object({
        search: z.string().max(120).optional(),
        supplier: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'catalog.write')

    let q = supabaseAdmin
      .from('store_products')
      .select('*', { count: 'exact' })
      .eq('organization_id', actor.organizationId)
      .order('updated_at', { ascending: false })
      .range(data.offset, data.offset + data.limit - 1)

    if (data.search) {
      const term = `%${data.search.replace(/[,()*"']/g, ' ')}%`
      q = q.or(
        `name_ar.ilike.${term},name_en.ilike.${term},store_code.ilike.${term},barcode.ilike.${term}`,
      )
    }
    if (data.supplier) {
      q = q.ilike('supplier_name_text', `%${data.supplier}%`)
    }

    const { data: items, error, count } = await q
    if (error) throw new Error(error.message)
    return { items: items ?? [], total: count ?? 0 }
  })
