
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_actor ON public.activity_logs(actor_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Generic trigger function to log changes
CREATE OR REPLACE FUNCTION public.log_table_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_entity_id text;
  v_action text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := TG_TABLE_NAME || '.created';
    v_entity_id := COALESCE((to_jsonb(NEW)->>'id'), '');
    INSERT INTO public.activity_logs(actor_id, actor_email, action, entity_type, entity_id, details)
    VALUES (v_actor, v_email, v_action, TG_TABLE_NAME, v_entity_id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := TG_TABLE_NAME || '.updated';
    v_entity_id := COALESCE((to_jsonb(NEW)->>'id'), '');
    INSERT INTO public.activity_logs(actor_id, actor_email, action, entity_type, entity_id, details)
    VALUES (v_actor, v_email, v_action, TG_TABLE_NAME, v_entity_id,
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := TG_TABLE_NAME || '.deleted';
    v_entity_id := COALESCE((to_jsonb(OLD)->>'id'), '');
    INSERT INTO public.activity_logs(actor_id, actor_email, action, entity_type, entity_id, details)
    VALUES (v_actor, v_email, v_action, TG_TABLE_NAME, v_entity_id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

CREATE TRIGGER trg_log_prescriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

CREATE TRIGGER trg_log_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

CREATE TRIGGER trg_log_staff_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

-- RPC for manual events (sign-in, sign-out, custom admin actions)
CREATE OR REPLACE FUNCTION public.log_activity(_action text, _entity_type text DEFAULT NULL, _entity_id text DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.activity_logs(actor_id, actor_email, action, entity_type, entity_id, details)
  VALUES (v_actor, v_email, _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) TO authenticated;
