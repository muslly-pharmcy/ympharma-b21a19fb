ALTER TABLE public.hc_patients
  ADD CONSTRAINT hc_patients_user_id_uniq UNIQUE (user_id);

DROP POLICY IF EXISTS patients_self_write ON public.hc_patients;

CREATE POLICY patients_self_write ON public.hc_patients
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()))
  );