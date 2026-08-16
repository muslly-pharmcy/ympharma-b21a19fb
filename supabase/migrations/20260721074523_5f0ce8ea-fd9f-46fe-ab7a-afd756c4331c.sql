
-- 1. Registry of privileged SECURITY DEFINER functions whose EXECUTE grants must stay locked down.
CREATE TABLE IF NOT EXISTS public.privileged_definer_functions (
  function_signature text PRIMARY KEY,
  reason             text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.privileged_definer_functions TO authenticated;
GRANT ALL    ON public.privileged_definer_functions TO service_role;
ALTER TABLE public.privileged_definer_functions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS privileged_definer_functions_admin_read ON public.privileged_definer_functions;
CREATE POLICY privileged_definer_functions_admin_read
  ON public.privileged_definer_functions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

INSERT INTO public.privileged_definer_functions(function_signature, reason) VALUES
  ('public.bootstrap_owner()',                        'Bootstraps owner role — must never be anon-callable'),
  ('public.approve_classification(uuid)',             'Staff moderation only'),
  ('public.cancel_transfer(uuid)',                    'Inventory transfer control — staff only'),
  ('public.apply_retention_policies()',               'Data retention job — service_role only'),
  ('public.hc_doctors_protect_self_update()',         'Trigger fn — no external EXECUTE ever'),
  ('public.profiles_protect_self_update()',           'Trigger fn — no external EXECUTE ever')
ON CONFLICT (function_signature) DO NOTHING;

-- 2. Read-only view CI queries to detect drift from the expected grant baseline.
CREATE OR REPLACE VIEW public.v_privileged_definer_grants AS
SELECT
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS function_signature,
  p.prosecdef                                                    AS is_security_definer,
  has_function_privilege('anon',          p.oid, 'EXECUTE')      AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')      AS authenticated_can_execute,
  (p.proconfig IS NOT NULL AND EXISTS (
     SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
  ))                                                             AS search_path_locked
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

GRANT SELECT ON public.v_privileged_definer_grants TO authenticated, service_role;

-- 3. Enrich hc_doctors self-update trigger with structured audit + alerting.
CREATE OR REPLACE FUNCTION public.hc_doctors_protect_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff       boolean := false;
  reverted_cols  text[]  := ARRAY[]::text[];
  recent_reverts int;
  actor          uuid    := auth.uid();
BEGIN
  IF NEW.organization_id IS NOT NULL
     AND public.has_org_permission(actor, NEW.organization_id, 'healthcare.doctors.manage') THEN
    is_staff := true;
  ELSIF public.has_role(actor, 'admin'::app_role) THEN
    is_staff := true;
  END IF;

  IF NOT is_staff AND OLD.user_id = actor THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      reverted_cols := reverted_cols || 'verification_status';
      NEW.verification_status := OLD.verification_status;
    END IF;
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      reverted_cols := reverted_cols || 'is_public';
      NEW.is_public := OLD.is_public;
    END IF;
    IF NEW.trust_score IS DISTINCT FROM OLD.trust_score THEN
      reverted_cols := reverted_cols || 'trust_score';
      NEW.trust_score := OLD.trust_score;
    END IF;
    IF NEW.confidence_score IS DISTINCT FROM OLD.confidence_score THEN
      reverted_cols := reverted_cols || 'confidence_score';
      NEW.confidence_score := OLD.confidence_score;
    END IF;
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      reverted_cols := reverted_cols || 'organization_id';
      NEW.organization_id := OLD.organization_id;
    END IF;

    IF array_length(reverted_cols, 1) > 0 THEN
      INSERT INTO public.audit_events(
        actor_user_id, organization_id, action, resource_type, resource_id, payload
      ) VALUES (
        actor,
        COALESCE(OLD.organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
        'self_update_reverted', 'hc_doctors', OLD.id,
        jsonb_build_object('reverted', reverted_cols, 'table', 'hc_doctors')
      );

      SELECT count(*) INTO recent_reverts
      FROM public.audit_events
      WHERE actor_user_id = actor
        AND action = 'self_update_reverted'
        AND created_at > now() - interval '5 minutes';

      IF recent_reverts > 3 THEN
        INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload)
        VALUES (
          'privilege_escalation_attempt', 'critical',
          'محاولة تصعيد صلاحيات متكررة على ملف طبيب',
          format('المستخدم %s حاول تعديل حقول محمية %s مرات خلال 5 دقائق.', actor, recent_reverts),
          'hc_doctors', OLD.id::text,
          jsonb_build_object('actor', actor, 'count', recent_reverts, 'reverted', reverted_cols)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Enrich profiles self-update trigger with the same audit + alerting.
CREATE OR REPLACE FUNCTION public.profiles_protect_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reverted_cols  text[] := ARRAY[]::text[];
  recent_reverts int;
  actor          uuid   := auth.uid();
BEGIN
  IF public.has_role(actor, 'admin'::app_role)
     OR public.has_role(actor, 'owner'::app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.id = actor THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      reverted_cols := reverted_cols || 'status';
      NEW.status := OLD.status;
    END IF;
    IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      reverted_cols := reverted_cols || 'metadata';
      NEW.metadata := OLD.metadata;
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      reverted_cols := reverted_cols || 'email';
      NEW.email := OLD.email;
    END IF;

    IF array_length(reverted_cols, 1) > 0 THEN
      INSERT INTO public.audit_events(
        actor_user_id, organization_id, action, resource_type, resource_id, payload
      ) VALUES (
        actor,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'self_update_reverted', 'profiles', OLD.id,
        jsonb_build_object('reverted', reverted_cols, 'table', 'profiles')
      );

      SELECT count(*) INTO recent_reverts
      FROM public.audit_events
      WHERE actor_user_id = actor
        AND action = 'self_update_reverted'
        AND created_at > now() - interval '5 minutes';

      IF recent_reverts > 3 THEN
        INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload)
        VALUES (
          'privilege_escalation_attempt', 'critical',
          'محاولة تصعيد صلاحيات متكررة على حساب مستخدم',
          format('المستخدم %s حاول تعديل حقول محمية %s مرات خلال 5 دقائق.', actor, recent_reverts),
          'profiles', OLD.id::text,
          jsonb_build_object('actor', actor, 'count', recent_reverts, 'reverted', reverted_cols)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Event trigger that records any GRANT/REVOKE on a privileged function to audit_events.
--    Non-blocking: visibility beats surprise on legitimate migrations.
CREATE OR REPLACE FUNCTION public.audit_privileged_grant_changes()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r         record;
  sig       text;
  is_locked boolean;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands()
           WHERE command_tag IN ('GRANT','REVOKE') AND object_type = 'function'
  LOOP
    sig := r.object_identity;
    SELECT EXISTS (
      SELECT 1 FROM public.privileged_definer_functions WHERE function_signature = sig
    ) INTO is_locked;

    IF is_locked THEN
      INSERT INTO public.audit_events(
        actor_user_id, organization_id, action, resource_type, payload
      ) VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        '00000000-0000-0000-0000-000000000000'::uuid,
        'privileged_grant_change', 'pg_proc',
        jsonb_build_object('signature', sig, 'command', r.command_tag, 'schema', r.schema_name)
      );

      INSERT INTO public.staff_alerts(kind, severity, title, body, entity_type, entity_id, payload)
      VALUES (
        'privileged_grant_change', 'critical',
        'تم تغيير صلاحيات دالة محمية',
        format('%s على %s — يجب مراجعة المهاجرة فوراً.', r.command_tag, sig),
        'pg_proc', sig,
        jsonb_build_object('signature', sig, 'command', r.command_tag)
      );
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_audit_privileged_grants;
CREATE EVENT TRIGGER trg_audit_privileged_grants
  ON ddl_command_end
  WHEN TAG IN ('GRANT','REVOKE')
  EXECUTE FUNCTION public.audit_privileged_grant_changes();
