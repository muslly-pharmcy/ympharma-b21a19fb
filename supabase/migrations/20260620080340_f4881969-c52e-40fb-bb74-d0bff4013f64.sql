
-- ============================================================
-- 5c · correlation_id end-to-end + FK on reservation state
-- ============================================================

ALTER TABLE public.orders                      ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.inventory_audit_log         ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.inventory_reservation_state ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.agent_actions               ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.agent_runs                  ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.agent_events                ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.staff_alerts                ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- Backfill orders, then make it required + auto-generated for future inserts.
UPDATE public.orders SET correlation_id = gen_random_uuid() WHERE correlation_id IS NULL;
ALTER TABLE public.orders ALTER COLUMN correlation_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.orders ALTER COLUMN correlation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_correlation                     ON public.orders                      (correlation_id);
CREATE INDEX IF NOT EXISTS idx_inv_audit_correlation                  ON public.inventory_audit_log         (correlation_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_state_correlation              ON public.inventory_reservation_state (correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_correlation              ON public.agent_actions               (correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_correlation                 ON public.agent_runs                  (correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_correlation               ON public.agent_events                (correlation_id);
CREATE INDEX IF NOT EXISTS idx_staff_alerts_correlation               ON public.staff_alerts                (correlation_id);

-- FK reservation_state.order_id → orders.id  (NOT VALID so existing orphans don't block migration).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_inv_res_state_order'
  ) THEN
    ALTER TABLE public.inventory_reservation_state
      ADD CONSTRAINT fk_inv_res_state_order
      FOREIGN KEY (order_id) REFERENCES public.orders(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END$$;

-- Auto-propagate correlation_id from orders into inventory_audit_log / inventory_reservation_state
-- whenever inventory functions write rows that omit it.
CREATE OR REPLACE FUNCTION public._inherit_correlation_from_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.correlation_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT correlation_id INTO NEW.correlation_id FROM public.orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_inv_audit_inherit_corr ON public.inventory_audit_log;
CREATE TRIGGER trg_inv_audit_inherit_corr
  BEFORE INSERT ON public.inventory_audit_log
  FOR EACH ROW EXECUTE FUNCTION public._inherit_correlation_from_order();

DROP TRIGGER IF EXISTS trg_inv_res_state_inherit_corr ON public.inventory_reservation_state;
CREATE TRIGGER trg_inv_res_state_inherit_corr
  BEFORE INSERT ON public.inventory_reservation_state
  FOR EACH ROW EXECUTE FUNCTION public._inherit_correlation_from_order();

-- ============================================================
-- 5f · tighten public-readable / over-permissive policies
-- ============================================================

-- uptime_checks: stop leaking infra availability to anon.
REVOKE SELECT ON public.uptime_checks FROM anon;
DROP POLICY IF EXISTS "uptime_checks_read_all" ON public.uptime_checks;
CREATE POLICY "uptime_checks_read_auth"
  ON public.uptime_checks FOR SELECT TO authenticated USING (true);

-- staff_alerts: keep UPDATE allowed for staff (to acknowledge), but block tampering with content.
CREATE OR REPLACE FUNCTION public._staff_alerts_lock_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin BOOLEAN := public.has_role(auth.uid(), 'admin'::app_role)
                   OR public.has_role(auth.uid(), 'owner'::app_role);
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;
  IF NEW.kind        IS DISTINCT FROM OLD.kind        THEN RAISE EXCEPTION 'staff_alerts.kind is immutable for non-admins'; END IF;
  IF NEW.severity    IS DISTINCT FROM OLD.severity    THEN RAISE EXCEPTION 'staff_alerts.severity is immutable for non-admins'; END IF;
  IF NEW.title       IS DISTINCT FROM OLD.title       THEN RAISE EXCEPTION 'staff_alerts.title is immutable for non-admins'; END IF;
  IF NEW.body        IS DISTINCT FROM OLD.body        THEN RAISE EXCEPTION 'staff_alerts.body is immutable for non-admins'; END IF;
  IF NEW.entity_type IS DISTINCT FROM OLD.entity_type THEN RAISE EXCEPTION 'staff_alerts.entity_type is immutable for non-admins'; END IF;
  IF NEW.entity_id   IS DISTINCT FROM OLD.entity_id   THEN RAISE EXCEPTION 'staff_alerts.entity_id is immutable for non-admins'; END IF;
  IF NEW.payload    :: text IS DISTINCT FROM OLD.payload :: text
                                                      THEN RAISE EXCEPTION 'staff_alerts.payload is immutable for non-admins'; END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_staff_alerts_lock_content ON public.staff_alerts;
CREATE TRIGGER trg_staff_alerts_lock_content
  BEFORE UPDATE ON public.staff_alerts
  FOR EACH ROW EXECUTE FUNCTION public._staff_alerts_lock_content();

-- ============================================================
-- 5e · DR coverage helper — confirm backup cron is installed.
-- (backup-daily / backup-weekly were scheduled in earlier migrations;
--  this view exposes the schedule to admins for verification.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_backup_schedule()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE r RECORD; out JSONB := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT jobid, jobname, schedule, active
      FROM cron.job
     WHERE jobname IN ('backup-daily','backup-weekly')
     ORDER BY jobname
  LOOP
    out := out || jsonb_build_array(jsonb_build_object(
      'job_id', r.jobid, 'job_name', r.jobname,
      'schedule', r.schedule, 'active', r.active));
  END LOOP;
  RETURN jsonb_build_object('jobs', out);
END$$;

REVOKE ALL ON FUNCTION public.get_backup_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_backup_schedule() TO authenticated, service_role;
