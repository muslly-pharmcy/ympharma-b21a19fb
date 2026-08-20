-- AUDIT-P2-003 + DB-P3-004 — Admin audit log + hot-path composite indexes.

-- 1. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  result TEXT NOT NULL DEFAULT 'ok',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "admins can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "authenticated can insert own audit entry" ON public.admin_audit_log;
CREATE POLICY "authenticated can insert own audit entry"
  ON public.admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log (action, created_at DESC);

-- 2. Hot-path composite indexes (additive only)
CREATE INDEX IF NOT EXISTS ai_events_status_created_idx
  ON public.ai_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_decisions_created_idx
  ON public.ai_decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_agent_started_idx
  ON public.agent_runs (agent, started_at DESC);
