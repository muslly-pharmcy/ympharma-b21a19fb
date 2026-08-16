REVOKE EXECUTE ON FUNCTION public.emit_agent_event(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_event_processed(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_agent_event(TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_event_processed(UUID, TEXT, TEXT) TO authenticated, service_role;

DROP VIEW IF EXISTS public.unprocessed_agent_events;
CREATE VIEW public.unprocessed_agent_events
WITH (security_invoker = on) AS
SELECT id, event_name, entity_type, entity_id, payload, source, occurred_at, retry_count, last_error
FROM public.agent_events
WHERE processed_at IS NULL
ORDER BY occurred_at DESC;

GRANT SELECT ON public.unprocessed_agent_events TO authenticated;
