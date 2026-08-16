import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Public, read-only helpers backing the clinical tools hub (`/tools/*`).
// All clinical output is grounded in the project's curated tables through the
// existing local knowledge provider — nothing here invents clinical rules.

const PUBLIC_COLUMNS = [
  'id',
  'name_ar',
  'name_en',
  'generic_name',
  'brand',
  'dosage_form',
  'strength',
  'sbdma_official_price',
  'image_url',
].join(',')

export interface PublicProductCard {
  id: string
  name_ar: string | null
  name_en: string | null
  generic_name: string | null
  brand: string | null
  dosage_form: string | null
  strength: string | null
  sbdma_official_price: number | null
  image_url: string | null
}

export interface IngredientWarning {
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical'
  message: string
  code: string
}

const interactionsInput = z.object({
  ingredients: z.array(z.string()).max(12),
})

/** Check curated drug-drug interactions between free-text active ingredients. */
export const checkIngredientInteractions = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => interactionsInput.parse(raw ?? {}))
  .handler(async ({ data }): Promise<{ warnings: IngredientWarning[]; checked: number }> => {
    const names = data.ingredients.map((n) => n.trim()).filter(Boolean).slice(0, 12)
    if (names.length < 2) return { warnings: [], checked: names.length }

    try {
      const { localDbProvider } = await import('@/lib/clinical/local-db-provider.server')
      const warnings = await localDbProvider.interaction.check({
        patient: {
          patientId: 'public-tool',
          knownAllergies: [],
          activeConditions: [],
        },
        drugs: names.map((name, i) => ({
          itemId: `tool-${i}`,
          productId: null,
          code: null,
          name,
        })),
      })
      return {
        warnings: warnings.map((w) => ({
          severity: w.severity,
          message: w.message,
          code: w.code,
        })),
        checked: names.length,
      }
    } catch (err) {
      console.error('[checkIngredientInteractions]', err)
      return { warnings: [], checked: names.length }
    }
  })

const relatedInput = z.object({
  productId: z.string().uuid().optional(),
  term: z.string().optional(),
  limit: z.number().int().optional(),
})

function esc(v: string): string {
  return v.replace(/[,()*"'%]/g, ' ').trim()
}

/** Public products sharing an active ingredient / generic name. */
export const listRelatedProducts = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => relatedInput.parse(raw ?? {}))
  .handler(async ({ data }): Promise<{ items: PublicProductCard[] }> => {
    const term = esc(data.term ?? '')
    if (term.length < 3) return { items: [] }
    const limit = Math.min(Math.max(data.limit ?? 12, 1), 24)

    try {
      const { getPublicSupabase } = await import('./supabase-public.server')
      const supabase = getPublicSupabase()
      const like = `%${term}%`
      let q = supabase
        .from('catalog_products')
        .select(PUBLIC_COLUMNS)
        .eq('is_public', true)
        .eq('status', 'approved')
        .or(`generic_name.ilike.${like},active_ingredients.ilike.${like},name_ar.ilike.${like}`)
        .limit(limit + 1)

      if (data.productId) q = q.neq('id', data.productId)

      const { data: rows, error } = await q
      if (error) {
        console.error('[listRelatedProducts]', error)
        return { items: [] }
      }
      return { items: ((rows ?? []) as unknown as PublicProductCard[]).slice(0, limit) }
    } catch (err) {
      console.error('[listRelatedProducts]', err)
      return { items: [] }
    }
  })

const suggestInput = z.object({ query: z.string() })

/** Lightweight ingredient auto-suggest for the interaction visualizer. */
export const suggestIngredients = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => suggestInput.parse(raw ?? {}))
  .handler(async ({ data }): Promise<{ items: string[] }> => {
    const term = esc(data.query)
    if (term.length < 2) return { items: [] }
    try {
      const { getPublicSupabase } = await import('./supabase-public.server')
      const supabase = getPublicSupabase()
      const like = `%${term}%`
      const { data: rows, error } = await supabase
        .from('catalog_products')
        .select('generic_name')
        .eq('is_public', true)
        .eq('status', 'approved')
        .ilike('generic_name', like)
        .limit(40)
      if (error) return { items: [] }
      const set = new Set<string>()
      for (const r of (rows ?? []) as Array<{ generic_name: string | null }>) {
        if (r.generic_name) set.add(r.generic_name.trim())
      }
      return { items: Array.from(set).slice(0, 8) }
    } catch {
      return { items: [] }
    }
  })
