-- Clinical screening evidence for prescription approval and dispensing.
-- Additive only: one new table, no changes to existing clinical tables.
--
-- Writes are service-role only (all screening runs happen inside TanStack
-- server functions); authenticated users can read rows for their organization.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.hc_clinical_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  dispense_id uuid REFERENCES public.hc_dispenses(id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL REFERENCES public.hc_prescriptions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE CASCADE,
  flow text NOT NULL CHECK (flow IN ('dispense', 'prescription_approval')),
  provider_id text NOT NULL,
  provider_name text NOT NULL,
  confidence text NOT NULL DEFAULT 'unverified'
    CHECK (confidence IN ('verified', 'partial', 'unverified')),
  highest_severity text
    CHECK (highest_severity IN ('info', 'low', 'moderate', 'high', 'critical')),
  warning_count integer NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_hash text NOT NULL,
  summary_ar text NOT NULL DEFAULT '',
  summary_source text NOT NULL DEFAULT 'deterministic'
    CHECK (summary_source IN ('deterministic', 'ai')),
  override_reason text,
  overridden_by uuid,
  overridden_at timestamptz,
  correlation_id text,
  ran_by uuid,
  ran_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hc_clinical_screenings_anchor CHECK (
    (flow = 'dispense' AND dispense_id IS NOT NULL)
    OR (flow = 'prescription_approval' AND dispense_id IS NULL)
  ),
  CONSTRAINT hc_clinical_screenings_override CHECK (
    (overridden_at IS NULL AND overridden_by IS NULL AND override_reason IS NULL)
    OR (overridden_at IS NOT NULL AND overridden_by IS NOT NULL AND length(override_reason) >= 10)
  )
);

-- One screening row per (anchor, exact drug set). Re-running the same inputs is
-- idempotent; changed inputs create a new evidence row.
CREATE UNIQUE INDEX IF NOT EXISTS hc_clinical_screenings_dsp_input_uq
  ON public.hc_clinical_screenings (dispense_id, input_hash)
  WHERE dispense_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hc_clinical_screenings_rx_input_uq
  ON public.hc_clinical_screenings (prescription_id, input_hash)
  WHERE dispense_id IS NULL;
CREATE INDEX IF NOT EXISTS hc_clinical_screenings_dsp_time_idx
  ON public.hc_clinical_screenings (dispense_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS hc_clinical_screenings_org_risk_idx
  ON public.hc_clinical_screenings (organization_id, highest_severity)
  WHERE highest_severity IN ('high', 'critical');

ALTER TABLE public.hc_clinical_screenings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hc_clinical_screenings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.hc_clinical_screenings TO authenticated;
GRANT ALL ON public.hc_clinical_screenings TO service_role;

DROP POLICY IF EXISTS hc_clinical_screenings_org_read ON public.hc_clinical_screenings;
CREATE POLICY hc_clinical_screenings_org_read
  ON public.hc_clinical_screenings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = hc_clinical_screenings.organization_id
        AND m.status = 'active'
    )
  );

DROP TRIGGER IF EXISTS trg_hc_clinical_screenings_updated ON public.hc_clinical_screenings;
CREATE TRIGGER trg_hc_clinical_screenings_updated
  BEFORE UPDATE ON public.hc_clinical_screenings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
