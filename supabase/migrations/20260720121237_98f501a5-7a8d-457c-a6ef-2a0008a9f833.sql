DROP POLICY IF EXISTS members_insert_admin ON public.organization_members;
CREATE POLICY members_insert_admin ON public.organization_members
FOR INSERT TO authenticated
WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner'::text, 'admin'::text]));