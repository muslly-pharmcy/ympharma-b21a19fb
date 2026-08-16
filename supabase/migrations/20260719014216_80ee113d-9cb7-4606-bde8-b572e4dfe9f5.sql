ALTER TABLE public.ai_events ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.ai_events ADD COLUMN IF NOT EXISTS source_event_id uuid;
CREATE INDEX IF NOT EXISTS ai_events_correlation_idx ON public.ai_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_events_source_event_uniq ON public.ai_events(source_event_id) WHERE source_event_id IS NOT NULL;
