CREATE TABLE IF NOT EXISTS public.whatsapp_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('message', 'status')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT,
  phone_number_id TEXT,
  payload JSONB NOT NULL,
  correlation_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_events TO authenticated;
GRANT ALL ON public.whatsapp_events TO service_role;

ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_events admins read"
  ON public.whatsapp_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_created_at
  ON public.whatsapp_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_from_number
  ON public.whatsapp_events (from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_event_type
  ON public.whatsapp_events (event_type, created_at DESC);