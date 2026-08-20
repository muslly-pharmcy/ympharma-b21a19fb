-- ============================================================
-- Phase 6B Sprint 2: Standardized prescription event payloads
-- ============================================================

-- 1) Standard emitter ----------------------------------------------------------
-- Wraps emit_agent_event with the canonical payload + a deterministic
-- correlation_id derived from the prescription id (RX-<id>).
CREATE OR REPLACE FUNCTION public.emit_prescription_event(
  _event_name text,
  _prescription_id text,
  _actor_id text DEFAULT NULL,
  _actor_type text DEFAULT 'system',
  _order_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _source text DEFAULT 'system'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_corr     uuid := (md5('RX-' || _prescription_id))::uuid;
  v_payload  jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'event_id',        v_event_id,
    'correlation_id',  v_corr,
    'prescription_id', _prescription_id,
    'order_id',        _order_id,
    'actor_id',        _actor_id,
    'actor_type',      COALESCE(_actor_type, 'system'),
    'timestamp',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'metadata',        COALESCE(_metadata, '{}'::jsonb)
  );

  INSERT INTO public.agent_events(
    id, event_name, entity_type, entity_id, payload, source, correlation_id
  ) VALUES (
    v_event_id, _event_name, 'prescription', _prescription_id, v_payload, _source, v_corr
  );

  RETURN v_event_id;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.error_logs(source, message, metadata)
  VALUES ('emit_prescription_event', SQLERRM,
          jsonb_build_object('event_name', _event_name, 'prescription_id', _prescription_id))
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

-- Restrict to server-side roles only.
REVOKE ALL ON FUNCTION public.emit_prescription_event(text, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_prescription_event(text, text, text, text, text, jsonb, text) TO service_role;

-- 2) Insert trigger: emit PRESCRIPTION_UPLOADED + legacy alias ----------------
CREATE OR REPLACE FUNCTION public.emit_event_on_prescription_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb := jsonb_build_object(
    'customer_phone', NEW.customer_phone,
    'image_count', COALESCE(array_length(NEW.image_urls, 1), 0)
  );
BEGIN
  -- Canonical event
  PERFORM public.emit_prescription_event(
    'PRESCRIPTION_UPLOADED', NEW.id, NULL, 'customer', NULL, v_meta, 'trigger'
  );
  -- Legacy alias for any existing consumers (kept until next sprint)
  PERFORM public.emit_prescription_event(
    'PrescriptionUploaded', NEW.id, NULL, 'customer', NULL, v_meta, 'trigger'
  );
  RETURN NEW;
END;
$$;

-- 3) Review-requested trigger uses the new helper -----------------------------
CREATE OR REPLACE FUNCTION public.emit_prescription_review_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_prescription_event(
    'PRESCRIPTION_REVIEW_REQUESTED', NEW.id, NULL, 'system', NULL,
    jsonb_build_object(
      'customer_phone', NEW.customer_phone,
      'image_count', COALESCE(array_length(NEW.image_urls, 1), 0)
    ),
    'trigger'
  );
  RETURN NEW;
END;
$$;

-- 4) Minor schema groundwork for Sprint 3 -------------------------------------
-- A lightweight review_status on the registry so the review workflow can hook
-- into individual files without a second join later.
ALTER TABLE public.prescription_files
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending','approved','rejected','escalated'));

CREATE INDEX IF NOT EXISTS prescription_files_review_status_idx
  ON public.prescription_files (review_status);

-- 5) Document the canonical event vocabulary ----------------------------------
COMMENT ON FUNCTION public.emit_prescription_event(text, text, text, text, text, jsonb, text) IS
$DOC$Canonical emitter for prescription lifecycle events. Valid event_name values:
  PRESCRIPTION_UPLOADED
  PRESCRIPTION_REVIEW_REQUESTED
  PRESCRIPTION_ASSIGNED
  PRESCRIPTION_IN_REVIEW
  PRESCRIPTION_APPROVED
  PRESCRIPTION_REJECTED
  PRESCRIPTION_ESCALATED
  PRESCRIPTION_URL_GENERATED
Payload shape:
  { event_id, correlation_id, prescription_id, order_id, actor_id, actor_type, timestamp, metadata }
correlation_id is deterministic: md5('RX-'||prescription_id)::uuid$DOC$;
