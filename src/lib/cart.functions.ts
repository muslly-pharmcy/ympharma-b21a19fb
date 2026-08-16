import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const addInput = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
})

const idInput = z.object({ itemId: z.string().uuid() })

export interface CartItemRow {
  id: string
  product_id: string
  quantity: number
  added_at: string
  updated_at: string
  product: {
    id: string
    name_ar: string
    brand: string | null
    strength: string | null
    barcode: string | null
    requires_prescription: boolean
    sbdma_official_price: number | null
  } | null
}

export const listCart = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CartItemRow[]> => {
    const { supabase } = context
    const { data, error } = await supabase
      .from('cart_items')
      .select(
        'id, product_id, quantity, added_at, updated_at, product:catalog_products(id, name_ar, brand, strength, barcode, requires_prescription, sbdma_official_price)',
      )
      .order('added_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as CartItemRow[]
  })

export const addToCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => addInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    // Verify product exists and is OTC before insert (better error than the DB trigger).
    const { data: product, error: pErr } = await supabase
      .from('catalog_products')
      .select('id, name_ar, requires_prescription, status')
      .eq('id', data.productId)
      .maybeSingle()
    if (pErr) throw new Error(pErr.message)
    if (!product) throw new Error('المنتج غير موجود')
    if ((product as { status: string }).status !== 'active') {
      throw new Error('هذا المنتج غير متاح حاليًا')
    }
    if ((product as { requires_prescription: boolean }).requires_prescription) {
      throw new Error('هذا المنتج يتطلب وصفة طبية — الرجاء استشارة الصيدلي')
    }

    // Upsert (increment quantity if row exists).
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', data.productId)
      .maybeSingle()

    if (existing) {
      const nextQty = Math.min(99, (existing as { quantity: number }).quantity + data.quantity)
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: nextQty })
        .eq('id', (existing as { id: string }).id)
      if (error) throw new Error(error.message)
      return { ok: true, itemId: (existing as { id: string }).id, quantity: nextQty }
    }

    const { data: inserted, error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, product_id: data.productId, quantity: data.quantity })
      .select('id, quantity')
      .single()
    if (error) throw new Error(error.message)
    return {
      ok: true,
      itemId: (inserted as { id: string }).id,
      quantity: (inserted as { quantity: number }).quantity,
    }
  })

export const removeFromCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => idInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('cart_items')
      .delete()
      .eq('id', data.itemId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const setCartQuantity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('cart_items')
      .update({ quantity: data.quantity })
      .eq('id', data.itemId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
