-- Event bus table
CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_unprocessed
  ON public.agent_events (occurred_at DESC) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_events_name
  ON public.agent_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_entity
  ON public.agent_events (entity_type, entity_id);

GRANT SELECT ON public.agent_events TO authenticated;
GRANT ALL ON public.agent_events TO service_role;

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read agent_events" ON public.agent_events;
CREATE POLICY "admins read agent_events" ON public.agent_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Emit helper
CREATE OR REPLACE FUNCTION public.emit_agent_event(
  _event_name TEXT,
  _entity_type TEXT DEFAULT NULL,
  _entity_id TEXT DEFAULT NULL,
  _payload JSONB DEFAULT '{}'::jsonb,
  _source TEXT DEFAULT 'system'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload, source)
  VALUES (_event_name, _entity_type, _entity_id, COALESCE(_payload, '{}'::jsonb), COALESCE(_source, 'system'))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_event_processed(
  _event_id UUID,
  _processed_by TEXT DEFAULT 'system',
  _error TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_events
  SET processed_at = CASE WHEN _error IS NULL THEN now() ELSE processed_at END,
      processed_by = _processed_by,
      retry_count = CASE WHEN _error IS NULL THEN retry_count ELSE retry_count + 1 END,
      last_error = _error
  WHERE id = _event_id;
  RETURN FOUND;
END;
$$;

-- Wire prescriptions -> PrescriptionUploaded event
CREATE OR REPLACE FUNCTION public.emit_event_on_prescription_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.emit_agent_event(
      'PrescriptionUploaded',
      'prescription',
      NEW.id,
      jsonb_build_object(
        'customer_phone', NEW.customer_phone,
        'image_count', COALESCE(array_length(NEW.image_urls, 1), 0)
      ),
      'trigger'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.error_logs (source, message, metadata)
    VALUES ('emit_event_on_prescription_insert', SQLERRM, jsonb_build_object('rx_id', NEW.id))
    ON CONFLICT DO NOTHING;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_event_prescription ON public.prescriptions;
CREATE TRIGGER trg_emit_event_prescription
AFTER INSERT ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.emit_event_on_prescription_insert();

-- Wire orders -> OrderCreated event
CREATE OR REPLACE FUNCTION public.emit_event_on_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.emit_agent_event(
      'OrderCreated',
      'order',
      NEW.id::text,
      jsonb_build_object(
        'customer_phone', NEW.customer_phone,
        'total', NEW.total
      ),
      'trigger'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.error_logs (source, message, metadata)
    VALUES ('emit_event_on_order_insert', SQLERRM, jsonb_build_object('order_id', NEW.id))
    ON CONFLICT DO NOTHING;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_event_order ON public.orders;
CREATE TRIGGER trg_emit_event_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.emit_event_on_order_insert();

-- Unprocessed view
CREATE OR REPLACE VIEW public.unprocessed_agent_events AS
SELECT id, event_name, entity_type, entity_id, payload, source, occurred_at, retry_count, last_error
FROM public.agent_events
WHERE processed_at IS NULL
ORDER BY occurred_at DESC;

GRANT SELECT ON public.unprocessed_agent_events TO authenticated;
