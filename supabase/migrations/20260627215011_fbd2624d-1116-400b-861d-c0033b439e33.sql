
ALTER TABLE public.agent_approval_requests
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_risk_score integer,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ai_safety_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('pii_detected','injection_attempt','sanitized','blocked')),
  context text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_safety_logs TO authenticated;
GRANT ALL ON public.ai_safety_logs TO service_role;

ALTER TABLE public.ai_safety_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read safety logs"
  ON public.ai_safety_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS idx_ai_safety_logs_created ON public.ai_safety_logs(created_at DESC);
