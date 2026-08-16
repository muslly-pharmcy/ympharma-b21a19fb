CREATE TABLE public.ai_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  source text,
  actor_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_score integer NOT NULL DEFAULT 0,
  action_taken text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_security_events TO authenticated;
GRANT ALL ON public.ai_security_events TO service_role;
ALTER TABLE public.ai_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read security events" ON public.ai_security_events FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service writes security events" ON public.ai_security_events FOR INSERT
  TO service_role WITH CHECK (true);
CREATE POLICY "admins update security events" ON public.ai_security_events FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX ai_security_events_type_idx ON public.ai_security_events(event_type, created_at DESC);
CREATE INDEX ai_security_events_open_idx ON public.ai_security_events(resolved, severity);

CREATE TABLE public.ai_security_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text,
  actor_id uuid,
  action text NOT NULL,
  resource text,
  result text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_security_audit TO authenticated;
GRANT ALL ON public.ai_security_audit TO service_role;
ALTER TABLE public.ai_security_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read security audit" ON public.ai_security_audit FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service writes security audit" ON public.ai_security_audit FOR INSERT
  TO service_role WITH CHECK (true);
CREATE INDEX ai_security_audit_actor_idx ON public.ai_security_audit(actor_id, created_at DESC);
CREATE INDEX ai_security_audit_action_idx ON public.ai_security_audit(action, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_ai_actions_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.ai_security_audit (actor, action, resource, result, metadata)
  VALUES (
    NEW.agent_name,
    'TOOL_EXEC',
    NEW.tool_name,
    NEW.status,
    jsonb_build_object('action_id', NEW.id, 'requires_approval', NEW.requires_approval)
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_ai_actions_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS ai_actions_audit_trigger ON public.ai_actions;
CREATE TRIGGER ai_actions_audit_trigger
  AFTER INSERT ON public.ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_ai_actions_audit();
