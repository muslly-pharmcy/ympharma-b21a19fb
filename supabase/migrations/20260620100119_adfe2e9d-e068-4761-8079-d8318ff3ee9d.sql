
-- ============================================================
-- PHASE 1: Multi-branch architecture foundation
-- ============================================================

-- 1. Enums --------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.branch_type AS ENUM ('WAREHOUSE', 'BRANCH', 'OFFICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.branch_role AS ENUM ('manager', 'staff', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_type AS ENUM (
    'WH_TO_BRANCH', 'BRANCH_TO_BRANCH', 'BRANCH_TO_WH'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_status AS ENUM (
    'REQUESTED','APPROVED','RESERVED','PICKING','PACKED',
    'DISPATCHED','IN_TRANSIT','RECEIVED','COMPLETED',
    'CANCELLED','REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. branches -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  type            public.branch_type NOT NULL,
  address         text,
  phone           text,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 3. branch_user_assignments -------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_user_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  role        public.branch_role NOT NULL DEFAULT 'staff',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_user
  ON public.branch_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_branch
  ON public.branch_user_assignments(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_user_assignments TO authenticated;
GRANT ALL ON public.branch_user_assignments TO service_role;
ALTER TABLE public.branch_user_assignments ENABLE ROW LEVEL SECURITY;

-- 4. branch_inventory --------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty             integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  reserved_qty    integer NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  reorder_point   integer NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, product_id),
  CHECK (reserved_qty <= qty)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch ON public.branch_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_product ON public.branch_inventory(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_inventory TO authenticated;
GRANT ALL ON public.branch_inventory TO service_role;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;

-- 5. inventory_transfers -----------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id        text NOT NULL UNIQUE,
  transfer_type         public.transfer_type NOT NULL,
  source_branch_id      uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  destination_branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  status                public.transfer_status NOT NULL DEFAULT 'REQUESTED',
  requested_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason                text,
  notes                 text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (source_branch_id IS DISTINCT FROM destination_branch_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_src ON public.inventory_transfers(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_dst ON public.inventory_transfers(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON public.inventory_transfers(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.inventory_transfers TO authenticated;
GRANT ALL ON public.inventory_transfers TO service_role;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

-- 6. transfer_items ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.transfer_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id    uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty_requested  integer NOT NULL CHECK (qty_requested > 0),
  qty_picked     integer NOT NULL DEFAULT 0 CHECK (qty_picked >= 0),
  qty_received   integer NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
  UNIQUE (transfer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.transfer_items(transfer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_items TO authenticated;
GRANT ALL ON public.transfer_items TO service_role;
ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;

-- 7. transfer_audit_log (append-only) ----------------------------

CREATE TABLE IF NOT EXISTS public.transfer_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id  uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  from_status  public.transfer_status,
  to_status    public.transfer_status NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_transfer ON public.transfer_audit_log(transfer_id, created_at DESC);

GRANT SELECT, INSERT ON public.transfer_audit_log TO authenticated;
GRANT ALL ON public.transfer_audit_log TO service_role;
ALTER TABLE public.transfer_audit_log ENABLE ROW LEVEL SECURITY;

-- 8. helper functions --------------------------------------------

CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'owner'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.branch_user_assignments
      WHERE user_id = _user_id AND branch_id = _branch_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_branch_manager_of(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'owner'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.branch_user_assignments
      WHERE user_id = _user_id AND branch_id = _branch_id AND role = 'manager'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- 9. RLS policies ------------------------------------------------

DROP POLICY IF EXISTS "branches_read" ON public.branches;
CREATE POLICY "branches_read" ON public.branches FOR SELECT TO authenticated
USING (public.is_owner_or_admin(auth.uid()) OR public.has_branch_access(auth.uid(), id));

DROP POLICY IF EXISTS "branches_admin_write" ON public.branches;
CREATE POLICY "branches_admin_write" ON public.branches FOR ALL TO authenticated
USING (public.is_owner_or_admin(auth.uid()))
WITH CHECK (public.is_owner_or_admin(auth.uid()));

DROP POLICY IF EXISTS "bua_read_self_or_admin" ON public.branch_user_assignments;
CREATE POLICY "bua_read_self_or_admin" ON public.branch_user_assignments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_owner_or_admin(auth.uid()));

DROP POLICY IF EXISTS "bua_admin_write" ON public.branch_user_assignments;
CREATE POLICY "bua_admin_write" ON public.branch_user_assignments FOR ALL TO authenticated
USING (public.is_owner_or_admin(auth.uid()))
WITH CHECK (public.is_owner_or_admin(auth.uid()));

DROP POLICY IF EXISTS "bi_read" ON public.branch_inventory;
CREATE POLICY "bi_read" ON public.branch_inventory FOR SELECT TO authenticated
USING (public.has_branch_access(auth.uid(), branch_id));

DROP POLICY IF EXISTS "bi_admin_write" ON public.branch_inventory;
CREATE POLICY "bi_admin_write" ON public.branch_inventory FOR ALL TO authenticated
USING (public.is_owner_or_admin(auth.uid()))
WITH CHECK (public.is_owner_or_admin(auth.uid()));

DROP POLICY IF EXISTS "transfers_read" ON public.inventory_transfers;
CREATE POLICY "transfers_read" ON public.inventory_transfers FOR SELECT TO authenticated
USING (
  public.is_owner_or_admin(auth.uid())
  OR (source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), source_branch_id))
  OR (destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), destination_branch_id))
);

DROP POLICY IF EXISTS "transfers_insert" ON public.inventory_transfers;
CREATE POLICY "transfers_insert" ON public.inventory_transfers FOR INSERT TO authenticated
WITH CHECK (
  public.is_owner_or_admin(auth.uid())
  OR (source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), source_branch_id))
  OR (destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), destination_branch_id))
);

DROP POLICY IF EXISTS "transfers_update" ON public.inventory_transfers;
CREATE POLICY "transfers_update" ON public.inventory_transfers FOR UPDATE TO authenticated
USING (
  public.is_owner_or_admin(auth.uid())
  OR (source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), source_branch_id))
  OR (destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), destination_branch_id))
);

DROP POLICY IF EXISTS "transfer_items_read" ON public.transfer_items;
CREATE POLICY "transfer_items_read" ON public.transfer_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inventory_transfers t
  WHERE t.id = transfer_items.transfer_id
    AND (
      public.is_owner_or_admin(auth.uid())
      OR (t.source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.source_branch_id))
      OR (t.destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.destination_branch_id))
    )
));

DROP POLICY IF EXISTS "transfer_items_write" ON public.transfer_items;
CREATE POLICY "transfer_items_write" ON public.transfer_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inventory_transfers t
  WHERE t.id = transfer_items.transfer_id
    AND (
      public.is_owner_or_admin(auth.uid())
      OR (t.source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.source_branch_id))
      OR (t.destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.destination_branch_id))
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.inventory_transfers t
  WHERE t.id = transfer_items.transfer_id
    AND (
      public.is_owner_or_admin(auth.uid())
      OR (t.source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.source_branch_id))
      OR (t.destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.destination_branch_id))
    )
));

DROP POLICY IF EXISTS "audit_read" ON public.transfer_audit_log;
CREATE POLICY "audit_read" ON public.transfer_audit_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inventory_transfers t
  WHERE t.id = transfer_audit_log.transfer_id
    AND (
      public.is_owner_or_admin(auth.uid())
      OR (t.source_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.source_branch_id))
      OR (t.destination_branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), t.destination_branch_id))
    )
));

DROP POLICY IF EXISTS "audit_insert_admin" ON public.transfer_audit_log;
CREATE POLICY "audit_insert_admin" ON public.transfer_audit_log FOR INSERT TO authenticated
WITH CHECK (public.is_owner_or_admin(auth.uid()));

-- 10. State machine + audit + event-bus trigger ------------------

CREATE OR REPLACE FUNCTION public.transfer_status_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  legal boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'REQUESTED' THEN
      RAISE EXCEPTION 'New transfers must start in REQUESTED, got %', NEW.status;
    END IF;
    INSERT INTO public.transfer_audit_log(transfer_id, from_status, to_status, actor_user_id, reason)
    VALUES (NEW.id, NULL, 'REQUESTED', NEW.requested_by, NEW.reason);
    BEGIN
      INSERT INTO public.agent_events(event_type, payload)
      VALUES ('TransferRequested', jsonb_build_object('transfer_id', NEW.id, 'correlation_id', NEW.correlation_id, 'type', NEW.transfer_type));
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
    RETURN NEW;
  END IF;

  IF NEW.status = OLD.status THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- legal transitions
  legal := CASE OLD.status
    WHEN 'REQUESTED'  THEN NEW.status IN ('APPROVED','REJECTED','CANCELLED')
    WHEN 'APPROVED'   THEN NEW.status IN ('RESERVED','CANCELLED')
    WHEN 'RESERVED'   THEN NEW.status IN ('PICKING','CANCELLED')
    WHEN 'PICKING'    THEN NEW.status IN ('PACKED','CANCELLED')
    WHEN 'PACKED'     THEN NEW.status IN ('DISPATCHED','CANCELLED')
    WHEN 'DISPATCHED' THEN NEW.status IN ('IN_TRANSIT','CANCELLED')
    WHEN 'IN_TRANSIT' THEN NEW.status IN ('RECEIVED','CANCELLED')
    WHEN 'RECEIVED'   THEN NEW.status IN ('COMPLETED')
    WHEN 'COMPLETED'  THEN false
    WHEN 'CANCELLED'  THEN false
    WHEN 'REJECTED'   THEN false
    ELSE false
  END;

  IF NOT legal THEN
    RAISE EXCEPTION 'Illegal transfer transition: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.updated_at := now();

  INSERT INTO public.transfer_audit_log(transfer_id, from_status, to_status, actor_user_id, reason)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.reason);

  BEGIN
    INSERT INTO public.agent_events(event_type, payload)
    VALUES (
      'Transfer' || initcap(lower(NEW.status::text)),
      jsonb_build_object(
        'transfer_id', NEW.id,
        'correlation_id', NEW.correlation_id,
        'type', NEW.transfer_type,
        'from', OLD.status,
        'to',   NEW.status
      )
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_status_guard_ins ON public.inventory_transfers;
CREATE TRIGGER trg_transfer_status_guard_ins
  BEFORE INSERT ON public.inventory_transfers
  FOR EACH ROW EXECUTE FUNCTION public.transfer_status_guard();

DROP TRIGGER IF EXISTS trg_transfer_status_guard_upd ON public.inventory_transfers;
CREATE TRIGGER trg_transfer_status_guard_upd
  BEFORE UPDATE ON public.inventory_transfers
  FOR EACH ROW EXECUTE FUNCTION public.transfer_status_guard();

-- 11. Idempotent stock operations --------------------------------

CREATE OR REPLACE FUNCTION public.reserve_transfer_stock(_transfer_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t   public.inventory_transfers%ROWTYPE;
  itm public.transfer_items%ROWTYPE;
  cur integer;
BEGIN
  SELECT * INTO t FROM public.inventory_transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF t.status = 'RESERVED' THEN RETURN 'SKIPPED_ALREADY_RESERVED'; END IF;
  IF t.status <> 'APPROVED' THEN RAISE EXCEPTION 'reserve requires APPROVED, current=%', t.status; END IF;
  IF t.source_branch_id IS NULL THEN RAISE EXCEPTION 'source branch required to reserve'; END IF;

  FOR itm IN SELECT * FROM public.transfer_items WHERE transfer_id = _transfer_id LOOP
    SELECT (qty - reserved_qty) INTO cur
      FROM public.branch_inventory
      WHERE branch_id = t.source_branch_id AND product_id = itm.product_id
      FOR UPDATE;
    IF cur IS NULL OR cur < itm.qty_requested THEN
      RAISE EXCEPTION 'insufficient stock at source for product %, available=%, need=%',
        itm.product_id, COALESCE(cur,0), itm.qty_requested;
    END IF;
    UPDATE public.branch_inventory
       SET reserved_qty = reserved_qty + itm.qty_requested, updated_at = now()
     WHERE branch_id = t.source_branch_id AND product_id = itm.product_id;
  END LOOP;

  UPDATE public.inventory_transfers SET status = 'RESERVED' WHERE id = _transfer_id;
  RETURN 'OK_RESERVED';
END $$;

CREATE OR REPLACE FUNCTION public.release_transfer_reservation(_transfer_id uuid, _reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t   public.inventory_transfers%ROWTYPE;
  itm public.transfer_items%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.inventory_transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF t.status NOT IN ('RESERVED','PICKING','PACKED') THEN RETURN 'SKIPPED_NO_RESERVATION'; END IF;

  FOR itm IN SELECT * FROM public.transfer_items WHERE transfer_id = _transfer_id LOOP
    UPDATE public.branch_inventory
       SET reserved_qty = GREATEST(0, reserved_qty - itm.qty_requested), updated_at = now()
     WHERE branch_id = t.source_branch_id AND product_id = itm.product_id;
  END LOOP;
  RETURN 'OK_RELEASED';
END $$;

CREATE OR REPLACE FUNCTION public.commit_transfer_receipt(_transfer_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t   public.inventory_transfers%ROWTYPE;
  itm public.transfer_items%ROWTYPE;
  qty integer;
BEGIN
  SELECT * INTO t FROM public.inventory_transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF t.status = 'COMPLETED' THEN RETURN 'SKIPPED_ALREADY_COMPLETED'; END IF;
  IF t.status <> 'RECEIVED' THEN RAISE EXCEPTION 'commit requires RECEIVED, current=%', t.status; END IF;
  IF t.destination_branch_id IS NULL THEN RAISE EXCEPTION 'destination branch required'; END IF;

  FOR itm IN SELECT * FROM public.transfer_items WHERE transfer_id = _transfer_id LOOP
    qty := COALESCE(NULLIF(itm.qty_received,0), itm.qty_requested);

    -- decrement source (consume reservation)
    IF t.source_branch_id IS NOT NULL THEN
      UPDATE public.branch_inventory
         SET qty = qty - itm.qty_requested,
             reserved_qty = GREATEST(0, reserved_qty - itm.qty_requested),
             updated_at = now()
       WHERE branch_id = t.source_branch_id AND product_id = itm.product_id;
    END IF;

    -- increment destination
    INSERT INTO public.branch_inventory(branch_id, product_id, qty)
    VALUES (t.destination_branch_id, itm.product_id, qty)
    ON CONFLICT (branch_id, product_id)
      DO UPDATE SET qty = public.branch_inventory.qty + EXCLUDED.qty, updated_at = now();
  END LOOP;

  -- refresh cached products.stock_qty as sum across branches
  UPDATE public.products p
     SET stock_qty = COALESCE((
       SELECT SUM(qty) FROM public.branch_inventory bi WHERE bi.product_id = p.id
     ), 0)
   WHERE p.id IN (SELECT product_id FROM public.transfer_items WHERE transfer_id = _transfer_id);

  UPDATE public.inventory_transfers SET status = 'COMPLETED' WHERE id = _transfer_id;
  RETURN 'OK_COMPLETED';
END $$;

GRANT EXECUTE ON FUNCTION public.reserve_transfer_stock(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_transfer_reservation(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_transfer_receipt(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_branch_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_branch_manager_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_or_admin(uuid) TO authenticated, service_role;

-- 12. Seed minimal locations -------------------------------------

INSERT INTO public.branches(code, name, type)
VALUES
  ('WH-001', 'CENTRAL_WAREHOUSE', 'WAREHOUSE'),
  ('HQ-001', 'HEAD_OFFICE',       'OFFICE'),
  ('BR-001', 'MAIN_BRANCH',       'BRANCH')
ON CONFLICT (code) DO NOTHING;

-- 13. Backfill current stock into the central warehouse ----------

INSERT INTO public.branch_inventory(branch_id, product_id, qty, reorder_point)
SELECT
  (SELECT id FROM public.branches WHERE code = 'WH-001'),
  p.id,
  COALESCE(p.stock_qty, 0),
  COALESCE(p.reorder_point, 0)
FROM public.products p
ON CONFLICT (branch_id, product_id) DO NOTHING;
