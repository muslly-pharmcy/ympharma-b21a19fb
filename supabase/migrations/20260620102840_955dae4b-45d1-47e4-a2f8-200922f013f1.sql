
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
  v_summary text;
BEGIN
  FOR r IN
    SELECT t.id, t.correlation_id, t.status::text AS status, t.transfer_type::text AS ttype, t.updated_at
    FROM public.inventory_transfers t
    WHERE t.status::text IN ('REQUESTED','APPROVED','RESERVED','PICKING','PACKED','DISPATCHED','IN_TRANSIT')
      AND t.updated_at < v_threshold
  LOOP
    v_age_hours := round(EXTRACT(EPOCH FROM (now() - r.updated_at)) / 3600.0, 1);
    v_severity := CASE WHEN v_age_hours >= 72 THEN 'critical' WHEN v_age_hours >= 48 THEN 'high' ELSE 'medium' END;
    v_summary := format('Transfer %s stuck in %s for %sh (type=%s)', r.correlation_id, r.status, v_age_hours, r.ttype);

    SELECT status INTO v_existing_status FROM public.operations_alerts
    WHERE dedupe_key = 'stale_transfer:' || r.id::text;

    IF v_existing_status IS NULL THEN
      INSERT INTO public.operations_alerts (kind, ref_id, summary, severity, dedupe_key, status, created_at)
      VALUES ('STALE_TRANSFER', r.id::text, v_summary, v_severity, 'stale_transfer:' || r.id::text, 'open', now());
      v_created := v_created + 1;
    ELSIF v_existing_status = 'open' THEN
      UPDATE public.operations_alerts SET summary = v_summary, severity = v_severity
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
