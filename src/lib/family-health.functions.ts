import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

export interface FamilyProfile {
  id: string
  display_name: string
  relation: string
  birth_date: string | null
  weight_kg: number | null
  blood_type: string | null
  allergies: string[]
  chronic_conditions: string[]
  current_medicines: string[]
  notes: string | null
  is_default: boolean
}

const COLUMNS =
  'id, display_name, relation, birth_date, weight_kg, blood_type, allergies, chronic_conditions, current_medicines, notes, is_default'

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  relation: z.string().trim().min(1).max(40),
  birthDate: z.string().trim().max(20).optional().nullable(),
  weightKg: z.number().positive().max(400).optional().nullable(),
  bloodType: z.string().trim().max(6).optional().nullable(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  chronicConditions: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  currentMedicines: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  notes: z.string().trim().max(600).optional().nullable(),
  isDefault: z.boolean().default(false),
})

export const listFamilyProfiles = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FamilyProfile[]> => {
    const { data, error } = await context.supabase
      .from('family_health_profiles')
      .select(COLUMNS)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as FamilyProfile[]
  })

export const saveFamilyProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => upsertInput.parse(raw))
  .handler(async ({ data, context }): Promise<FamilyProfile> => {
    const { supabase, userId } = context
    const row = {
      user_id: userId,
      display_name: data.displayName,
      relation: data.relation,
      birth_date: data.birthDate || null,
      weight_kg: data.weightKg ?? null,
      blood_type: data.bloodType || null,
      allergies: data.allergies,
      chronic_conditions: data.chronicConditions,
      current_medicines: data.currentMedicines,
      notes: data.notes || null,
      is_default: data.isDefault,
    }

    if (data.isDefault) {
      await supabase
        .from('family_health_profiles')
        .update({ is_default: false })
        .eq('user_id', userId)
    }

    const query = data.id
      ? supabase.from('family_health_profiles').update(row).eq('id', data.id).select(COLUMNS).single()
      : supabase.from('family_health_profiles').insert(row).select(COLUMNS).single()

    const { data: saved, error } = await query
    if (error) throw new Error(error.message)
    return saved as unknown as FamilyProfile
  })

export const deleteFamilyProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('family_health_profiles')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const watchProductStock = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        phone: z.string().trim().min(6).max(30),
        fullName: z.string().trim().max(80).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('stock_watch_requests').insert({
      product_id: data.productId,
      user_id: context.userId,
      phone: data.phone,
      full_name: data.fullName ?? null,
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })
