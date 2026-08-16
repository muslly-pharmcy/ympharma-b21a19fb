
-- =============================================================
-- Shipment C3 — Dispensing engine (tables + RLS + triggers)
-- =============================================================

CREATE SEQUENCE IF NOT EXISTS public.hc_dispense_seq;

-- ---------- hc_dispenses ----------
CREATE TABLE IF NOT EXISTS public.hc_dispenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  branch_id        uuid,
  prescription_id  uuid NOT NULL REFERENCES public.hc_prescriptions(id) ON DELETE RESTRICT,
  patient_id       uuid NOT NULL REFERENCES public.hc_patients(id) ON DELETE RESTRICT,
  dispense_no      text UNIQUE,
  status           text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','prepared','verified','dispensed','completed','returned','cancelled')),
  prepared_by      uuid,
  verified_by      uuid,
  dispensed_by     uuid,
  notes            text,
  correlation_id   text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_dispenses TO authenticated;
GRANT ALL ON public.hc_dispenses TO service_role;

ALTER TABLE public.hc_dispenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hc_dispenses org read"
  ON public.hc_dispenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = hc_dispenses.organization_id
        AND m.status = 'active'
    )
  );

CREATE POLICY "hc_dispenses org write"
  ON public.hc_dispenses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = hc_dispenses.organization_id
        AND m.status = 'active'
        AND m.role IN ('owner','admin','manager','pharmacist')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = hc_dispenses.organization_id
        AND m.status = 'active'
        AND m.role IN ('owner','admin','manager','pharmacist')
    )
  );

CREATE INDEX IF NOT EXISTS idx_hc_dispenses_org_status ON public.hc_dispenses(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_hc_dispenses_prescription ON public.hc_dispenses(prescription_id);
CREATE INDEX IF NOT EXISTS idx_hc_dispenses_patient ON public.hc_dispenses(patient_id);
CREATE INDEX IF NOT EXISTS idx_hc_dispenses_created_at ON public.hc_dispenses(created_at DESC);

-- ---------- hc_dispense_items ----------
CREATE TABLE IF NOT EXISTS public.hc_dispense_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_id            uuid NOT NULL REFERENCES public.hc_dispenses(id) ON DELETE CASCADE,
  prescription_item_id   uuid REFERENCES public.hc_prescription_items(id) ON DELETE SET NULL,
  product_id             uuid,
  medication_name        text NOT NULL,
  qty_requested          numeric NOT NULL CHECK (qty_requested > 0),
  qty_dispensed          numeric NOT NULL DEFAULT 0 CHECK (qty_dispensed >= 0),
  reservation_id         uuid,
  batch_allocations      jsonb NOT NULL DEFAULT '[]'::jsonb,
  barcode_verified       boolean NOT NULL DEFAULT false,
  barcode_value          text,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hc_dispense_items TO authenticated;
GRANT ALL ON public.hc_dispense_items TO service_role;

ALTER TABLE public.hc_dispense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hc_dispense_items via parent"
  ON public.hc_dispense_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hc_dispenses d
      JOIN public.organization_members m
        ON m.organization_id = d.organization_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
      WHERE d.id = hc_dispense_items.dispense_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hc_dispenses d
      JOIN public.organization_members m
        ON m.organization_id = d.organization_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
       AND m.role IN ('owner','admin','manager','pharmacist')
      WHERE d.id = hc_dispense_items.dispense_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_hc_dispense_items_dispense ON public.hc_dispense_items(dispense_id);
CREATE INDEX IF NOT EXISTS idx_hc_dispense_items_product ON public.hc_dispense_items(product_id);

-- ---------- hc_dispense_status_history ----------
CREATE TABLE IF NOT EXISTS public.hc_dispense_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_id  uuid NOT NULL REFERENCES public.hc_dispenses(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  changed_by   uuid,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hc_dispense_status_history TO authenticated;
GRANT ALL ON public.hc_dispense_status_history TO service_role;

ALTER TABLE public.hc_dispense_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hc_dispense_history via parent"
  ON public.hc_dispense_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hc_dispenses d
      JOIN public.organization_members m
        ON m.organization_id = d.organization_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
      WHERE d.id = hc_dispense_status_history.dispense_id
    )
  );

CREATE POLICY "hc_dispense_history insert via parent"
  ON public.hc_dispense_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hc_dispenses d
      JOIN public.organization_members m
        ON m.organization_id = d.organization_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
       AND m.role IN ('owner','admin','manager','pharmacist')
      WHERE d.id = hc_dispense_status_history.dispense_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_hc_dispense_history_dispense ON public.hc_dispense_status_history(dispense_id, created_at);

-- ---------- hc_dispense_returns ----------
CREATE TABLE IF NOT EXISTS public.hc_dispense_returns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_id       uuid NOT NULL REFERENCES public.hc_dispenses(id) ON DELETE CASCADE,
  dispense_item_id  uuid REFERENCES public.hc_dispense_items(id) ON DELETE SET NULL,
  qty               numeric NOT NULL CHECK (qty > 0),
  reason            text NOT NULL,
  actor_user_id     uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hc_dispense_returns TO authenticated;
GRANT ALL ON public.hc_dispense_returns TO service_role;

ALTER TABLE public.hc_dispense_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hc_dispense_returns via parent"
  ON public.hc_dispense_returns FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hc_dispenses d
      JOIN public.organization_members m
        ON m.organization_id = d.organization_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
      WHERE d.id = hc_dispense_returns.dispense_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hc_dispenses d
      JOIN public.organization_members m
        ON m.organization_id = d.organization_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
       AND m.role IN ('owner','admin','manager','pharmacist')
      WHERE d.id = hc_dispense_returns.dispense_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_hc_dispense_returns_dispense ON public.hc_dispense_returns(dispense_id);

-- ---------- Triggers ----------
DROP TRIGGER IF EXISTS trg_hc_dispenses_updated ON public.hc_dispenses;
CREATE TRIGGER trg_hc_dispenses_updated BEFORE UPDATE ON public.hc_dispenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hc_dispense_items_updated ON public.hc_dispense_items;
CREATE TRIGGER trg_hc_dispense_items_updated BEFORE UPDATE ON public.hc_dispense_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hc_dispense_returns_updated ON public.hc_dispense_returns;
CREATE TRIGGER trg_hc_dispense_returns_updated BEFORE UPDATE ON public.hc_dispense_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispense number generator (DSP-YYYYMMDD-000001)
CREATE OR REPLACE FUNCTION public.gen_dispense_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dispense_no IS NULL THEN
    NEW.dispense_no := 'DSP-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('public.hc_dispense_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_hc_dispenses_no ON public.hc_dispenses;
CREATE TRIGGER trg_hc_dispenses_no BEFORE INSERT ON public.hc_dispenses
  FOR EACH ROW EXECUTE FUNCTION public.gen_dispense_no();
