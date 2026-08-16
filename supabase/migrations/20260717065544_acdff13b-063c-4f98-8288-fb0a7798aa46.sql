
CREATE TABLE IF NOT EXISTS public.ai_neural_synaptic_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source text NOT NULL,
  target_destination text NOT NULL,
  decision_id text,
  is_safe boolean,
  district text,
  dispatched_tools text[] NOT NULL DEFAULT '{}',
  payload_transmitted jsonb NOT NULL,
  execution_time_ms numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_neural_synaptic_log TO authenticated;
GRANT ALL ON public.ai_neural_synaptic_log TO service_role;

ALTER TABLE public.ai_neural_synaptic_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY neural_log_self_read ON public.ai_neural_synaptic_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY neural_log_self_insert ON public.ai_neural_synaptic_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS ai_neural_log_user_created_idx
  ON public.ai_neural_synaptic_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_neural_log_district_created_idx
  ON public.ai_neural_synaptic_log (district, created_at DESC);
