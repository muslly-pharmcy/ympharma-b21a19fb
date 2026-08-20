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
    ELSE
      CONTINUE;
    END IF;

    IF NOT FOUND OR NOT prod.track_stock THEN
      CONTINUE;
    END IF;

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

    -- Alert when remaining stock crosses the reorder threshold
    IF (prod.stock_qty - qty) <= prod.reorder_point THEN
      INSERT INTO public.staff_alerts (kind, severity, title, body, metadata, status)
      VALUES (
        'low_stock', 'warning',
        'مخزون منخفض: ' || prod.name,
        'بقي ' || (prod.stock_qty - qty)::text || ' وحدة من ' || prod.name || ' (نقطة إعادة الطلب: ' || prod.reorder_point::text || ').',
        jsonb_build_object('product_id', prod.id, 'order_id', _order_id, 'remaining', prod.stock_qty - qty),
        'open'
      );
      alerted := alerted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', _order_id,
    'reserved', reserved,
    'shortages', shortages,
    'low_stock_alerts', alerted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_order_stock(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock(TEXT) TO authenticated, service_role;

-- Upgrade the order interception trigger: try to reserve stock immediately;
-- update the agent_actions row with the outcome instead of leaving it pending.
CREATE OR REPLACE FUNCTION public.intercept_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserve_result JSONB;
  shortage_count INT := 0;
  new_status public.action_execution_status := 'EXECUTED';
  msg TEXT;
BEGIN
  BEGIN
    reserve_result := public.reserve_order_stock(NEW.id);
    shortage_count := jsonb_array_length(COALESCE(reserve_result->'shortages', '[]'::jsonb));
    IF shortage_count > 0 THEN
      new_status := 'FAILED';
      msg := 'حجز المخزون فشل لـ ' || shortage_count::text || ' صنف — مراجعة مطلوبة للطلب ' || NEW.id;
    ELSE
      msg := 'تم حجز المخزون تلقائياً للطلب ' || NEW.id;
    END IF;

    INSERT INTO public.agent_actions (
      agent_name, originating_agent, target_pipeline,
      action_type, priority_level, payload, status,
      execution_status, compiled_arabic_output,
      executed_at, error_message
    ) VALUES (
      'inventory', 'inventory'::valid_agent_modes, 'ORDERS'::action_target_pipeline,
      'RESERVE_STOCK', CASE WHEN shortage_count > 0 THEN 'CRITICAL' ELSE 'HIGH' END,
      jsonb_build_object('order_id', NEW.id, 'result', reserve_result),
      CASE WHEN shortage_count > 0 THEN 'failed' ELSE 'executed' END,
      new_status, msg,
      now(),
      CASE WHEN shortage_count > 0 THEN reserve_result::text ELSE NULL END
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.error_logs (source, message, metadata)
    VALUES ('intercept_new_order', SQLERRM, jsonb_build_object('order_id', NEW.id))
    ON CONFLICT DO NOTHING;
  END;
  RETURN NEW;
END;
$$;
