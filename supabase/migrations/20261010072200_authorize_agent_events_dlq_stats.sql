-- Restrict operational DLQ statistics to existing authorized operators.
--
-- The function was already EXECUTE-granted to authenticated users, but unlike
-- the adjacent agent_runs_list() RPC it did not check an application role.
-- Keep trusted server-role access while requiring the established operator
-- predicate for normal authenticated callers.
CREATE OR REPLACE FUNCTION public.agent_events_dlq_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total INT;
  unresolved INT;
  oldest_age INTERVAL;
  by_name JSONB;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public._intel_can_manage() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO total FROM public.agent_events_dlq;
  SELECT COUNT(*) INTO unresolved
    FROM public.agent_events_dlq
   WHERE resolved_at IS NULL;
  SELECT now() - MIN(failed_at) INTO oldest_age
    FROM public.agent_events_dlq
   WHERE resolved_at IS NULL;
  SELECT COALESCE(jsonb_object_agg(event_name, c), '{}'::jsonb) INTO by_name
    FROM (
      SELECT event_name, COUNT(*) AS c
        FROM public.agent_events_dlq
       WHERE resolved_at IS NULL
       GROUP BY event_name
    ) s;

  RETURN jsonb_build_object(
    'total', total,
    'unresolved', unresolved,
    'oldest_unresolved_seconds', EXTRACT(EPOCH FROM oldest_age),
    'by_event', by_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.agent_events_dlq_stats()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_events_dlq_stats()
  TO authenticated, service_role;
