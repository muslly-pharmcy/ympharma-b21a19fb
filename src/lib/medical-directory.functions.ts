import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const sel = (s: string): string => s

export type DirectoryDoctor = {
  id: string
  slug: string
  full_name_ar: string
  full_name_en: string | null
  title: string | null
  photo_url: string | null
  years_experience: number | null
  consultation_fee_min: number | null
  consultation_fee_max: number | null
  currency: string
  telemedicine_ready: boolean
  emergency_available: boolean
  is_public: boolean
  verification_status: string
  phone_e164: string | null
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

export type DirectorySupplier = {
  id: string
  name: string
  legal_name: string | null
  code: string | null
  contact: Json
  metadata: Json
  status: string
}

export type SbdmaProduct = {
  id: string
  name_ar: string
  name_en: string | null
  manufacturer: string | null
  manufacturer_country: string | null
  agent_name: string | null
  sbdma_official_price: number | null
  requires_prescription: boolean
}

/**
 * Search doctors in the Aden medical directory.
 * Public verified doctors are always readable; owner rows via RLS.
 */
export const searchAdenDirectory = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { query: string; limit?: number } => {
    const v = (raw ?? {}) as { query?: string; limit?: number }
    const query = (v.query ?? '').trim().slice(0, 100)
    const limit = Math.min(Math.max(Number(v.limit ?? 20), 1), 50)
    return { query, limit }
  })
  .handler(async ({ data, context }): Promise<DirectoryDoctor[]> => {
    const supabase = context.supabase
    let q = supabase
      .from('hc_doctors')
      .select(
        sel(
          'id, slug, full_name_ar, full_name_en, title, photo_url, years_experience, consultation_fee_min, consultation_fee_max, currency, telemedicine_ready, emergency_available, is_public, verification_status, phone_e164',
        ),
      )
      .order('trust_score', { ascending: false })
      .limit(data.limit ?? 20)

    if (data.query.length > 0) {
      const like = `%${data.query.replace(/[%_]/g, '')}%`
      q = q.or(
        `full_name_ar.ilike.${like},full_name_en.ilike.${like},normalized_name_ar.ilike.${like}`,
      )
    }

    const { data: rows, error } = await q
    if (error) {
      console.error('[searchAdenDirectory]', error)
      return []
    }
    return (rows ?? []) as unknown as DirectoryDoctor[]
  })

/**
 * Search suppliers by name or represented company (stored in metadata).
 */
export const findSuppliersByCompany = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { query: string; limit?: number } => {
    const v = (raw ?? {}) as { query?: string; limit?: number }
    const query = (v.query ?? '').trim().slice(0, 100)
    const limit = Math.min(Math.max(Number(v.limit ?? 20), 1), 50)
    return { query, limit }
  })
  .handler(async ({ data, context }): Promise<DirectorySupplier[]> => {
    const supabase = context.supabase
    let q = supabase
      .from('sup_suppliers')
      .select(sel('id, name, legal_name, code, contact, metadata, status'))
      .eq('status', 'active')
      .order('name')
      .limit(data.limit ?? 20)

    if (data.query.length > 0) {
      const like = `%${data.query.replace(/[%_]/g, '')}%`
      q = q.or(`name.ilike.${like},legal_name.ilike.${like}`)
    }

    const { data: rows, error } = await q
    if (error) {
      console.error('[findSuppliersByCompany]', error)
      return []
    }
    return (rows ?? []) as unknown as DirectorySupplier[]
  })

/**
 * List products belonging to a specific SBDMA agent.
 */
export const listProductsByAgent = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { agent: string; limit?: number } => {
    const v = (raw ?? {}) as { agent?: string; limit?: number }
    const agent = (v.agent ?? '').trim().slice(0, 100)
    if (!agent) throw new Error('agent required')
    const limit = Math.min(Math.max(Number(v.limit ?? 50), 1), 200)
    return { agent, limit }
  })
  .handler(async ({ data, context }): Promise<SbdmaProduct[]> => {
    const supabase = context.supabase
    const { data: rows, error } = await supabase
      .from('catalog_products')
      .select(
        sel(
          'id, name_ar, name_en, manufacturer, manufacturer_country, agent_name, sbdma_official_price, requires_prescription',
        ),
      )
      .eq('agent_name', data.agent)
      .order('name_ar')
      .limit(data.limit ?? 50)

    if (error) {
      console.error('[listProductsByAgent]', error)
      return []
    }
    return (rows ?? []) as unknown as SbdmaProduct[]
  })
