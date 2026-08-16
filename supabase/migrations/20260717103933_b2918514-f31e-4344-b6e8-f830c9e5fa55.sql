-- ☀️ AI SUN CORE Phase 1: Agent Registry + Neural Memory + Decisions Log

-- 1) AI Agents registry
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_subscriptions TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  health TEXT NOT NULL DEFAULT 'healthy',
  last_dispatched_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read agents"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 2) Sun Decisions log
CREATE TABLE public.sun_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  event_name TEXT NOT NULL,
  agent_dispatched TEXT,
  decision JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,2),
  reasoning TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending',
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sun_decisions_created ON public.sun_decisions (created_at DESC);
CREATE INDEX idx_sun_decisions_event ON public.sun_decisions (event_name);
GRANT SELECT ON public.sun_decisions TO authenticated;
GRANT ALL ON public.sun_decisions TO service_role;
ALTER TABLE public.sun_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read decisions"
  ON public.sun_decisions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 3) Neural memory (key-value with weight)
CREATE TABLE public.sun_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, subject_id, key)
);
CREATE INDEX idx_sun_memory_lookup ON public.sun_memory (scope, subject_id);
GRANT SELECT ON public.sun_memory TO authenticated;
GRANT ALL ON public.sun_memory TO service_role;
ALTER TABLE public.sun_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read memory"
  ON public.sun_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.sun_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ai_agents_updated BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.sun_touch_updated_at();
CREATE TRIGGER trg_sun_memory_updated BEFORE UPDATE ON public.sun_memory
  FOR EACH ROW EXECUTE FUNCTION public.sun_touch_updated_at();

-- Seed 5 core agents
INSERT INTO public.ai_agents (code, name, category, capabilities, event_subscriptions) VALUES
  ('pharmacist', 'AI Pharmacist Agent', 'medical',
    '["prescription_review","drug_interaction","dosage_check","alt_suggest"]'::jsonb,
    ARRAY['PrescriptionUploaded','PrescriptionReviewRequested']),
  ('inventory', 'Inventory Intelligence Agent', 'inventory',
    '["demand_forecast","restock_alert","stale_detect"]'::jsonb,
    ARRAY['STOCK_RECEIVED','STOCK_MOVEMENT_CREATED','EXPIRY_ALERT_CREATED']),
  ('revenue', 'Revenue Agent', 'commercial',
    '["price_optimize","offer_builder","margin_analyze"]'::jsonb,
    ARRAY['OrderCreated','OrderCompleted']),
  ('customer_galaxy', 'Customer Galaxy Agent', 'customer',
    '["whatsapp_reply","smart_upsell","follow_up"]'::jsonb,
    ARRAY['WhatsAppInbound','CustomerInquiry']),
  ('security_guardian', 'Security Guardian Agent', 'security',
    '["intrusion_detect","behavior_analyze","data_protect"]'::jsonb,
    ARRAY['SecurityAlert','AuthAnomaly']);
