-- 1. Ego Memory scope on existing memory layers
ALTER TABLE public.air_memory_layers
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS scope_id text;

CREATE INDEX IF NOT EXISTS air_memory_layers_scope_idx
  ON public.air_memory_layers (organization_id, scope_type, scope_id, layer, created_at DESC);

-- 2. Human-in-the-loop approval queue
CREATE TABLE IF NOT EXISTS public.air_hitl_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  run_id uuid,
  agent_key text NOT NULL,
  action_key text NOT NULL,
  risk_level text NOT NULL DEFAULT 'high',
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT air_hitl_status_chk CHECK (status IN ('pending','approved','rejected','expired')),
  CONSTRAINT air_hitl_risk_chk CHECK (risk_level IN ('low','moderate','high','critical'))
);

GRANT SELECT, INSERT, UPDATE ON public.air_hitl_approvals TO authenticated;
GRANT ALL ON public.air_hitl_approvals TO service_role;

ALTER TABLE public.air_hitl_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hitl_select_org_members" ON public.air_hitl_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = air_hitl_approvals.organization_id
      AND m.user_id = auth.uid()
  ));

CREATE POLICY "hitl_insert_org_members" ON public.air_hitl_approvals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = air_hitl_approvals.organization_id
      AND m.user_id = auth.uid()
  ));

CREATE POLICY "hitl_decide_privileged" ON public.air_hitl_approvals
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = air_hitl_approvals.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin','manager','pharmacist')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = air_hitl_approvals.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin','manager','pharmacist')
  ));

CREATE INDEX IF NOT EXISTS air_hitl_org_status_idx
  ON public.air_hitl_approvals (organization_id, status, created_at DESC);

CREATE TRIGGER air_hitl_touch_updated_at
  BEFORE UPDATE ON public.air_hitl_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
