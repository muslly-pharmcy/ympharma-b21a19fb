-- 1) inv_stock_movements: explicit org-scoped write policy (previously read-only policy set)
CREATE POLICY inv_stock_movements_write ON public.inv_stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'inventory.write'));

-- 2) hc_prescriptions: let a patient read their own prescriptions (staff scope unchanged)
CREATE POLICY rx_patient_self_read ON public.hc_prescriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hc_patients p
      WHERE p.id = hc_prescriptions.patient_id
        AND p.user_id = auth.uid()
    )
  );

-- 3) Predictive reorder suggestions
CREATE TABLE public.inv_reorder_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.sup_suppliers(id) ON DELETE SET NULL,
  on_hand numeric(14,3) NOT NULL DEFAULT 0,
  daily_burn_rate numeric(14,4) NOT NULL DEFAULT 0,
  lead_time_days integer NOT NULL DEFAULT 14,
  safety_stock numeric(14,3) NOT NULL DEFAULT 0,
  reorder_point numeric(14,3) NOT NULL DEFAULT 0,
  suggested_qty numeric(14,3) NOT NULL DEFAULT 0,
  days_of_cover numeric(10,2),
  status text NOT NULL DEFAULT 'open',
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  window_days integer NOT NULL DEFAULT 90,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inv_reorder_suggestions_status_check CHECK (status IN ('open','drafted','dismissed','ordered')),
  CONSTRAINT inv_reorder_suggestions_uniq UNIQUE (organization_id, warehouse_id, product_id)
);

CREATE INDEX inv_reorder_suggestions_org_status_idx
  ON public.inv_reorder_suggestions (organization_id, status, computed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reorder_suggestions TO authenticated;
GRANT ALL ON public.inv_reorder_suggestions TO service_role;

ALTER TABLE public.inv_reorder_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY inv_reorder_suggestions_read ON public.inv_reorder_suggestions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY inv_reorder_suggestions_write ON public.inv_reorder_suggestions
  FOR ALL TO authenticated
  USING (public.has_org_permission(auth.uid(), organization_id, 'purchasing.write'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'purchasing.write'));

CREATE TRIGGER inv_reorder_suggestions_touch
  BEFORE UPDATE ON public.inv_reorder_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();