
-- 1) Fix mutable search_path on our trigger function
ALTER FUNCTION public.tg_update_timestamp() SET search_path = public, pg_temp;

-- 2) Replace WITH CHECK (true) on pn_transfer_requests update policy
DROP POLICY IF EXISTS pn_tr_involved_update ON public.pn_transfer_requests;
CREATE POLICY pn_tr_involved_update ON public.pn_transfer_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.pn_pharmacies p
    JOIN public.organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = ANY (ARRAY[pn_transfer_requests.from_pharmacy_id, pn_transfer_requests.to_pharmacy_id])
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.pn_pharmacies p
    JOIN public.organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = ANY (ARRAY[pn_transfer_requests.from_pharmacy_id, pn_transfer_requests.to_pharmacy_id])
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  )
);

-- 3) Replace WITH CHECK (true) on hc_doctor_join_submissions public insert
-- Public join submissions must start in 'new' status, cannot pre-assign a reviewer
-- or decision, and must include the required identifying fields.
DROP POLICY IF EXISTS "join anon insert" ON public.hc_doctor_join_submissions;
CREATE POLICY "join anon insert" ON public.hc_doctor_join_submissions
FOR INSERT
WITH CHECK (
  status = 'new'::hc_join_status
  AND reviewer_id IS NULL
  AND decision_at IS NULL
  AND duplicate_score = 0
  AND length(full_name_ar) BETWEEN 2 AND 200
  AND length(normalized_name_ar) BETWEEN 2 AND 200
  AND length(phone) BETWEEN 5 AND 40
  AND length(phone_e164) BETWEEN 5 AND 20
);
