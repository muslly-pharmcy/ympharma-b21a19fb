-- AI governance records control which agents can execute, which tools they
-- may call, and the budgets/policies that constrain them.  The original write
-- policies checked only the caller's global admin role.  In a multi-tenant
-- installation, that allowed a global admin who belonged to one organization
-- to target a different organization's governance row through the Data API.
--
-- Keep the existing administrative-role requirement, and additionally bind
-- both the existing row (USING) and proposed row (WITH CHECK) to an
-- organization of which the caller is a member.

DROP POLICY IF EXISTS air_policies_write ON public.air_policies;
CREATE POLICY air_policies_write ON public.air_policies
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS air_budgets_write ON public.air_budgets;
CREATE POLICY air_budgets_write ON public.air_budgets
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS air_caps_write ON public.air_capabilities;
CREATE POLICY air_caps_write ON public.air_capabilities
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
