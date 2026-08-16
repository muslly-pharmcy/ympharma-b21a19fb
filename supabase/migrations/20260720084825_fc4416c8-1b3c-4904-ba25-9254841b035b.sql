
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  branch_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  ip text,
  user_agent text,
  correlation_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_read_own_org" ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_audit_events_org_created ON public.audit_events (organization_id, created_at DESC);
CREATE INDEX idx_audit_events_actor ON public.audit_events (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_events_correlation ON public.audit_events (correlation_id) WHERE correlation_id IS NOT NULL;
