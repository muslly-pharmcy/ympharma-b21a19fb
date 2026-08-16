
-- ============================================================
-- Phase 6C — Customer WhatsApp Notifications (Sprints 1–4)
-- ============================================================

-- 1) Customizable templates ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_templates (
  id text PRIMARY KEY,
  event_name text NOT NULL UNIQUE,
  body_template text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_notification_templates TO authenticated;
GRANT ALL ON public.whatsapp_notification_templates TO service_role;
ALTER TABLE public.whatsapp_notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa_tpl read auth" ON public.whatsapp_notification_templates;
CREATE POLICY "wa_tpl read auth" ON public.whatsapp_notification_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "wa_tpl admin write" ON public.whatsapp_notification_templates;
CREATE POLICY "wa_tpl admin write" ON public.whatsapp_notification_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

INSERT INTO public.whatsapp_notification_templates(id, event_name, body_template, variables, description) VALUES
('PRESCRIPTION_APPROVED','PRESCRIPTION_APPROVED',
E'🏥 *{{pharmacy_name}}*\n\nتمت مراجعة الروشتة الخاصة بطلبك ✅\n\n🆔 رقم الطلب: *{{order_number}}*\n📅 تاريخ المراجعة: {{review_date}}\n\nتم اعتماد الروشتة ويمكن متابعة تجهيز الطلب.\n\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
ARRAY['order_number','pharmacy_name','review_date','opt_out_url'],
'إشعار العميل بقبول الروشتة'),
('PRESCRIPTION_REJECTED','PRESCRIPTION_REJECTED',
E'🏥 *{{pharmacy_name}}*\n\nتعذر اعتماد الروشتة الخاصة بطلبك ⚠️\n\n🆔 رقم الطلب: *{{order_number}}*\n📅 التاريخ: {{review_date}}\n\nيرجى رفع صورة أوضح أو التواصل مع الصيدلية.\n\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
ARRAY['order_number','pharmacy_name','review_date','opt_out_url'],
'إشعار العميل برفض الروشتة'),
('PRESCRIPTION_ESCALATED','PRESCRIPTION_ESCALATED',
E'🏥 *{{pharmacy_name}}*\n\nتحتاج الروشتة الخاصة بطلبك إلى مراجعة إضافية من الصيدلي 👨‍⚕️\n\n🆔 رقم الطلب: *{{order_number}}*\n📅 التاريخ: {{review_date}}\n\nسنقوم بإبلاغك فور اكتمال المراجعة.\n\n🔕 لإلغاء الاشتراك: {{opt_out_url}}',
ARRAY['order_number','pharmacy_name','review_date','opt_out_url'],
'إشعار العميل بتصعيد الروشتة')
ON CONFLICT (id) DO NOTHING;

-- 2) Customer preferences -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
  phone text PRIMARY KEY,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  prescription_notifications_enabled boolean NOT NULL DEFAULT true,
  opt_out_token text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex') UNIQUE,
  last_opt_out_at timestamptz,
  last_opt_in_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_notification_preferences TO authenticated;
GRANT ALL ON public.customer_notification_preferences TO service_role;
ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cust_pref admin all" ON public.customer_notification_preferences;
CREATE POLICY "cust_pref admin all" ON public.customer_notification_preferences
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS cust_pref_token_idx
  ON public.customer_notification_preferences(opt_out_token);

-- 3) Dispatch table (idempotent, retry-safe) ----------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  event_name text NOT NULL,
  correlation_id uuid,
  prescription_id text,
  recipient_phone text NOT NULL,
  template_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed','dead','skipped')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  wamid text,
  sent_at timestamptz,
  duration_ms int,
  rendered_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_dispatch_unique UNIQUE (event_id, recipient_phone)
);
GRANT SELECT ON public.whatsapp_notification_dispatch TO authenticated;
GRANT ALL  ON public.whatsapp_notification_dispatch TO service_role;
ALTER TABLE public.whatsapp_notification_dispatch ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa_dispatch admin read" ON public.whatsapp_notification_dispatch;
CREATE POLICY "wa_dispatch admin read" ON public.whatsapp_notification_dispatch
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS wa_dispatch_due_idx
  ON public.whatsapp_notification_dispatch(status, next_attempt_at)
  WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS wa_dispatch_corr_idx
  ON public.whatsapp_notification_dispatch(correlation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_dispatch_rx_idx
  ON public.whatsapp_notification_dispatch(prescription_id, created_at DESC);

-- 4) Feature flags ------------------------------------------------------------
INSERT INTO public.app_settings(key, value, description) VALUES
  ('customer_whatsapp_enabled', 'false'::jsonb,
   'Master kill switch for customer-facing WhatsApp notifications (Phase 6C). Default off until templates verified.'),
  ('prescription_notifications_enabled', 'true'::jsonb,
   'Per-domain switch for customer prescription state notifications.'),
  ('whatsapp_max_retry_attempts', '5'::jsonb,
   'Max retry attempts before a dispatch is marked dead.'),
  ('whatsapp_retry_base_seconds', '30'::jsonb,
   'Exponential backoff base (seconds): backoff = base * 2^attempts.'),
  ('whatsapp_pharmacy_name', '"صيدلية المصلي"'::jsonb,
   'Pharmacy display name used in customer notification templates.'),
  ('whatsapp_opt_out_base_url', '"https://muslly.com/notifications"'::jsonb,
   'Base URL used for opt-out links inside templates.')
ON CONFLICT (key) DO NOTHING;

-- 5) Enqueue trigger ----------------------------------------------------------
-- Translates lifecycle events into dispatch rows. Idempotent via UNIQUE
-- (event_id, recipient_phone): re-emitting the same event never duplicates.
CREATE OR REPLACE FUNCTION public.enqueue_customer_rx_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master boolean;
  v_rx_enabled boolean;
  v_rx public.prescriptions%ROWTYPE;
  v_phone text;
  v_norm text;
  v_pref public.customer_notification_preferences%ROWTYPE;
BEGIN
  IF NEW.event_name NOT IN ('PRESCRIPTION_APPROVED','PRESCRIPTION_REJECTED','PRESCRIPTION_ESCALATED') THEN
    RETURN NEW;
  END IF;
  IF NEW.entity_id IS NULL THEN RETURN NEW; END IF;

  SELECT (value::text)::boolean INTO v_master
    FROM public.app_settings WHERE key = 'customer_whatsapp_enabled';
  SELECT (value::text)::boolean INTO v_rx_enabled
    FROM public.app_settings WHERE key = 'prescription_notifications_enabled';
  IF COALESCE(v_master,false) = false OR COALESCE(v_rx_enabled,false) = false THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rx FROM public.prescriptions WHERE id = NEW.entity_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_phone := v_rx.customer_phone;
  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN RETURN NEW; END IF;

  v_norm := regexp_replace(v_phone, '\D', '', 'g');
  IF v_norm LIKE '00%' THEN v_norm := substr(v_norm, 3); END IF;
  IF v_norm LIKE '0%' AND length(v_norm) = 10 THEN v_norm := '967' || substr(v_norm, 2); END IF;
  IF length(v_norm) = 9 THEN v_norm := '967' || v_norm; END IF;
  IF length(v_norm) < 9 THEN RETURN NEW; END IF;

  SELECT * INTO v_pref FROM public.customer_notification_preferences WHERE phone = v_norm;
  IF FOUND AND (NOT v_pref.whatsapp_enabled OR NOT v_pref.prescription_notifications_enabled) THEN
    INSERT INTO public.whatsapp_notification_dispatch(
      event_id, event_name, correlation_id, prescription_id,
      recipient_phone, template_id, status, last_error
    ) VALUES (
      NEW.id, NEW.event_name, NEW.correlation_id, NEW.entity_id,
      v_norm, NEW.event_name, 'skipped', 'customer_opted_out'
    ) ON CONFLICT (event_id, recipient_phone) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Ensure a preferences row exists so the opt-out token can be referenced.
  INSERT INTO public.customer_notification_preferences(phone)
  VALUES (v_norm)
  ON CONFLICT (phone) DO NOTHING;

  INSERT INTO public.whatsapp_notification_dispatch(
    event_id, event_name, correlation_id, prescription_id,
    recipient_phone, template_id
  ) VALUES (
    NEW.id, NEW.event_name, NEW.correlation_id, NEW.entity_id,
    v_norm, NEW.event_name
  ) ON CONFLICT (event_id, recipient_phone) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs(source, message, metadata)
  VALUES ('enqueue_customer_rx_notification', SQLERRM,
          jsonb_build_object('event_id', NEW.id, 'event_name', NEW.event_name))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_rx_notification ON public.agent_events;
CREATE TRIGGER trg_enqueue_customer_rx_notification
AFTER INSERT ON public.agent_events
FOR EACH ROW
WHEN (NEW.event_name IN ('PRESCRIPTION_APPROVED','PRESCRIPTION_REJECTED','PRESCRIPTION_ESCALATED'))
EXECUTE FUNCTION public.enqueue_customer_rx_notification();

-- 6) Claim function (FIFO + SKIP LOCKED) --------------------------------------
CREATE OR REPLACE FUNCTION public.claim_customer_rx_notifications(_limit int DEFAULT 25)
RETURNS SETOF public.whatsapp_notification_dispatch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.whatsapp_notification_dispatch d
     SET status      = 'sending',
         attempts    = d.attempts + 1,
         updated_at  = now()
   WHERE d.id IN (
     SELECT id FROM public.whatsapp_notification_dispatch
      WHERE status IN ('pending','failed')
        AND attempts < max_attempts
        AND next_attempt_at <= now()
      ORDER BY next_attempt_at
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(_limit, 1)
   )
   RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_customer_rx_notifications(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_rx_notifications(int) TO service_role;

-- 7) Mark functions -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_customer_rx_notification_sent(
  _id uuid, _wamid text, _duration_ms int, _rendered_body text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.whatsapp_notification_dispatch
     SET status='sent', wamid=_wamid, sent_at=now(),
         duration_ms=_duration_ms, rendered_body=_rendered_body,
         last_error=NULL, updated_at=now()
   WHERE id=_id;
$$;
REVOKE ALL ON FUNCTION public.mark_customer_rx_notification_sent(uuid,text,int,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_rx_notification_sent(uuid,text,int,text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_customer_rx_notification_failed(
  _id uuid, _error text, _base_seconds int DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.whatsapp_notification_dispatch%ROWTYPE;
  v_dead boolean := false;
  v_backoff int;
BEGIN
  SELECT * INTO v_row FROM public.whatsapp_notification_dispatch WHERE id=_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;

  IF v_row.attempts >= v_row.max_attempts THEN
    v_dead := true;
    UPDATE public.whatsapp_notification_dispatch
       SET status='dead', last_error=_error, updated_at=now()
     WHERE id=_id;
    INSERT INTO public.operations_alerts(
      alert_type, severity, message, payload, status
    ) VALUES (
      'WHATSAPP_DELIVERY_FAILED', 'high',
      'Customer WhatsApp notification exhausted retries',
      jsonb_build_object(
        'dispatch_id', _id,
        'event_name', v_row.event_name,
        'recipient_phone', v_row.recipient_phone,
        'prescription_id', v_row.prescription_id,
        'correlation_id', v_row.correlation_id,
        'attempts', v_row.attempts,
        'last_error', _error
      ), 'open'
    );
  ELSE
    v_backoff := GREATEST(_base_seconds, 1) * (2 ^ v_row.attempts)::int;
    UPDATE public.whatsapp_notification_dispatch
       SET status='failed', last_error=_error,
           next_attempt_at = now() + make_interval(secs => v_backoff),
           updated_at=now()
     WHERE id=_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'dead',v_dead,'attempts',v_row.attempts);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_customer_rx_notification_failed(uuid,text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_rx_notification_failed(uuid,text,int) TO service_role;

-- 8) Monitoring view ----------------------------------------------------------
CREATE OR REPLACE VIEW public.whatsapp_notification_health AS
SELECT
  date_trunc('hour', created_at) AS hour,
  event_name,
  status,
  count(*)::int                       AS cnt,
  avg(NULLIF(duration_ms,0))::int     AS avg_duration_ms,
  avg(attempts)::numeric(5,2)         AS avg_attempts,
  max(attempts)::int                  AS max_attempts_seen,
  count(*) FILTER (WHERE status='dead')::int AS dead_cnt
FROM public.whatsapp_notification_dispatch
WHERE created_at > now() - interval '7 days'
GROUP BY 1,2,3;
GRANT SELECT ON public.whatsapp_notification_health TO authenticated;

-- 9) Opt-out helpers (RPC, callable from anon for the public unsubscribe page)
CREATE OR REPLACE FUNCTION public.customer_notification_set_optout(_token text, _opt_out boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.customer_notification_preferences%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  SELECT * INTO v_row FROM public.customer_notification_preferences WHERE opt_out_token=_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _opt_out THEN
    UPDATE public.customer_notification_preferences
       SET whatsapp_enabled=false,
           prescription_notifications_enabled=false,
           last_opt_out_at=now(),
           updated_at=now()
     WHERE phone=v_row.phone;
  ELSE
    UPDATE public.customer_notification_preferences
       SET whatsapp_enabled=true,
           prescription_notifications_enabled=true,
           last_opt_in_at=now(),
           updated_at=now()
     WHERE phone=v_row.phone;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'phone_suffix', right(v_row.phone, 4),
    'opted_out', _opt_out
  );
END;
$$;
REVOKE ALL ON FUNCTION public.customer_notification_set_optout(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_notification_set_optout(text,boolean) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.customer_notification_get_status(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.customer_notification_preferences%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  SELECT * INTO v_row FROM public.customer_notification_preferences WHERE opt_out_token=_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'phone_suffix', right(v_row.phone, 4),
    'whatsapp_enabled', v_row.whatsapp_enabled,
    'prescription_notifications_enabled', v_row.prescription_notifications_enabled
  );
END;
$$;
REVOKE ALL ON FUNCTION public.customer_notification_get_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_notification_get_status(text) TO anon, authenticated, service_role;

-- 10) Updated_at trigger ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wa_tpl_touch ON public.whatsapp_notification_templates;
CREATE TRIGGER trg_wa_tpl_touch BEFORE UPDATE ON public.whatsapp_notification_templates
FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cust_pref_touch ON public.customer_notification_preferences;
CREATE TRIGGER trg_cust_pref_touch BEFORE UPDATE ON public.customer_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();
