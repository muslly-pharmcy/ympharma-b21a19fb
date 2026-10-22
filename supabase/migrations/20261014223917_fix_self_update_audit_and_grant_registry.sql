-- Keep self-update protections on the original tenant; the proposed tenant is not authority.
-- Explicit scalar array appends preserve audit recording on PostgreSQL 17.
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
  IF OLD.organization_id IS NOT NULL
     AND public.has_org_permission(actor, OLD.organization_id, 'healthcare.doctors.manage')
     AND (NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
          OR (NEW.organization_id IS NOT NULL
              AND public.has_org_permission(actor, NEW.organization_id, 'healthcare.doctors.manage'))) THEN
    is_staff := true;
  ELSIF public.has_role(actor, 'admin'::app_role) THEN
    is_staff := true;
  END IF;

  IF NOT is_staff AND OLD.user_id = actor THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      reverted_cols := array_append(reverted_cols, 'verification_status');
      NEW.verification_status := OLD.verification_status;
    END IF;
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      reverted_cols := array_append(reverted_cols, 'is_public');
      NEW.is_public := OLD.is_public;
    END IF;
    IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      reverted_cols := array_append(reverted_cols, 'verified_at');
      NEW.verified_at := OLD.verified_at;
    END IF;
    IF NEW.verified_by IS DISTINCT FROM OLD.verified_by THEN
      reverted_cols := array_append(reverted_cols, 'verified_by');
      NEW.verified_by := OLD.verified_by;
    END IF;
    IF NEW.trust_score IS DISTINCT FROM OLD.trust_score THEN
      reverted_cols := array_append(reverted_cols, 'trust_score');
      NEW.trust_score := OLD.trust_score;
    END IF;
    IF NEW.confidence_score IS DISTINCT FROM OLD.confidence_score THEN
      reverted_cols := array_append(reverted_cols, 'confidence_score');
      NEW.confidence_score := OLD.confidence_score;
    END IF;
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      reverted_cols := array_append(reverted_cols, 'organization_id');
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
      reverted_cols := array_append(reverted_cols, 'status');
      NEW.status := OLD.status;
    END IF;
    IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      reverted_cols := array_append(reverted_cols, 'metadata');
      NEW.metadata := OLD.metadata;
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      reverted_cols := array_append(reverted_cols, 'email');
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


-- Reconcile the registry with real overloads, including parameters with defaults.
-- Audit the proposed self-edit before older verification triggers reject or
-- normalize it. PostgreSQL executes same-kind triggers in name order.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.hc_doctors'::regclass
             AND tgname='trg_hc_doctors_guard') THEN
    ALTER TRIGGER trg_hc_doctors_guard ON public.hc_doctors RENAME TO trg_hc_doctors_verification_guard;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.hc_doctors'::regclass
             AND tgname='trg_hc_doctors_prevent_self_verify') THEN
    ALTER TRIGGER trg_hc_doctors_prevent_self_verify ON public.hc_doctors RENAME TO trg_hc_doctors_verification_self_guard;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hc_doctors_guard_verify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.is_public IS DISTINCT FROM OLD.is_public THEN
    IF (OLD.organization_id IS NULL AND NOT public.has_role(auth.uid(),'admin'::app_role))
       OR (OLD.organization_id IS NOT NULL AND NOT public.has_org_permission(auth.uid(),OLD.organization_id,'healthcare.doctors.verify'))
       OR NEW.organization_id IS NULL
       OR NOT public.has_org_permission(auth.uid(),NEW.organization_id,'healthcare.doctors.verify') THEN
      RAISE EXCEPTION 'insufficient privilege to modify verification fields';
    END IF;
  END IF;
  RETURN NEW;
END $$;

UPDATE public.privileged_definer_functions SET function_signature='public.approve_classification(uuid, jsonb)'
WHERE function_signature='public.approve_classification(uuid)';
UPDATE public.privileged_definer_functions SET function_signature='public.cancel_transfer(uuid, text)'
WHERE function_signature='public.cancel_transfer(uuid)';

-- Identity argument names are not part of regprocedure identity.
CREATE OR REPLACE VIEW public.v_privileged_definer_grants WITH (security_invoker=true) AS
SELECT format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) AS function_signature,
  p.prosecdef AS is_security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  (p.proconfig IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
  )) AS search_path_locked
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.privileged_definer_functions
             WHERE to_regprocedure(function_signature) IS NULL) THEN
    RAISE EXCEPTION 'Unresolved privileged function registry entry';
  END IF;
END $$;

-- PostgreSQL 17 reports GRANT/REVOKE with object_type=FUNCTION but no object
-- identity or OID. Compare the registry's real ACL state; never parse SQL text.
ALTER TABLE public.privileged_definer_functions ADD COLUMN IF NOT EXISTS observed_acl text;
UPDATE public.privileged_definer_functions r SET observed_acl=coalesce(p.proacl,acldefault('f',p.proowner))::text
FROM pg_proc p WHERE p.oid=to_regprocedure(r.function_signature);

CREATE OR REPLACE FUNCTION public.audit_privileged_grant_changes()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT registry.function_signature, registry.observed_acl AS old_acl,
           coalesce(p.proacl,acldefault('f',p.proowner))::text AS new_acl
    FROM public.privileged_definer_functions registry
    JOIN pg_proc p ON p.oid=to_regprocedure(registry.function_signature)
    WHERE registry.observed_acl IS DISTINCT FROM coalesce(p.proacl,acldefault('f',p.proowner))::text
  LOOP
    UPDATE public.privileged_definer_functions SET observed_acl=r.new_acl
      WHERE function_signature=r.function_signature;
    INSERT INTO public.audit_events(actor_user_id,organization_id,action,resource_type,payload)
    VALUES (coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid),
      '00000000-0000-0000-0000-000000000000'::uuid,'privileged_grant_change','pg_proc',
      jsonb_build_object('signature',r.function_signature,'command',TG_TAG,'old_acl',r.old_acl,'new_acl',r.new_acl));
    INSERT INTO public.staff_alerts(kind,severity,title,body,entity_type,entity_id,payload)
    VALUES ('privileged_grant_change','critical','تم تغيير صلاحيات دالة محمية',
      format('%s على %s',TG_TAG,r.function_signature),'pg_proc',r.function_signature,
      jsonb_build_object('signature',r.function_signature,'command',TG_TAG,'old_acl',r.old_acl,'new_acl',r.new_acl));
  END LOOP;
END $$;
