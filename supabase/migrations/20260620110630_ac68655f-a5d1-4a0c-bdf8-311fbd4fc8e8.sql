
-- =========================================================
-- Phase 4C — WhatsApp AI Foundation (read-only AI surface)
-- =========================================================

-- 1) whatsapp_conversations
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number    TEXT NOT NULL,
  customer_id     UUID,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','escalated','closed')),
  last_intent     TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
-- One open conversation per phone at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_convo_phone_open
  ON public.whatsapp_conversations (phone_number)
  WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_wa_convo_phone ON public.whatsapp_conversations (phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_convo_status ON public.whatsapp_conversations (status, last_message_at DESC);

GRANT SELECT ON public.whatsapp_conversations TO authenticated;
GRANT ALL    ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_convos_staff_read"
  ON public.whatsapp_conversations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'orders'::text)
  );

-- 2) whatsapp_messages
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id   TEXT,              -- Meta's wamid; null for outbound failures
  direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type    TEXT NOT NULL DEFAULT 'text',
  content         TEXT,
  status          TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','sent','delivered','read','failed')),
  intent          TEXT,
  agent_run_id    TEXT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_msg_wamid ON public.whatsapp_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_msg_convo ON public.whatsapp_messages (conversation_id, created_at DESC);

GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL    ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_msgs_staff_read"
  ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'orders'::text)
  );

-- 3) whatsapp_escalations
CREATE TABLE IF NOT EXISTS public.whatsapp_escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','taken','resolved')),
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_wa_esc_status ON public.whatsapp_escalations (status, created_at DESC);

GRANT SELECT, UPDATE ON public.whatsapp_escalations TO authenticated;
GRANT ALL ON public.whatsapp_escalations TO service_role;

ALTER TABLE public.whatsapp_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_esc_staff_read"
  ON public.whatsapp_escalations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'orders'::text)
  );
CREATE POLICY "wa_esc_staff_update"
  ON public.whatsapp_escalations
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'orders'::text)
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'orders'::text)
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_wa_convo_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_convo_touch ON public.whatsapp_conversations;
CREATE TRIGGER trg_wa_convo_touch
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_wa_convo_touch();

-- =========================================================
-- 4) Event publishing trigger — idempotent via correlation_id
-- =========================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_events_wa_message
  ON public.agent_events (entity_type, entity_id, event_name)
  WHERE source = 'whatsapp_ai';

CREATE OR REPLACE FUNCTION public.tg_publish_wa_message_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event TEXT;
BEGIN
  IF NEW.direction = 'inbound' THEN
    v_event := 'CUSTOMER_MESSAGE_RECEIVED';
  ELSE
    v_event := 'MESSAGE_SENT';
  END IF;

  INSERT INTO public.agent_events
    (event_name, entity_type, entity_id, payload, source, correlation_id)
  VALUES (
    v_event,
    'whatsapp_message',
    NEW.id::text,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'direction',       NEW.direction,
      'message_type',    NEW.message_type,
      'intent',          NEW.intent,
      'status',          NEW.status,
      'wa_message_id',   NEW.wa_message_id
    ),
    'whatsapp_ai',
    NEW.conversation_id
  )
  ON CONFLICT (entity_type, entity_id, event_name)
    WHERE source = 'whatsapp_ai' DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publish_wa_message_event ON public.whatsapp_messages;
CREATE TRIGGER trg_publish_wa_message_event
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_publish_wa_message_event();

CREATE OR REPLACE FUNCTION public.tg_publish_wa_escalation_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.agent_events
    (event_name, entity_type, entity_id, payload, source, correlation_id)
  VALUES (
    'CUSTOMER_ESCALATED',
    'whatsapp_escalation',
    NEW.id::text,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'reason',          NEW.reason,
      'status',          NEW.status
    ),
    'whatsapp_ai',
    NEW.conversation_id
  )
  ON CONFLICT (entity_type, entity_id, event_name)
    WHERE source = 'whatsapp_ai' DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publish_wa_escalation_event ON public.whatsapp_escalations;
CREATE TRIGGER trg_publish_wa_escalation_event
  AFTER INSERT ON public.whatsapp_escalations
  FOR EACH ROW EXECUTE FUNCTION public.tg_publish_wa_escalation_event();

-- =========================================================
-- 5) AI-only READ functions (no write surface)
--    Marked STABLE — Postgres rejects any write attempt.
-- =========================================================

CREATE OR REPLACE FUNCTION public.ai_search_products(
  _query TEXT,
  _limit INT DEFAULT 10
)
RETURNS TABLE(
  id          UUID,
  name        TEXT,
  brand       TEXT,
  category    TEXT,
  price       NUMERIC,
  in_stock    BOOLEAN,
  description TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.name, p.brand, p.category, p.price,
    (NOT p.track_stock OR p.stock_qty > 0) AS in_stock,
    p.description
  FROM public.products p
  WHERE p.is_published = true
    AND (
      _query IS NULL OR _query = ''
      OR p.name     ILIKE '%' || _query || '%'
      OR p.brand    ILIKE '%' || _query || '%'
      OR p.category ILIKE '%' || _query || '%'
    )
  ORDER BY
    CASE WHEN p.name ILIKE _query || '%' THEN 0 ELSE 1 END,
    p.sort_order, p.name
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 10), 25));
$$;

CREATE OR REPLACE FUNCTION public.ai_get_order_status(
  _order_id TEXT,
  _phone    TEXT
)
RETURNS TABLE(
  id              TEXT,
  status          TEXT,
  total           NUMERIC,
  created_at      TIMESTAMPTZ,
  item_count      INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id, o.status, o.total, o.created_at,
    COALESCE(jsonb_array_length(o.items), 0) AS item_count
  FROM public.orders o
  WHERE o.id = _order_id
    AND regexp_replace(o.customer_phone, '\D', '', 'g')
      = regexp_replace(COALESCE(_phone,''), '\D', '', 'g')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ai_list_branches()
RETURNS TABLE(
  id      UUID,
  code    TEXT,
  name    TEXT,
  address TEXT,
  phone   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.code, b.name, b.address, b.phone
  FROM public.branches b
  WHERE b.is_active = true
  ORDER BY b.name;
$$;

-- Lock down execution: ONLY service_role (webhook) can call these
REVOKE ALL ON FUNCTION public.ai_search_products(TEXT, INT)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_get_order_status(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_list_branches()              FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_search_products(TEXT, INT)   TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_get_order_status(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_list_branches()              TO service_role;

COMMENT ON FUNCTION public.ai_search_products(TEXT, INT) IS
  'Phase 4C: read-only AI tool. STABLE; no write path exposed.';
COMMENT ON FUNCTION public.ai_get_order_status(TEXT, TEXT) IS
  'Phase 4C: read-only AI tool. Requires matching phone for privacy.';
COMMENT ON FUNCTION public.ai_list_branches() IS
  'Phase 4C: read-only AI tool. Returns active branches only.';
