
-- Phase 7 — extend prescription_extractions with reviewer edits & staff access
ALTER TABLE public.prescription_extractions
  ADD COLUMN IF NOT EXISTS reviewer_edits jsonb,
  ADD COLUMN IF NOT EXISTS reviewer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_approved_by uuid;

-- Allow staff (with prescriptions permission) to read/update extractions for review
DROP POLICY IF EXISTS "rx_extr staff read" ON public.prescription_extractions;
CREATE POLICY "rx_extr staff read" ON public.prescription_extractions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_permission(auth.uid(), 'prescriptions'::text)
  );

DROP POLICY IF EXISTS "rx_extr staff update" ON public.prescription_extractions;
CREATE POLICY "rx_extr staff update" ON public.prescription_extractions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_permission(auth.uid(), 'prescriptions'::text)
  );
