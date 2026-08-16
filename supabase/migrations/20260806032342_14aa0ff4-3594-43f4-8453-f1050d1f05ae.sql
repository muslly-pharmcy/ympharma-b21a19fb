-- 1) Deactivate any family links that were never consented to by the member
UPDATE public.family_health_accounts fha
SET active = false, updated_at = now()
WHERE fha.active
  AND fha.accepted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.hc_patients mp
    JOIN public.hc_patients op ON op.id = fha.owner_patient_id
    WHERE mp.id = fha.member_patient_id AND mp.user_id = op.user_id
  );

-- 2) Replace the over-permissive ALL policy with per-command policies
DROP POLICY IF EXISTS own_family_manage ON public.family_health_accounts;

CREATE POLICY family_links_select ON public.family_health_accounts
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid())
);

-- Owner may only create PENDING invites, unless the member profile is their own
CREATE POLICY family_links_insert ON public.family_health_accounts
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid())
  AND (
    EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid())
    OR (active = false AND accepted_at IS NULL)
  )
);

-- Owner-side edits can never activate a link that the member has not accepted
CREATE POLICY family_links_update_owner ON public.family_health_accounts
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid())
  AND (
    EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid())
    OR active = false
  )
);

-- The member (the person whose record is shared) accepts or revokes
CREATE POLICY family_links_update_member ON public.family_health_accounts
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid()));

CREATE POLICY family_links_delete ON public.family_health_accounts
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = owner_patient_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.hc_patients p WHERE p.id = member_patient_id AND p.user_id = auth.uid())
);

-- 3) Require recorded consent before a family link grants medical-record access
CREATE OR REPLACE FUNCTION public.patient_belongs_to_current_user(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.hc_patients p
    WHERE p.id = _patient_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.family_health_accounts fha
    JOIN public.hc_patients op ON op.id = fha.owner_patient_id
    WHERE fha.member_patient_id = _patient_id
      AND fha.active
      AND fha.accepted_at IS NOT NULL
      AND fha.access_level = 'manage'
      AND op.user_id = auth.uid()
  );
$function$;