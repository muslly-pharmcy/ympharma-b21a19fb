
-- P3-GATE-03: Telemetry retention — add expires_at to agent_decisions
ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days');
CREATE INDEX IF NOT EXISTS idx_agent_decisions_expires ON public.agent_decisions(expires_at);

-- P3-GATE-04: Variant attribution — version fingerprints on social_posts
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS generation_version TEXT,
  ADD COLUMN IF NOT EXISTS ranking_version TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT;

-- P3-GATE-01: Confidence calibration log
CREATE TABLE IF NOT EXISTS public.confidence_calibration_log (
  id BIGSERIAL PRIMARY KEY,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_days INTEGER NOT NULL DEFAULT 7,
  sample_size INTEGER NOT NULL,
  correlation NUMERIC(6,4),
  mean_confidence NUMERIC(6,4),
  mean_engagement NUMERIC(10,2),
  drift NUMERIC(6,4),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  notes TEXT
);
GRANT SELECT ON public.confidence_calibration_log TO authenticated;
GRANT ALL ON public.confidence_calibration_log TO service_role;
ALTER TABLE public.confidence_calibration_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read calibration log" ON public.confidence_calibration_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_calibration_log_computed ON public.confidence_calibration_log(computed_at DESC);

-- P3-GATE-02: Feedback events with deduplication (external_id unique per post within 48h)
CREATE TABLE IF NOT EXISTS public.agent_feedback_events (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT,
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments INTEGER NOT NULL DEFAULT 0 CHECK (comments >= 0),
  shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0),
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  raw_payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_post_external
  ON public.agent_feedback_events(post_id, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_received ON public.agent_feedback_events(received_at DESC);
GRANT SELECT ON public.agent_feedback_events TO authenticated;
GRANT ALL ON public.agent_feedback_events TO service_role;
ALTER TABLE public.agent_feedback_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read feedback events" ON public.agent_feedback_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Aggregated insights (permanent — never expires)
CREATE TABLE IF NOT EXISTS public.agent_performance_insights (
  id BIGSERIAL PRIMARY KEY,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_days INTEGER NOT NULL DEFAULT 7,
  platform TEXT,
  sample_size INTEGER NOT NULL,
  avg_engagement NUMERIC(10,2),
  top_variant_id TEXT,
  top_tone TEXT,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT
);
GRANT SELECT ON public.agent_performance_insights TO authenticated;
GRANT ALL ON public.agent_performance_insights TO service_role;
ALTER TABLE public.agent_performance_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read insights" ON public.agent_performance_insights
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_insights_computed ON public.agent_performance_insights(computed_at DESC);

-- P3-GATE-03: Cleanup function
CREATE OR REPLACE FUNCTION public.clean_old_telemetry()
RETURNS TABLE(deleted_decisions INTEGER, deleted_feedback INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_count INTEGER;
  f_count INTEGER;
BEGIN
  DELETE FROM public.agent_decisions WHERE expires_at < now();
  GET DIAGNOSTICS d_count = ROW_COUNT;
  DELETE FROM public.agent_feedback_events WHERE expires_at < now();
  GET DIAGNOSTICS f_count = ROW_COUNT;
  RETURN QUERY SELECT d_count, f_count;
END;
$$;
