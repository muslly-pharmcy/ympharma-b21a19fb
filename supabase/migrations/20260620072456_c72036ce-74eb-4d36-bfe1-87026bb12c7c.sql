
-- 1) State table (idempotency)
CREATE TABLE IF NOT EXISTS public.inventory_reservation_state (
  order_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('RESERVED','RELEASED')),
  reserved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_reservation_state TO authenticated;
GRANT ALL ON public.inventory_reservation_state TO service_role;
ALTER TABLE public.inventory_reservation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read reservation state" ON public.inventory_reservation_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- 2) Audit log
CREATE TABLE IF NOT EXISTS public.inventory_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('RESERVE','RELEASE')),
  status TEXT NOT NULL CHECK (status IN ('OK','FAILED','SKIPPED_DUPLICATE','SHORTAGE')),
  reason TEXT,
  actor TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_audit_order ON public.inventory_audit_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_audit_status ON public.inventory_audit_log(status, created_at DESC);
GRANT SELECT ON public.inventory_audit_log TO authenticated;
GRANT ALL ON public.inventory_audit_log TO service_role;
ALTER TABLE public.inventory_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read inv audit" ON public.inventory_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- 3) Rewrite reserve_order_stock with idempotency + audit
DROP FUNCTION IF EXISTS public.reserve_order_stock(TEXT);
CREATE OR REPLACE FUNCTION public.reserve_order_stock(
  _order_id TEXT,
  _actor TEXT DEFAULT NULL,
  _reason TEXT DEFAULT 'auto'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  item JSONB;
  pid UUID; legacy INT; qty INT;
  prod public.products%ROWTYPE;
  reserved JSONB := '[]'::jsonb;
  shortages JSONB := '[]'::jsonb;
  st_row public.inventory_reservation_state%ROWTYPE;
  result JSONB;
BEGIN
  -- Idempotency check
  SELECT * INTO st_row FROM public.inventory_reservation_state
    WHERE order_id = _order_id FOR UPDATE;
  IF FOUND AND st_row.state = 'RESERVED' THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'SKIPPED_DUPLICATE', _reason, _actor,
             jsonb_build_object('previous_reserved_at', st_row.reserved_at));
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason','already_reserved');
  END IF;

  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor)
      VALUES(_order_id, 'RESERVE', 'FAILED', 'order_not_found', _actor);
    RETURN jsonb_build_object('ok', false, 'error','order_not_found');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(order_row.items, '[]'::jsonb)) LOOP
    qty := COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1);
    pid := NULLIF(item->>'product_id','')::UUID;
    legacy := NULLIF(item->>'legacy_id','')::INT;
    IF pid IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE id = pid FOR UPDATE;
    ELSIF legacy IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE legacy_id = legacy FOR UPDATE;
    ELSE CONTINUE;
    END IF;
    IF NOT FOUND OR NOT prod.track_stock THEN CONTINUE; END IF;
    IF prod.stock_qty < qty THEN
      shortages := shortages || jsonb_build_object(
        'product_id', prod.id, 'name', prod.name,
        'requested', qty, 'available', prod.stock_qty);
      CONTINUE;
    END IF;
    UPDATE public.products SET stock_qty = stock_qty - qty, updated_at = now() WHERE id = prod.id;
    reserved := reserved || jsonb_build_object(
      'product_id', prod.id, 'name', prod.name,
      'qty', qty, 'remaining', prod.stock_qty - qty);
  END LOOP;

  result := jsonb_build_object('ok', jsonb_array_length(shortages)=0,
    'order_id', _order_id, 'reserved', reserved, 'shortages', shortages);

  IF jsonb_array_length(shortages) > 0 THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'SHORTAGE', _reason, _actor, result);
    -- DO NOT set state on shortage so retry is possible
  ELSE
    INSERT INTO public.inventory_reservation_state(order_id, state, reserved_at, updated_at)
      VALUES(_order_id, 'RESERVED', now(), now())
      ON CONFLICT (order_id) DO UPDATE
        SET state='RESERVED', reserved_at=now(), updated_at=now();
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RESERVE', 'OK', _reason, _actor, result);
  END IF;

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RESERVE', 'FAILED', SQLERRM, _actor, jsonb_build_object('sqlstate', SQLSTATE));
  RAISE;
END;
$$;

-- 4) Rewrite release_order_stock with idempotency + audit
DROP FUNCTION IF EXISTS public.release_order_stock(TEXT);
CREATE OR REPLACE FUNCTION public.release_order_stock(
  _order_id TEXT,
  _actor TEXT DEFAULT NULL,
  _reason TEXT DEFAULT 'auto'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  item JSONB;
  pid UUID; legacy INT; qty INT;
  prod public.products%ROWTYPE;
  released JSONB := '[]'::jsonb;
  st_row public.inventory_reservation_state%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO st_row FROM public.inventory_reservation_state
    WHERE order_id = _order_id FOR UPDATE;
  IF NOT FOUND OR st_row.state <> 'RESERVED' THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
      VALUES(_order_id, 'RELEASE', 'SKIPPED_DUPLICATE', _reason, _actor,
             jsonb_build_object('current_state', COALESCE(st_row.state, 'NONE')));
    RETURN jsonb_build_object('ok', true, 'skipped', true,
      'reason', CASE WHEN NOT FOUND THEN 'never_reserved' ELSE 'already_released' END);
  END IF;

  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor)
      VALUES(_order_id, 'RELEASE', 'FAILED', 'order_not_found', _actor);
    RETURN jsonb_build_object('ok', false, 'error','order_not_found');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(order_row.items, '[]'::jsonb)) LOOP
    qty := COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1);
    pid := NULLIF(item->>'product_id','')::UUID;
    legacy := NULLIF(item->>'legacy_id','')::INT;
    IF pid IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE id = pid FOR UPDATE;
    ELSIF legacy IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE legacy_id = legacy FOR UPDATE;
    ELSE CONTINUE;
    END IF;
    IF NOT FOUND OR NOT prod.track_stock THEN CONTINUE; END IF;
    UPDATE public.products SET stock_qty = stock_qty + qty, updated_at = now() WHERE id = prod.id;
    released := released || jsonb_build_object(
      'product_id', prod.id, 'name', prod.name,
      'qty', qty, 'new_stock', prod.stock_qty + qty);
  END LOOP;

  UPDATE public.inventory_reservation_state
    SET state='RELEASED', released_at=now(), updated_at=now()
    WHERE order_id = _order_id;

  result := jsonb_build_object('ok', true, 'order_id', _order_id, 'released', released);
  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RELEASE', 'OK', _reason, _actor, result);
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.inventory_audit_log(order_id, action, status, reason, actor, payload)
    VALUES(_order_id, 'RELEASE', 'FAILED', SQLERRM, _actor, jsonb_build_object('sqlstate', SQLSTATE));
  RAISE;
END;
$$;

-- 5) Notifications trigger: repeated failures + backlog
CREATE OR REPLACE FUNCTION public.notify_inventory_audit_issues()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fail_count INT;
  backlog INT;
BEGIN
  IF NEW.status NOT IN ('FAILED','SHORTAGE') THEN
    RETURN NEW;
  END IF;

  -- Repeated failures for same order in last 24h
  SELECT count(*) INTO fail_count
    FROM public.inventory_audit_log
    WHERE order_id = NEW.order_id
      AND status IN ('FAILED','SHORTAGE')
      AND created_at >= now() - interval '24 hours';

  IF fail_count >= 3 AND fail_count % 3 = 0 THEN
    INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload)
    VALUES('inventory_repeat_failure','critical',
      'فشل متكرر في حجز/إفراج المخزون',
      'الطلب ' || NEW.order_id || ' فشل ' || fail_count || ' مرات خلال 24 ساعة (' || NEW.action || ').',
      'order', NEW.order_id,
      jsonb_build_object('order_id', NEW.order_id, 'fail_count', fail_count, 'last_reason', NEW.reason));
  END IF;

  -- Backlog alert: 25 failures across all orders in last hour (throttled)
  SELECT count(*) INTO backlog
    FROM public.inventory_audit_log
    WHERE status IN ('FAILED','SHORTAGE')
      AND created_at >= now() - interval '1 hour';

  IF backlog >= 25 AND NOT EXISTS (
    SELECT 1 FROM public.staff_alerts
    WHERE kind = 'inventory_backlog' AND created_at >= now() - interval '1 hour'
  ) THEN
    INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, payload)
    VALUES('inventory_backlog','critical',
      'تراكم فشل في حلقة المخزون',
      'تم تسجيل ' || backlog || ' حالة فشل/نقص خلال آخر ساعة. مطلوب مراجعة فورية.',
      'inventory', jsonb_build_object('backlog', backlog));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_audit_notify ON public.inventory_audit_log;
CREATE TRIGGER trg_inventory_audit_notify
  AFTER INSERT ON public.inventory_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.notify_inventory_audit_issues();
