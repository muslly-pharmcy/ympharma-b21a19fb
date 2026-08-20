
-- release_order_stock: counterpart to reserve_order_stock.
-- Returns reserved units back to products.stock_qty and writes a RELEASE_STOCK
-- audit row to agent_actions. Matches the item-resolution logic used by reserve.
CREATE OR REPLACE FUNCTION public.release_order_stock(_order_id text)
RETURNS jsonb
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
  released JSONB := '[]'::jsonb;
  skipped  JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(order_row.items, '[]'::jsonb))
  LOOP
    qty := COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1);
    pid := NULLIF(item->>'product_id','')::UUID;
    legacy := NULLIF(item->>'legacy_id','')::INT;
    prod := NULL;
    IF pid IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE id = pid;
    ELSIF legacy IS NOT NULL THEN
      SELECT * INTO prod FROM public.products WHERE legacy_id = legacy LIMIT 1;
    END IF;
    IF prod.id IS NULL OR NOT prod.track_stock THEN
      skipped := skipped || jsonb_build_object('item', item, 'reason', 'no_tracked_product');
      CONTINUE;
    END IF;
    UPDATE public.products
       SET stock_qty = stock_qty + qty,
           updated_at = now()
     WHERE id = prod.id;
    released := released || jsonb_build_object('product_id', prod.id, 'qty', qty, 'new_stock', prod.stock_qty + qty);
  END LOOP;

  INSERT INTO public.agent_actions (
    agent_name, originating_agent, target_pipeline,
    action_type, priority_level, payload, status,
    execution_status, compiled_arabic_output, executed_at
  ) VALUES (
    'inventory', 'inventory'::valid_agent_modes, 'ORDERS'::action_target_pipeline,
    'RELEASE_STOCK', 'MEDIUM',
    jsonb_build_object('order_id', _order_id, 'released', released, 'skipped', skipped),
    'executed', 'EXECUTED'::public.action_execution_status,
    'تم إرجاع مخزون ' || jsonb_array_length(released)::text || ' صنف للطلب ' || _order_id, now()
  );

  RETURN jsonb_build_object('ok', true, 'released', released, 'skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.release_order_stock(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_order_stock(text) TO service_role;

-- Trigger: when an order moves into cancelled/refunded, release its reserved stock.
CREATE OR REPLACE FUNCTION public.handle_order_cancel_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('cancelled', 'refunded') AND OLD.status NOT IN ('cancelled', 'refunded') THEN
    BEGIN
      PERFORM public.release_order_stock(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.error_logs (source, message, metadata)
      VALUES ('handle_order_cancel_release', SQLERRM, jsonb_build_object('order_id', NEW.id))
      ON CONFLICT DO NOTHING;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancel_release ON public.orders;
CREATE TRIGGER trg_order_cancel_release
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_cancel_release();
