import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { buildFullName, validateThreePartName } from '@/lib/auth/patient-name'

/**
 * Canonical patient identity resolution.
 *
 * Supabase Auth user -> public.profiles -> public.hc_patients (one row).
 * Identity is resolved by auth.uid() only. Names are NEVER matched against
 * existing patient records, and existing verified data is never overwritten.
 */

export interface PatientIdentityInput {
  firstName?: string
  fatherName?: string
  familyName?: string
}

export interface PatientIdentityResult {
  ok: boolean
  patientId: string | null
  created: boolean
  fullName: string | null
  error?: 'invalid_name' | 'failed'
}

export const ensurePatientIdentity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PatientIdentityInput) => input ?? {})
  .handler(async ({ data, context }): Promise<PatientIdentityResult> => {
    const { supabase, userId } = context

    const hasNameInput = Boolean(data.firstName || data.fatherName || data.familyName)
    const parsed = validateThreePartName(data)
    if (hasNameInput && !parsed.ok) {
      return { ok: false, patientId: null, created: false, fullName: null, error: 'invalid_name' }
    }

    // 1) Profile (created by the auth trigger) — fill the name only when empty.
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, father_name, family_name, phone, email')
      .eq('id', userId)
      .maybeSingle()

    const profileFullName = buildFullName({
      firstName: profile?.first_name ?? '',
      fatherName: profile?.father_name ?? '',
      familyName: profile?.family_name ?? '',
    })

    if (hasNameInput && parsed.ok && !profileFullName) {
      await supabase
        .from('profiles')
        .update({
          first_name: parsed.value.firstName,
          father_name: parsed.value.fatherName,
          family_name: parsed.value.familyName,
          display_name: parsed.fullName,
        })
        .eq('id', userId)
    }

    const fullName = profileFullName || parsed.fullName || profile?.display_name || null

    // 2) Patient row — find by user_id, never by name.
    const { data: existing } = await supabase
      .from('hc_patients')
      .select('id, full_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { ok: true, patientId: existing.id, created: false, fullName: existing.full_name }
    }

    if (!fullName) {
      return { ok: false, patientId: null, created: false, fullName: null, error: 'invalid_name' }
    }

    const { data: inserted, error } = await supabase
      .from('hc_patients')
      .insert({
        user_id: userId,
        full_name: fullName,
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
      })
      .select('id, full_name')
      .single()

    if (error || !inserted) {
      // A concurrent request may have created it first — re-read before failing.
      const { data: retry } = await supabase
        .from('hc_patients')
        .select('id, full_name')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      if (retry) {
        return { ok: true, patientId: retry.id, created: false, fullName: retry.full_name }
      }
      return { ok: false, patientId: null, created: false, fullName, error: 'failed' }
    }

    return { ok: true, patientId: inserted.id, created: true, fullName: inserted.full_name }
  })
