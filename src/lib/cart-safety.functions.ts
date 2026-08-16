import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { screenSafety, type InteractionHit } from '@/lib/medical/interaction-engine'

export interface CartSafetyReport {
  profileName: string | null
  hits: InteractionHit[]
  checkedMedicines: string[]
}

/**
 * Cross-check everything in the cart against the selected family health
 * profile (allergies, chronic conditions, current medicines) using the offline
 * clinical safety matrix — no external network cost.
 */
export const screenCartSafety = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ profileId: z.string().uuid().optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<CartSafetyReport> => {
    const { supabase } = context

    const [{ data: cart }, { data: profiles }] = await Promise.all([
      supabase
        .from('cart_items')
        .select('quantity, product:catalog_products(name_ar, name_en, generic_name)'),
      supabase
        .from('family_health_profiles')
        .select('id, display_name, allergies, chronic_conditions, current_medicines, is_default')
        .order('is_default', { ascending: false }),
    ])

    const rows = (cart ?? []) as unknown as Array<{
      product: { name_ar: string | null; name_en: string | null; generic_name: string | null } | null
    }>

    const cartNames = rows
      .flatMap((r) => [r.product?.generic_name, r.product?.name_en, r.product?.name_ar])
      .filter((v): v is string => Boolean(v))

    const list = (profiles ?? []) as unknown as Array<{
      id: string
      display_name: string
      allergies: string[]
      chronic_conditions: string[]
      current_medicines: string[]
    }>
    const profile = data.profileId ? list.find((p) => p.id === data.profileId) : list[0]

    const hits = screenSafety({
      medicines: [...cartNames, ...(profile?.current_medicines ?? [])],
      conditions: profile?.chronic_conditions ?? [],
      allergies: profile?.allergies ?? [],
    })

    return {
      profileName: profile?.display_name ?? null,
      hits,
      checkedMedicines: Array.from(new Set(cartNames)),
    }
  })
