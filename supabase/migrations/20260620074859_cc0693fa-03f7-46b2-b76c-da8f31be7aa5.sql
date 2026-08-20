
-- =====================================================================
-- Batch 5b — Event Bus consumer infrastructure (closes C2 + M2)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dead-letter table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_events_dlq (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id     UUID NOT NULL,
  event_name      TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  source          TEXT NOT NULL DEFAULT 'system',
  occurred_at     TIMESTAMPTZ NOT NULL,
  retry_count     INTEGER NOT NULL,
  last_error      TEXT,
  failed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_events_dlq_unresolved
  ON public.agent_events_dlq (failed_at DESC)
  WHERE resolved_at IS NULL;

GRANT SELECT, UPDATE ON public.agent_events_dlq TO authenticated;
GRANT ALL ON public.agent_events_dlq TO service_role;

ALTER TABLE public.agent_events_dlq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read dlq" ON public.agent_events_dlq;
CREATE POLICY "admins read dlq" ON public.agent_events_dlq
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins resolve dlq" ON public.agent_events_dlq;
CREATE POLICY "admins resolve dlq" ON public.agent_events_dlq
  FOR UPDATE TO authenticated
  USING  (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- ---------------------------------------------------------------------
-- 2. FIFO view (replaces LIFO ordering)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.unprocessed_agent_events;
CREATE VIEW public.unprocessed_agent_events AS
  SELECT id, event_name, entity_type, entity_id, payload, source,
         occurred_at, retry_count, last_error
    FROM public.agent_events
   WHERE processed_at IS NULL
   ORDER BY occurred_at ASC;   -- FIFO

GRANT SELECT ON public.unprocessed_agent_events TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Better unprocessed index (ASC, partial)
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_agent_events_unprocessed;
CREATE INDEX IF NOT EXISTS idx_agent_events_unprocessed_asc
  ON public.agent_events (occurred_at ASC)
  WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------
-- 4. claim_agent_events(_limit, _worker) — FIFO + SKIP LOCKED
-- Returns a batch of events claimed by this worker. The caller is
-- responsible for dispatching them and calling mark_event_processed /
-- fail_agent_event for each. We do NOT update processed_at here so a
-- crashed worker leaves rows visible to the next claim attempt.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_agent_events(
  _limit  INT  DEFAULT 25,
  _worker TEXT DEFAULT 'event-consumer'
)
RETURNS TABLE (
  id          UUID,
  event_name  TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  payload     JSONB,
  source      TEXT,
  occurred_at TIMESTAMPTZ,
  retry_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT e.id
      FROM public.agent_events e
     WHERE e.processed_at IS NULL
     ORDER BY e.occurred_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(_limit, 1)
  )
  SELECT e.id, e.event_name, e.entity_type, e.entity_id,
         e.payload, e.source, e.occurred_at, e.retry_count
    FROM public.agent_events e
    JOIN claimed c ON c.id = e.id
   ORDER BY e.occurred_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_events(int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_events(int, text) TO service_role;

-- ---------------------------------------------------------------------
-- 5. fail_agent_event — increments retry_count; moves to DLQ when over max
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fail_agent_event(
  _event_id    UUID,
  _processed_by TEXT,
  _error       TEXT,
  _max_retries INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.agent_events%ROWTYPE;
  new_count INT;
BEGIN
  SELECT * INTO ev FROM public.agent_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  new_count := COALESCE(ev.retry_count, 0) + 1;

  IF new_count >= _max_retries THEN
    INSERT INTO public.agent_events_dlq(
      original_id, event_name, entity_type, entity_id,
      payload, source, occurred_at, retry_count, last_error
    ) VALUES (
      ev.id, ev.event_name, ev.entity_type, ev.entity_id,
      ev.payload, ev.source, ev.occurred_at, new_count, _error
    );
    -- Mark processed so it leaves the live queue; DLQ owns it now.
    UPDATE public.agent_events
       SET processed_at = now(),
           processed_by = COALESCE(_processed_by,'dlq'),
           retry_count  = new_count,
           last_error   = _error
     WHERE id = _event_id;
    RETURN jsonb_build_object('ok', true, 'moved_to_dlq', true, 'retry_count', new_count);
  ELSE
    UPDATE public.agent_events
       SET retry_count = new_count,
           last_error  = _error,
           processed_by = _processed_by
     WHERE id = _event_id;
    RETURN jsonb_build_object('ok', true, 'moved_to_dlq', false, 'retry_count', new_count);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_agent_event(uuid, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_agent_event(uuid, text, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- 6. mark_event_processed already exists; ensure it's service_role only
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='mark_event_processed'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7. DLQ stats helper for admin dashboards
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_events_dlq_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INT; unresolved INT; oldest_age INTERVAL; by_name JSONB;
BEGIN
  SELECT COUNT(*) INTO total FROM public.agent_events_dlq;
  SELECT COUNT(*) INTO unresolved FROM public.agent_events_dlq WHERE resolved_at IS NULL;
  SELECT now() - MIN(failed_at) INTO oldest_age FROM public.agent_events_dlq WHERE resolved_at IS NULL;
  SELECT COALESCE(jsonb_object_agg(event_name, c),'{}'::jsonb) INTO by_name
    FROM (SELECT event_name, COUNT(*) c
            FROM public.agent_events_dlq
           WHERE resolved_at IS NULL
           GROUP BY event_name) s;
  RETURN jsonb_build_object(
    'total', total, 'unresolved', unresolved,
    'oldest_unresolved_seconds', EXTRACT(EPOCH FROM oldest_age),
    'by_event', by_name);
END;
$$;

REVOKE ALL ON FUNCTION public.agent_events_dlq_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_events_dlq_stats() TO authenticated, service_role;
