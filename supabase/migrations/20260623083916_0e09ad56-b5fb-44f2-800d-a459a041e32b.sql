-- Telemetry + explainability table
CREATE TABLE public.agent_decisions (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_score NUMERIC(6,4),
  product_breakdown JSONB,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  winner_variant_id TEXT,
  confidence_score NUMERIC(5,4),
  decision_summary TEXT,
  decision_factors JSONB,
  context_snapshot JSONB,
  context_ms INT,
  decision_ms INT,
  generation_ms INT,
  ranking_ms INT,
  total_ms INT,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.agent_decisions TO authenticated;
GRANT ALL ON public.agent_decisions TO service_role;

ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read agent_decisions" ON public.agent_decisions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX idx_agent_decisions_post ON public.agent_decisions(post_id);
CREATE INDEX idx_agent_decisions_created ON public.agent_decisions(created_at DESC);

-- Extend social_posts with variant metadata
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS variant_id TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4);

-- Feature flags (idempotent)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('agent.context_provider.enabled', 'true'::jsonb, 'تفعيل طبقة السياق (Phase 2) لإثراء توليد المحتوى'),
  ('agent.multi_variant.enabled', 'true'::jsonb, 'توليد 3 نماذج بديلة واختيار الأفضل')
ON CONFLICT (key) DO NOTHING;
