
DROP VIEW IF EXISTS public.product_classifications_public CASCADE;

DROP POLICY IF EXISTS "anon read safe classification columns" ON public.product_classifications;

CREATE VIEW public.product_classifications_public
WITH (security_invoker = true) AS
SELECT
  id,
  product_legacy_id,
  generic_name,
  active_ingredient,
  therapeutic_category,
  pharmacological_class,
  conditions,
  is_chronic,
  requires_prescription,
  related_legacy_ids,
  complementary_legacy_ids,
  status,
  created_at,
  updated_at
FROM public.product_classifications
WHERE status = 'approved'::classification_status;

GRANT SELECT ON public.product_classifications_public TO anon, authenticated;
REVOKE SELECT ON public.product_classifications FROM anon;

ALTER TABLE public.agent_approval_requests
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);

UPDATE public.agent_approval_requests
SET submitted_by = NULLIF(payload->>'submittedBy','')::uuid
WHERE submitted_by IS NULL
  AND payload ? 'submittedBy'
  AND (payload->>'submittedBy') ~* '^[0-9a-f-]{36}$';

CREATE INDEX IF NOT EXISTS idx_agent_approval_submitted_by
  ON public.agent_approval_requests(submitted_by);

CREATE OR REPLACE FUNCTION public.set_agent_approval_submitted_by()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.submitted_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_agent_approval_set_submitted_by ON public.agent_approval_requests;
CREATE TRIGGER trg_agent_approval_set_submitted_by
  BEFORE INSERT ON public.agent_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_agent_approval_submitted_by();

DROP POLICY IF EXISTS "Submitters read own approval requests" ON public.agent_approval_requests;
CREATE POLICY "Submitters read own approval requests"
  ON public.agent_approval_requests FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());
