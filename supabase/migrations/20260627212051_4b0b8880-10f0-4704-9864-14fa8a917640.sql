
-- 1) DLQ correlation propagation
ALTER TABLE public.agent_events_dlq ADD COLUMN IF NOT EXISTS correlation_id uuid;
CREATE INDEX IF NOT EXISTS idx_agent_events_dlq_correlation ON public.agent_events_dlq(correlation_id);

-- 2) Backup verification runs history
CREATE TABLE IF NOT EXISTS public.backup_verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'cron',
  checked int NOT NULL DEFAULT 0,
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  freshness_ok boolean NOT NULL DEFAULT false,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_verification_runs TO authenticated;
GRANT ALL ON public.backup_verification_runs TO service_role;

ALTER TABLE public.backup_verification_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read backup_verification_runs"
  ON public.backup_verification_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_backup_verification_runs_ran_at
  ON public.backup_verification_runs(ran_at DESC);
