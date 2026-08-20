
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
    WHEN 'REQUESTED'  THEN CASE WHEN NEW.from_status IS NULL THEN 'TRANSFER_CREATED' ELSE NULL END
    WHEN 'APPROVED'   THEN 'TRANSFER_APPROVED'
    WHEN 'RESERVED'   THEN 'TRANSFER_RESERVED'
    WHEN 'DISPATCHED' THEN 'TRANSFER_DISPATCHED'
    WHEN 'IN_TRANSIT' THEN 'TRANSFER_DISPATCHED'
    WHEN 'RECEIVED'   THEN 'TRANSFER_RECEIVED'
    WHEN 'COMPLETED'  THEN 'TRANSFER_RECEIVED'
    WHEN 'CANCELLED'  THEN 'TRANSFER_CANCELLED'
    WHEN 'REJECTED'   THEN 'TRANSFER_CANCELLED'
    ELSE NULL
  END;

  IF v_event IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id = NEW.transfer_id;

  INSERT INTO public.agent_events (
    event_name, entity_type, entity_id, payload, source, occurred_at
  ) VALUES (
    v_event, 'inventory_transfer', NEW.transfer_id::text,
    jsonb_build_object(
      'transfer_id', NEW.transfer_id,
      'correlation_id', v_transfer.correlation_id,
      'transfer_type', v_transfer.transfer_type,
      'source_branch_id', v_transfer.source_branch_id,
      'destination_branch_id', v_transfer.destination_branch_id,
      'from_status', NEW.from_status,
      'to_status', NEW.to_status,
      'actor_user_id', NEW.actor_user_id,
      'reason', NEW.reason
    ),
    'transfer_engine', NEW.created_at
  )
  ON CONFLICT (entity_type, entity_id, event_name) WHERE source = 'transfer_engine'
  DO NOTHING;

  RETURN NEW;
END;
$$;

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
    SELECT t.id, t.correlation_id, t.status::text AS status, t.transfer_type::text AS ttype, t.updated_at
    FROM public.inventory_transfers t
    WHERE t.status::text IN ('REQUESTED','APPROVED','RESERVED','PICKING','PACKED','DISPATCHED','IN_TRANSIT')
      AND t.updated_at < v_threshold
  LOOP
    v_age_hours := EXTRACT(EPOCH FROM (now() - r.updated_at)) / 3600.0;
    v_severity := CASE WHEN v_age_hours >= 72 THEN 'critical' WHEN v_age_hours >= 48 THEN 'high' ELSE 'medium' END;

    SELECT status INTO v_existing_status FROM public.operations_alerts
    WHERE dedupe_key = 'stale_transfer:' || r.id::text;

    IF v_existing_status IS NULL THEN
      INSERT INTO public.operations_alerts (kind, ref_id, summary, severity, dedupe_key, status, created_at)
      VALUES ('STALE_TRANSFER', r.id::text,
              format('Transfer %s stuck in %s for %.1fh (type=%s)', r.correlation_id, r.status, v_age_hours, r.ttype),
              v_severity, 'stale_transfer:' || r.id::text, 'open', now());
      v_created := v_created + 1;
    ELSIF v_existing_status = 'open' THEN
      UPDATE public.operations_alerts
      SET summary = format('Transfer %s stuck in %s for %.1fh (type=%s)', r.correlation_id, r.status, v_age_hours, r.ttype),
          severity = v_severity
      WHERE dedupe_key = 'stale_transfer:' || r.id::text;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  UPDATE public.operations_alerts oa
  SET status = 'resolved', resolved_at = now()
  WHERE oa.kind = 'STALE_TRANSFER' AND oa.status = 'open'
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_transfers t
      WHERE t.id::text = oa.ref_id
        AND t.status::text IN ('REQUESTED','APPROVED','RESERVED','PICKING','PACKED','DISPATCHED','IN_TRANSIT')
        AND t.updated_at < v_threshold
    );

  RETURN QUERY SELECT v_created, v_updated;
END;
$$;
