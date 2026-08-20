CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  target_agent text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.ai_events TO authenticated;
GRANT ALL ON public.ai_events TO service_role;
ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_events admin read" ON public.ai_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_ai_events_status ON public.ai_events(status);
CREATE INDEX IF NOT EXISTS idx_ai_events_type ON public.ai_events(event_type);

CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.ai_events(id) ON DELETE SET NULL,
  agent_name text,
  decision_type text,
  reasoning jsonb,
  action jsonb,
  confidence numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.ai_decisions TO authenticated;
GRANT ALL ON public.ai_decisions TO service_role;
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_decisions admin read" ON public.ai_decisions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_ai_decisions_event ON public.ai_decisions(event_id);

-- seed blueprint agents into existing ai_agents (code/category schema)
INSERT INTO public.ai_agents (code, name, category, capabilities, event_subscriptions, enabled)
VALUES
  ('pharmacist_agent','AI Pharmacist Intelligence','medical','["prescription_analysis","drug_interaction"]'::jsonb, ARRAY['PRESCRIPTION_UPLOADED'], true),
  ('customer_agent','Customer Communication Agent','customer','["whatsapp","support"]'::jsonb, ARRAY['CUSTOMER_MESSAGE'], true)
ON CONFLICT (code) DO NOTHING;
