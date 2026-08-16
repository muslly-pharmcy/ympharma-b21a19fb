-- Fix reserve_order_stock to use correct staff_alerts columns
CREATE OR REPLACE FUNCTION public.reserve_order_stock(_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  item JSONB;
  pid UUID;
  legacy INT;
  qty INT;
  prod public.products%ROWTYPE;
  reserved JSONB := '[]'::jsonb;
  shortages JSONB := '[]'::jsonb;
  alerted INT := 0;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(order_row.items, '[]'::jsonb))
  LOOP
    qty := COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1);
    pid := NULLIF(item->>'product_id', '')::UUID;
    legacy := NULLIF(item->>'legacy_id', '')::INT;

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
        'requested', qty, 'available', prod.stock_qty
      );
      CONTINUE;
    END IF;

    UPDATE public.products
    SET stock_qty = stock_qty - qty, updated_at = now()
    WHERE id = prod.id;

    reserved := reserved || jsonb_build_object(
      'product_id', prod.id, 'name', prod.name,
      'qty', qty, 'remaining', prod.stock_qty - qty
    );

    IF (prod.stock_qty - qty) <= prod.reorder_point THEN
      INSERT INTO public.staff_alerts (kind, severity, title, body, payload, entity_type, entity_id)
      VALUES (
        'low_stock', 'warn',
        'مخزون منخفض: ' || prod.name,
        'بقي ' || (prod.stock_qty - qty)::text || ' وحدة من ' || prod.name || ' (نقطة إعادة الطلب: ' || prod.reorder_point::text || ').',
        jsonb_build_object('product_id', prod.id, 'order_id', _order_id, 'remaining', prod.stock_qty - qty),
        'product', prod.id::text
      );
      alerted := alerted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', _order_id,
    'reserved', reserved, 'shortages', shortages,
    'low_stock_alerts', alerted
  );
END;
$$;

-- Failed agent action -> staff alert
CREATE OR REPLACE FUNCTION public.alert_on_failed_agent_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.execution_status = 'FAILED' AND (TG_OP = 'INSERT' OR OLD.execution_status IS DISTINCT FROM 'FAILED') THEN
    BEGIN
      INSERT INTO public.staff_alerts (kind, severity, title, body, payload, entity_type, entity_id)
      VALUES (
        'agent_failure', 'critical',
        'فشل قرار وكيل: ' || COALESCE(NEW.action_type, '—'),
        COALESCE(NEW.error_message, NEW.compiled_arabic_output, 'فشل غير محدد'),
        jsonb_build_object(
          'agent', COALESCE(NEW.originating_agent::text, NEW.agent_name),
          'pipeline', NEW.target_pipeline::text
        ),
        'agent_action', NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.error_logs (source, message, metadata)
      VALUES ('alert_on_failed_agent_action', SQLERRM, jsonb_build_object('action_id', NEW.id))
      ON CONFLICT DO NOTHING;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_failed_action ON public.agent_actions;
CREATE TRIGGER trg_alert_failed_action
AFTER INSERT OR UPDATE OF execution_status ON public.agent_actions
FOR EACH ROW EXECUTE FUNCTION public.alert_on_failed_agent_action();

CREATE OR REPLACE VIEW public.pending_admin_notifications
WITH (security_invoker = on) AS
SELECT id, kind, severity, title, body, payload, entity_type, entity_id, created_at
FROM public.staff_alerts
WHERE acknowledged_at IS NULL
ORDER BY
  CASE severity WHEN 'critical' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,
  created_at DESC;

GRANT SELECT ON public.pending_admin_notifications TO authenticated;
