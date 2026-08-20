-- =====================================================================
-- Phase 6C Sprint 5 — Order lifecycle WhatsApp notifications
-- =====================================================================

-- 1) Templates ---------------------------------------------------------
INSERT INTO public.whatsapp_notification_templates(id, event_name, body_template, variables, description) VALUES
('ORDER_CONFIRMED','ORDER_CONFIRMED',
E'🏥 *{{pharmacy_name}}*\n\nتم تأكيد طلبك ✅\n\n🆔 رقم الطلب: *{{order_number}}*\n📅 التاريخ: {{event_date}}\n\nسنقوم بإبلاغك عند خروج الطلب للتوصيل.\n\n🔎 تتبع الطلب: {{tracking_url}}\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
ARRAY['order_number','pharmacy_name','event_date','tracking_url','opt_out_url'],
'إشعار العميل بتأكيد الطلب'),
('ORDER_DISPATCHED','ORDER_DISPATCHED',
E'🏥 *{{pharmacy_name}}*\n\nطلبك في الطريق إليك 🚚\n\n🆔 رقم الطلب: *{{order_number}}*\n📅 التاريخ: {{event_date}}\n\n🔎 تتبع الطلب: {{tracking_url}}\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
ARRAY['order_number','pharmacy_name','event_date','tracking_url','opt_out_url'],
'إشعار العميل بشحن الطلب'),
('ORDER_DELIVERED','ORDER_DELIVERED',
E'🏥 *{{pharmacy_name}}*\n\nتم تسليم طلبك بنجاح 🎉\n\n🆔 رقم الطلب: *{{order_number}}*\n📅 التاريخ: {{event_date}}\n\nشكراً لثقتك بنا. لأي ملاحظة أو شكوى تواصل معنا مباشرة.\n\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
ARRAY['order_number','pharmacy_name','event_date','tracking_url','opt_out_url'],
'إشعار العميل بتسليم الطلب')
ON CONFLICT (id) DO NOTHING;

-- 2) Dispatch table: add nullable order_id ----------------------------
ALTER TABLE public.whatsapp_notification_dispatch
  ADD COLUMN IF NOT EXISTS order_id text;
CREATE INDEX IF NOT EXISTS wa_dispatch_order_idx
  ON public.whatsapp_notification_dispatch(order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

-- 3) Feature flags ----------------------------------------------------
INSERT INTO public.app_settings(key, value, description) VALUES
  ('order_notifications_enabled', 'true'::jsonb,
   'Per-domain switch for customer order state notifications (confirmed/shipped/delivered).'),
  ('whatsapp_tracking_base_url', '"https://muslly.com/track"'::jsonb,
   'Base URL used in order notification templates for tracking links.')
ON CONFLICT (key) DO NOTHING;

-- 4) Order event emitter ----------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_order_event(
  _order_id text,
  _event_name text,
  _correlation_id uuid DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_corr uuid := COALESCE(_correlation_id, gen_random_uuid());
  v_payload jsonb := COALESCE(_meta, '{}'::jsonb) || jsonb_build_object('order_id', _order_id);
BEGIN
  INSERT INTO public.agent_events(
    id, event_name, entity_type, entity_id, payload, source, correlation_id
  ) VALUES (
    v_event_id, _event_name, 'order', _order_id, v_payload, 'trigger', v_corr
  );
  RETURN v_event_id;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs(source, message, metadata)
  VALUES ('emit_order_event', SQLERRM,
          jsonb_build_object('event_name', _event_name, 'order_id', _order_id))
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_order_event(text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_order_event(text,text,uuid,jsonb) TO service_role;

-- 5) Status-change trigger on orders ----------------------------------
CREATE OR REPLACE FUNCTION public.emit_order_status_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_name text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  v_event_name := CASE lower(NEW.status)
    WHEN 'confirmed' THEN 'ORDER_CONFIRMED'
    WHEN 'shipped'   THEN 'ORDER_DISPATCHED'
    WHEN 'delivered' THEN 'ORDER_DELIVERED'
    ELSE NULL
  END;
  IF v_event_name IS NOT NULL THEN
    PERFORM public.emit_order_event(
      NEW.id, v_event_name, NULL,
      jsonb_build_object('previous_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs(source, message, metadata)
  VALUES ('emit_order_status_event', SQLERRM,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_order_status_event ON public.orders;
CREATE TRIGGER trg_emit_order_status_event
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.emit_order_status_event();

-- 6) Enqueue trigger for ORDER_* events -------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_customer_order_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_master boolean;
  v_orders_enabled boolean;
  v_order public.orders%ROWTYPE;
  v_phone text;
  v_norm text;
  v_pref public.customer_notification_preferences%ROWTYPE;
BEGIN
  IF NEW.event_name NOT IN ('ORDER_CONFIRMED','ORDER_DISPATCHED','ORDER_DELIVERED') THEN
    RETURN NEW;
  END IF;
  IF NEW.entity_id IS NULL THEN RETURN NEW; END IF;

  SELECT (value::text)::boolean INTO v_master
    FROM public.app_settings WHERE key = 'customer_whatsapp_enabled';
  SELECT (value::text)::boolean INTO v_orders_enabled
    FROM public.app_settings WHERE key = 'order_notifications_enabled';
  IF COALESCE(v_master,false) = false OR COALESCE(v_orders_enabled,false) = false THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = NEW.entity_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_phone := v_order.customer_phone;
  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN RETURN NEW; END IF;

  v_norm := regexp_replace(v_phone, '\D', '', 'g');
  IF v_norm LIKE '00%' THEN v_norm := substr(v_norm, 3); END IF;
  IF v_norm LIKE '0%' AND length(v_norm) = 10 THEN v_norm := '967' || substr(v_norm, 2); END IF;
  IF length(v_norm) = 9 THEN v_norm := '967' || v_norm; END IF;
  IF length(v_norm) < 9 THEN RETURN NEW; END IF;

  SELECT * INTO v_pref FROM public.customer_notification_preferences WHERE phone = v_norm;
  IF FOUND AND NOT v_pref.whatsapp_enabled THEN
    INSERT INTO public.whatsapp_notification_dispatch(
      event_id, event_name, correlation_id, order_id,
      recipient_phone, template_id, status, last_error
    ) VALUES (
      NEW.id, NEW.event_name, NEW.correlation_id, NEW.entity_id,
      v_norm, NEW.event_name, 'skipped', 'customer_opted_out'
    ) ON CONFLICT (event_id, recipient_phone) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_notification_preferences(phone)
  VALUES (v_norm) ON CONFLICT (phone) DO NOTHING;

  INSERT INTO public.whatsapp_notification_dispatch(
    event_id, event_name, correlation_id, order_id,
    recipient_phone, template_id
  ) VALUES (
    NEW.id, NEW.event_name, NEW.correlation_id, NEW.entity_id,
    v_norm, NEW.event_name
  ) ON CONFLICT (event_id, recipient_phone) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs(source, message, metadata)
  VALUES ('enqueue_customer_order_notification', SQLERRM,
          jsonb_build_object('event_id', NEW.id, 'event_name', NEW.event_name))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_order_notification ON public.agent_events;
CREATE TRIGGER trg_enqueue_customer_order_notification
AFTER INSERT ON public.agent_events
FOR EACH ROW
WHEN (NEW.event_name IN ('ORDER_CONFIRMED','ORDER_DISPATCHED','ORDER_DELIVERED'))
EXECUTE FUNCTION public.enqueue_customer_order_notification();
