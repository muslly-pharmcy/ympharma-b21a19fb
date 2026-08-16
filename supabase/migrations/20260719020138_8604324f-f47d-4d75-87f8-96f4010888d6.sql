
-- v4.0 gap closure: mirror backfill + dispatch tracking (cast fix)

INSERT INTO public.ai_events (
  event_type, source, payload, priority, status,
  target_agent, error_message, correlation_id, source_event_id,
  processed_at, created_at
)
SELECT
  event_name,
  COALESCE(source, 'event-consumer'),
  COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
    '_mirror', jsonb_build_object(
      'agent_event_id', id,
      'entity_type', entity_type,
      'entity_id', entity_id,
      'note', 'backfill'
    )
  ),
  'normal',
  CASE WHEN processed_at IS NOT NULL AND last_error IS NULL THEN 'completed'
       WHEN last_error IS NOT NULL THEN 'failed'
       ELSE 'completed' END,
  processed_by,
  last_error,
  correlation_id,
  id,
  COALESCE(processed_at, created_at),
  created_at
FROM public.agent_events
WHERE processed_at IS NOT NULL OR last_error IS NOT NULL
ON CONFLICT (source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_ai_agent_dispatched_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.ai_agents
     SET last_dispatched_at = COALESCE(NEW.finished_at, NEW.started_at, NEW.created_at, now())
   WHERE code = NEW.agent::text;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_ai_agent_dispatched_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_touch_ai_agent_dispatched_at ON public.agent_runs;
CREATE TRIGGER trg_touch_ai_agent_dispatched_at
  AFTER INSERT ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_agent_dispatched_at();

UPDATE public.ai_agents a
   SET last_dispatched_at = r.latest
  FROM (
    SELECT agent::text AS agent_code,
           MAX(COALESCE(finished_at, started_at, created_at)) AS latest
      FROM public.agent_runs GROUP BY agent
  ) r
 WHERE a.code = r.agent_code
   AND (a.last_dispatched_at IS NULL OR a.last_dispatched_at < r.latest);
