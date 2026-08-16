import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Staff-only: register an uploaded product image (client already put the file
// under `product-images/{productId}/...` using the browser Supabase client).
export const registerProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        storagePath: z.string().min(4),
        kind: z.enum(['primary', 'gallery', 'thumbnail']).default('gallery'),
        altText: z.string().max(200).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    // Ensure the product exists and the caller belongs to its org.
    const { data: product } = await context.supabase
      .from('catalog_products')
      .select('id, organization_id')
      .eq('id', data.productId)
      .maybeSingle()
    if (!product) throw new Error('المنتج غير موجود')

    const insertRow = {
      product_id: data.productId,
      storage_bucket: 'product-images',
      storage_path: data.storagePath,
      kind: data.kind,
      status: 'approved',
      uploaded_by: context.userId,
      metadata: data.altText ? { alt_text: data.altText } : {},
    }
    const { data: inserted, error } = await context.supabase
      .from('catalog_product_media')
      .insert(insertRow as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { ok: true, id: (inserted as { id: string }).id }
  })

export const deleteProductImage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ mediaId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: media } = await context.supabase
      .from('catalog_product_media')
      .select('id, storage_bucket, storage_path')
      .eq('id', data.mediaId)
      .maybeSingle()
    if (!media) throw new Error('الصورة غير موجودة')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.storage
      .from((media as { storage_bucket: string }).storage_bucket)
      .remove([(media as { storage_path: string }).storage_path])

    const { error } = await context.supabase
      .from('catalog_product_media')
      .delete()
      .eq('id', data.mediaId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
