DROP POLICY IF EXISTS inv_expiry_alerts_ack ON public.inv_expiry_alerts;
CREATE POLICY inv_expiry_alerts_ack ON public.inv_expiry_alerts
  FOR UPDATE TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'inventory.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'inventory.manage'));