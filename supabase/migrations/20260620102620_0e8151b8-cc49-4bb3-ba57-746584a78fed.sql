
-- Phase 4A: Transfer Events Bus + Operations Alerts

-- 1) Idempotency index for transfer lifecycle events
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_events_transfer_lifecycle
  ON public.agent_events (entity_type, entity_id, event_name)
  WHERE source = 'transfer_engine';

-- 2) Trigger: publish 6 lifecycle events from transfer_audit_log
CREATE OR REPLACE FUNCTION public.publish_transfer_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_transfer public.inventory_transfers%ROWTYPE;
BEGIN
  v_event := CASE NEW.to_status::text
    WHEN 'PENDING'    THEN CASE WHEN NEW.from_status IS NULL THEN 'TRANSFER_CREATED' ELSE NULL END
    WHEN 'APPROVED'   THEN 'TRANSFER_APPROVED'
    WHEN 'RESERVED'   THEN 'TRANSFER_RESERVED'
    WHEN 'DISPATCHED' THEN 'TRANSFER_DISPATCHED'
    WHEN 'RECEIVED'   THEN 'TRANSFER_RECEIVED'
    WHEN 'COMPLETED'  THEN 'TRANSFER_RECEIVED'
    WHEN 'CANCELLED'  THEN 'TRANSFER_CANCELLED'
    ELSE NULL
  END;

  IF v_event IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id = NEW.transfer_id;

  INSERT INTO public.agent_events (
    event_name, entity_type, entity_id, payload, source, correlation_id, occurred_at
  ) VALUES (
    v_event,
    'inventory_transfer',
    NEW.transfer_id::text,
    jsonb_build_object(
      'transfer_id',          NEW.transfer_id,
      'correlation_id',       v_transfer.correlation_id,
      'transfer_type',        v_transfer.transfer_type,
      'source_branch_id',     v_transfer.source_branch_id,
      'destination_branch_id', v_transfer.destination_branch_id,
      'from_status',          NEW.from_status,
      'to_status',            NEW.to_status,
      'actor_user_id',        NEW.actor_user_id,
      'reason',               NEW.reason,
      'audit_metadata',       NEW.metadata
    ),
    'transfer_engine',
    NULL,
    NEW.created_at
  )
  ON CONFLICT (entity_type, entity_id, event_name) WHERE source = 'transfer_engine'
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publish_transfer_event ON public.transfer_audit_log;
CREATE TRIGGER trg_publish_transfer_event
  AFTER INSERT ON public.transfer_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.publish_transfer_event();

-- 3) Backfill: emit TRANSFER_CREATED for existing transfers (idempotent via unique index)
INSERT INTO public.agent_events (event_name, entity_type, entity_id, payload, source, occurred_at)
SELECT
  'TRANSFER_CREATED',
  'inventory_transfer',
  t.id::text,
  jsonb_build_object(
    'transfer_id', t.id,
    'correlation_id', t.correlation_id,
    'transfer_type', t.transfer_type,
    'source_branch_id', t.source_branch_id,
    'destination_branch_id', t.destination_branch_id,
    'status', t.status,
    'backfilled', true
  ),
  'transfer_engine',
  t.created_at
FROM public.inventory_transfers t
ON CONFLICT (entity_type, entity_id, event_name) WHERE source = 'transfer_engine'
DO NOTHING;

-- 4) Stale transfer detector → operations_alerts (dedup via dedupe_key)
CREATE OR REPLACE FUNCTION public.detect_stale_transfers(_stale_minutes int DEFAULT 1440)
RETURNS TABLE(alerts_created int, alerts_updated int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created int := 0;
  v_updated int := 0;
  v_threshold timestamptz := now() - make_interval(mins => _stale_minutes);
  r record;
  v_existing_status text;
  v_severity text;
  v_age_hours numeric;
BEGIN
  FOR r IN
    SELECT t.id, t.correlation_id, t.status::text AS status, t.transfer_type::text AS ttype,
           t.source_branch_id, t.destination_branch_id, t.updated_at, t.created_at
    FROM public.inventory_transfers t
    WHERE t.status::text IN ('PENDING','APPROVED','RESERVED','PICKING','PACKED','DISPATCHED')
      AND t.updated_at < v_threshold
  LOOP
    v_age_hours := EXTRACT(EPOCH FROM (now() - r.updated_at)) / 3600.0;
    v_severity := CASE
      WHEN v_age_hours >= 72 THEN 'critical'
      WHEN v_age_hours >= 48 THEN 'high'
      ELSE 'medium'
    END;

    SELECT status INTO v_existing_status
    FROM public.operations_alerts
    WHERE dedupe_key = 'stale_transfer:' || r.id::text;

    IF v_existing_status IS NULL THEN
      INSERT INTO public.operations_alerts (
        kind, ref_id, summary, severity, dedupe_key, status, created_at
      ) VALUES (
        'STALE_TRANSFER',
        r.id::text,
        format('Transfer %s stuck in %s for %.1fh (type=%s)', r.correlation_id, r.status, v_age_hours, r.ttype),
        v_severity,
        'stale_transfer:' || r.id::text,
        'open',
        now()
      );
      v_created := v_created + 1;
    ELSIF v_existing_status = 'open' THEN
      UPDATE public.operations_alerts
      SET summary = format('Transfer %s stuck in %s for %.1fh (type=%s)', r.correlation_id, r.status, v_age_hours, r.ttype),
          severity = v_severity
      WHERE dedupe_key = 'stale_transfer:' || r.id::text;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  -- auto-resolve alerts whose transfer is no longer stale
  UPDATE public.operations_alerts oa
  SET status = 'resolved', resolved_at = now()
  WHERE oa.kind = 'STALE_TRANSFER'
    AND oa.status = 'open'
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_transfers t
      WHERE t.id::text = oa.ref_id
        AND t.status::text IN ('PENDING','APPROVED','RESERVED','PICKING','PACKED','DISPATCHED')
        AND t.updated_at < v_threshold
    );

  RETURN QUERY SELECT v_created, v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_stale_transfers(int) TO service_role, authenticated;

-- 5) Cron: scan every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('detect-stale-transfers');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'detect-stale-transfers',
  '*/15 * * * *',
  $cron$ SELECT public.detect_stale_transfers(1440); $cron$
);
