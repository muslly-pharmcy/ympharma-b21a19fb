
-- 1.1 profiles ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text, avatar_url text, phone text, email text,
  preferred_language text NOT NULL DEFAULT 'ar',
  notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  profile_completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_status_chk CHECK (status IN ('active','suspended','deleted'))
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
INSERT INTO public.profiles (id, email) SELECT id, email FROM auth.users ON CONFLICT (id) DO NOTHING;

-- 1.2 org_role enum + members.role migration -----------------
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner','admin','manager','employee','pharmacist','doctor','supplier_user','insurance_user','customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS role_new public.org_role;
UPDATE public.organization_members SET role_new = CASE role
  WHEN 'owner' THEN 'owner'::public.org_role
  WHEN 'admin' THEN 'admin'::public.org_role
  WHEN 'manager' THEN 'manager'::public.org_role
  WHEN 'member' THEN 'employee'::public.org_role
  ELSE 'employee'::public.org_role
END WHERE role_new IS NULL;

DROP POLICY IF EXISTS members_delete_admin ON public.organization_members;
DROP POLICY IF EXISTS members_update_admin ON public.organization_members;
DROP POLICY IF EXISTS members_select_own_or_admin ON public.organization_members;
DROP POLICY IF EXISTS members_insert_admin ON public.organization_members;
DROP POLICY IF EXISTS orgs_update_admins ON public.organizations;

ALTER TABLE public.organization_members DROP COLUMN role;
ALTER TABLE public.organization_members RENAME COLUMN role_new TO role;
ALTER TABLE public.organization_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'employee'::public.org_role;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS branch_scope uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Replace has_org_role body without changing parameter names
CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user
      AND status = 'active' AND role::text = ANY(_roles)
  );
$$;

CREATE POLICY members_select_own_or_admin ON public.organization_members FOR SELECT
  USING (user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY members_insert_admin ON public.organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY members_update_admin ON public.organization_members FOR UPDATE
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY members_delete_admin ON public.organization_members FOR DELETE
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY orgs_update_admins ON public.organizations FOR UPDATE
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']));

-- 1.3 permissions catalog ------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
  key text PRIMARY KEY, resource text NOT NULL, action text NOT NULL,
  description text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissions_read_all ON public.permissions;
CREATE POLICY permissions_read_all ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.org_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_read_all ON public.role_permissions;
CREATE POLICY role_permissions_read_all ON public.role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO public.permissions(key, resource, action, description) VALUES
  ('org.manage','org','manage','Manage organization settings'),
  ('org.read','org','read','View organization'),
  ('members.manage','members','manage','Invite/remove members and assign roles'),
  ('members.read','members','read','View members'),
  ('branches.manage','branches','manage','Create/update/delete branches'),
  ('branches.read','branches','read','View branches'),
  ('inventory.read','inventory','read','View inventory'),
  ('inventory.update','inventory','update','Adjust inventory levels'),
  ('orders.read','orders','read','View orders'),
  ('orders.manage','orders','manage','Create/modify/fulfill orders'),
  ('prescriptions.read','prescriptions','read','View prescriptions'),
  ('prescriptions.review','prescriptions','review','Review/approve prescriptions'),
  ('patients.view','patients','view','View patient records'),
  ('reports.export','reports','export','Export reports'),
  ('subscriptions.manage','subscriptions','manage','Manage org plan/limits')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions(role, permission_key) VALUES
  ('owner','org.manage'),('owner','org.read'),('owner','members.manage'),('owner','members.read'),
  ('owner','branches.manage'),('owner','branches.read'),('owner','inventory.read'),('owner','inventory.update'),
  ('owner','orders.read'),('owner','orders.manage'),('owner','prescriptions.read'),('owner','prescriptions.review'),
  ('owner','patients.view'),('owner','reports.export'),('owner','subscriptions.manage'),
  ('admin','org.manage'),('admin','org.read'),('admin','members.manage'),('admin','members.read'),
  ('admin','branches.manage'),('admin','branches.read'),('admin','inventory.read'),('admin','inventory.update'),
  ('admin','orders.read'),('admin','orders.manage'),('admin','prescriptions.read'),('admin','prescriptions.review'),
  ('admin','patients.view'),('admin','reports.export'),
  ('manager','org.read'),('manager','members.read'),('manager','branches.read'),('manager','inventory.read'),
  ('manager','inventory.update'),('manager','orders.read'),('manager','orders.manage'),
  ('manager','prescriptions.read'),('manager','reports.export'),
  ('employee','org.read'),('employee','branches.read'),('employee','inventory.read'),('employee','orders.read'),
  ('pharmacist','org.read'),('pharmacist','branches.read'),('pharmacist','inventory.read'),('pharmacist','inventory.update'),
  ('pharmacist','orders.read'),('pharmacist','orders.manage'),('pharmacist','prescriptions.read'),
  ('pharmacist','prescriptions.review'),('pharmacist','patients.view'),
  ('doctor','org.read'),('doctor','patients.view'),('doctor','prescriptions.read'),('doctor','prescriptions.review'),
  ('supplier_user','org.read'),('supplier_user','inventory.read'),('supplier_user','orders.read'),
  ('insurance_user','org.read'),('insurance_user','patients.view'),('insurance_user','prescriptions.read'),
  ('customer','org.read')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_org_permission(
  _user_id uuid, _org_id uuid, _permission text, _branch_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role public.org_role; v_scope uuid[]; v_ok boolean;
BEGIN
  SELECT role, branch_scope INTO v_role, v_scope FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _user_id AND status = 'active' LIMIT 1;
  IF v_role IS NULL THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.role_permissions WHERE role = v_role AND permission_key = _permission) INTO v_ok;
  IF NOT v_ok THEN RETURN false; END IF;
  IF _branch_id IS NOT NULL AND array_length(v_scope,1) IS NOT NULL THEN
    IF NOT (_branch_id = ANY(v_scope)) THEN RETURN false; END IF;
  END IF;
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.has_org_permission(uuid,uuid,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid,uuid,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_org_permissions(_org_id uuid)
RETURNS TABLE(permission_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rp.permission_key FROM public.organization_members m
  JOIN public.role_permissions rp ON rp.role = m.role
  WHERE m.organization_id = _org_id AND m.user_id = auth.uid() AND m.status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.list_my_org_permissions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_org_permissions(uuid) TO authenticated;

-- 1.4 branches -----------------------------------------------
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_branches_org ON public.branches(organization_id);
ALTER TABLE public.branch_user_assignments ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id);
ALTER TABLE public.branch_user_assignments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DROP POLICY IF EXISTS branches_read ON public.branches;
CREATE POLICY branches_read ON public.branches FOR SELECT
  USING (public.is_owner_or_admin(auth.uid()) OR public.has_branch_access(auth.uid(), id)
         OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid())));
DROP POLICY IF EXISTS branches_org_manage ON public.branches;
CREATE POLICY branches_org_manage ON public.branches FOR ALL
  USING (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'branches.manage'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_permission(auth.uid(), organization_id, 'branches.manage'));

-- 1.5 subscriptions ------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{"max_branches":1,"max_users":5}'::jsonb,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz, current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_subscriptions TO authenticated;
GRANT ALL ON public.organization_subscriptions TO service_role;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subs_read_members ON public.organization_subscriptions;
CREATE POLICY subs_read_members ON public.organization_subscriptions FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS subs_manage_admins ON public.organization_subscriptions;
CREATE POLICY subs_manage_admins ON public.organization_subscriptions FOR ALL
  USING (public.has_org_permission(auth.uid(), organization_id, 'subscriptions.manage'))
  WITH CHECK (public.has_org_permission(auth.uid(), organization_id, 'subscriptions.manage'));
DROP TRIGGER IF EXISTS trg_subs_touch ON public.organization_subscriptions;
CREATE TRIGGER trg_subs_touch BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.org_feature_enabled(_org_id uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((features->>_feature)::boolean, false)
  FROM public.organization_subscriptions WHERE organization_id = _org_id;
$$;
REVOKE EXECUTE ON FUNCTION public.org_feature_enabled(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.org_feature_enabled(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.org_within_limit(_org_id uuid, _limit text, _current bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(_current < NULLIF(limits->>_limit,'')::bigint, true)
  FROM public.organization_subscriptions WHERE organization_id = _org_id;
$$;
REVOKE EXECUTE ON FUNCTION public.org_within_limit(uuid,text,bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.org_within_limit(uuid,text,bigint) TO authenticated;

INSERT INTO public.organization_subscriptions(organization_id)
  SELECT id FROM public.organizations ON CONFLICT DO NOTHING;

-- 1.6 audit + events -----------------------------------------
CREATE TABLE IF NOT EXISTS public.identity_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  org_id uuid, actor_user_id uuid, subject_user_id uuid, branch_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.identity_audit_events TO authenticated;
GRANT ALL ON public.identity_audit_events TO service_role;
ALTER TABLE public.identity_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iae_read_org_admins ON public.identity_audit_events;
CREATE POLICY iae_read_org_admins ON public.identity_audit_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)
         OR (org_id IS NOT NULL AND public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin'])));
CREATE INDEX IF NOT EXISTS idx_iae_org_time ON public.identity_audit_events(org_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.emit_identity_event(
  _type text, _org uuid, _actor uuid, _subject uuid, _branch uuid, _payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.identity_audit_events(event_type, org_id, actor_user_id, subject_user_id, branch_id, payload)
  VALUES (_type, _org, _actor, _subject, _branch, COALESCE(_payload,'{}'::jsonb));
  BEGIN
    INSERT INTO public.agent_events(event_type, payload)
    VALUES (_type, jsonb_build_object('org_id', _org, 'actor_user_id', _actor, 'subject_user_id', _subject,
                                      'branch_id', _branch, 'data', COALESCE(_payload,'{}'::jsonb)));
  EXCEPTION WHEN OTHERS THEN NULL; END;
END; $$;
REVOKE EXECUTE ON FUNCTION public.emit_identity_event(text,uuid,uuid,uuid,uuid,jsonb) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_profiles_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_identity_event('USER_CREATED', NULL, NEW.id, NEW.id, NULL, jsonb_build_object('email', NEW.email));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.profile_completed_at IS NOT NULL AND OLD.profile_completed_at IS NULL THEN
      PERFORM public.emit_identity_event('PROFILE_COMPLETED', NULL, NEW.id, NEW.id, NULL, '{}'::jsonb);
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
      PERFORM public.emit_identity_event('USER_UPDATED', NULL, NEW.id, NEW.id, NULL,
        jsonb_build_object('status', NEW.status, 'display_name', NEW.display_name));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_profiles_events ON public.profiles;
CREATE TRIGGER trg_profiles_events AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_events();

CREATE OR REPLACE FUNCTION public.tg_org_members_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_identity_event('ORGANIZATION_MEMBER_ADDED', NEW.organization_id, auth.uid(), NEW.user_id, NULL, jsonb_build_object('role', NEW.role));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.emit_identity_event('ROLE_CHANGED', NEW.organization_id, auth.uid(), NEW.user_id, NULL, jsonb_build_object('from', OLD.role, 'to', NEW.role));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.emit_identity_event('ORGANIZATION_MEMBER_REMOVED', OLD.organization_id, auth.uid(), OLD.user_id, NULL, '{}'::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_org_members_events ON public.organization_members;
CREATE TRIGGER trg_org_members_events AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_org_members_events();

CREATE OR REPLACE FUNCTION public.tg_branches_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_identity_event('BRANCH_CREATED', NEW.organization_id, auth.uid(), NULL, NEW.id, jsonb_build_object('name', NEW.name, 'code', NEW.code));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.emit_identity_event('BRANCH_UPDATED', NEW.organization_id, auth.uid(), NULL, NEW.id, jsonb_build_object('name', NEW.name));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_branches_events ON public.branches;
CREATE TRIGGER trg_branches_events AFTER INSERT OR UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_branches_events();

CREATE OR REPLACE FUNCTION public.tg_branch_assignments_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.branches WHERE id = COALESCE(NEW.branch_id, OLD.branch_id);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_identity_event('BRANCH_MEMBER_ASSIGNED', v_org, auth.uid(), NEW.user_id, NEW.branch_id, jsonb_build_object('role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.emit_identity_event('BRANCH_MEMBER_UNASSIGNED', v_org, auth.uid(), OLD.user_id, OLD.branch_id, '{}'::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_branch_assignments_events ON public.branch_user_assignments;
CREATE TRIGGER trg_branch_assignments_events AFTER INSERT OR DELETE ON public.branch_user_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_branch_assignments_events();
