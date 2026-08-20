
CREATE TABLE IF NOT EXISTS public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  memory_type text NOT NULL CHECK (memory_type IN ('short','long','experience','knowledge')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  importance numeric NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_memory TO authenticated;
GRANT ALL ON public.ai_memory TO service_role;

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_memory admin read"
  ON public.ai_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS idx_ai_memory_agent_importance
  ON public.ai_memory (agent_name, importance DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memory_expires
  ON public.ai_memory (expires_at) WHERE expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ai_memory_updated_at ON public.ai_memory;
CREATE TRIGGER trg_ai_memory_updated_at
  BEFORE UPDATE ON public.ai_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES public.ai_decisions(id) ON DELETE CASCADE,
  rating numeric NOT NULL CHECK (rating BETWEEN -1 AND 1),
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_feedback TO authenticated;
GRANT ALL ON public.ai_feedback TO service_role;

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_feedback admin read"
  ON public.ai_feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "ai_feedback admin insert"
  ON public.ai_feedback FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS idx_ai_feedback_decision
  ON public.ai_feedback (decision_id, created_at DESC);
