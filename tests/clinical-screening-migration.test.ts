import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static review of the clinical-screening migration. The Supabase CLI and a
 * live database are not available in this checkout, so the RLS and grant
 * surface is asserted from source — the same pattern used by
 * tests/security-definer-rpc-grants.test.ts.
 */
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261024090000_clinical_screening.sql'),
  'utf8',
).replace(/\r\n/g, '\n')

describe('hc_clinical_screenings migration', () => {
  it('enables row level security and revokes the default grant surface', () => {
    expect(migration).toContain('ALTER TABLE public.hc_clinical_screenings ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL ON public.hc_clinical_screenings FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('GRANT SELECT ON public.hc_clinical_screenings TO authenticated')
    expect(migration).toContain('GRANT ALL ON public.hc_clinical_screenings TO service_role')
    expect(migration).not.toMatch(/GRANT (UPDATE|DELETE|INSERT)[^;]*TO authenticated/i)
  })

  it('scopes reads to active organization members', () => {
    expect(migration).toContain('CREATE POLICY hc_clinical_screenings_org_read')
    expect(migration).toContain('m.organization_id = hc_clinical_screenings.organization_id')
    expect(migration).toContain("m.status = 'active'")
  })

  it('anchors every screening to a tenant, a patient and a clinical record', () => {
    expect(migration).toContain('organization_id uuid NOT NULL REFERENCES public.organizations(id)')
    expect(migration).toContain('patient_id uuid NOT NULL REFERENCES public.hc_patients(id)')
    expect(migration).toContain('prescription_id uuid NOT NULL REFERENCES public.hc_prescriptions(id)')
    expect(migration).toContain('dispense_id uuid REFERENCES public.hc_dispenses(id)')
    expect(migration).toContain("CHECK (flow IN ('dispense', 'prescription_approval'))")
  })

  it('records evidence and overrides with integrity constraints', () => {
    expect(migration).toContain('warnings jsonb NOT NULL')
    expect(migration).toContain('input_hash text NOT NULL')
    expect(migration).toContain("confidence IN ('verified', 'partial', 'unverified')")
    expect(migration).toContain("summary_source IN ('deterministic', 'ai')")
    expect(migration).toContain('length(override_reason) >= 10')
    expect(migration).toContain('hc_clinical_screenings_override')
  })

  it('makes screening idempotent per anchor and drug set', () => {
    expect(migration).toContain('hc_clinical_screenings_dsp_input_uq')
    expect(migration).toContain('hc_clinical_screenings_rx_input_uq')
    expect(migration).toContain('ON public.hc_clinical_screenings (dispense_id, input_hash)')
    expect(migration).toContain('WHERE dispense_id IS NULL')
  })

  it('is wrapped in a bounded transaction and is additive only', () => {
    expect(migration).toMatch(/^BEGIN;/m)
    expect(migration).toMatch(/^COMMIT;/m)
    expect(migration).toContain("SET LOCAL lock_timeout")
    expect(migration).not.toMatch(/\bDROP TABLE\b/i)
    expect(migration).not.toMatch(/\bALTER TABLE\s+public\.(?!hc_clinical_screenings)/i)
  })
})
