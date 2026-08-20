
-- Phoenix Phase 1: Tenancy Spine
-- Additive-only. Does not modify any existing objects.

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM ('PHARMACY','CLINIC','LAB','INSURANCE','SUPPLIER','CORPORATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.organization_type NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_status_chk CHECK (status IN ('active','suspended','archived'))
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_role_chk CHECK (role IN ('owner','admin','member')),
  CONSTRAINT organization_members_status_chk CHECK (status IN ('active','invited','suspended','removed')),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS organization_members_org_idx ON public.organization_members(organization_id);

CREATE TABLE IF NOT EXISTS public.organization_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_audit_events_org_idx ON public.organization_audit_events(organization_id, created_at DESC);

-- 3. GRANTs
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

GRANT SELECT ON public.organization_audit_events TO authenticated;
GRANT ALL ON public.organization_audit_events TO service_role;

-- 4. Helpers (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org
      AND user_id = _user
      AND status = 'active'
      AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.current_org', true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.log_org_event(_org uuid, _actor uuid, _type text, _payload jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.organization_audit_events (organization_id, actor_user_id, event_type, payload)
  VALUES (_org, _actor, _type, COALESCE(_payload, '{}'::jsonb));
$$;

REVOKE EXECUTE ON FUNCTION public.log_org_event(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_org_event(uuid, uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_org_event(uuid, uuid, text, jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.current_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text[]) TO authenticated;

-- 5. Triggers
CREATE OR REPLACE FUNCTION public.tg_organizations_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (NEW.id, auth.uid(), 'owner', 'active')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  PERFORM public.log_org_event(NEW.id, auth.uid(), 'org.created',
    jsonb_build_object('name', NEW.name, 'type', NEW.type));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_organization_members_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_org_event(NEW.organization_id, auth.uid(), 'member.added',
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_org_event(OLD.organization_id, auth.uid(), 'member.removed',
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_update_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS organizations_after_insert ON public.organizations;
CREATE TRIGGER organizations_after_insert
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_organizations_after_insert();

DROP TRIGGER IF EXISTS organizations_set_updated_at ON public.organizations;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_update_timestamp();

DROP TRIGGER IF EXISTS organization_members_audit ON public.organization_members;
CREATE TRIGGER organization_members_audit
AFTER INSERT OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.tg_organization_members_audit();

DROP TRIGGER IF EXISTS organization_members_set_updated_at ON public.organization_members;
CREATE TRIGGER organization_members_set_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.tg_update_timestamp();

-- 6. RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_select_members" ON public.organizations;
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.organizations;
CREATE POLICY "orgs_insert_authenticated" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orgs_update_admins" ON public.organizations;
CREATE POLICY "orgs_update_admins" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']));

DROP POLICY IF EXISTS "members_select_own_or_admin" ON public.organization_members;
CREATE POLICY "members_select_own_or_admin" ON public.organization_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin'])
  );

DROP POLICY IF EXISTS "members_insert_admin" ON public.organization_members;
CREATE POLICY "members_insert_admin" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow trigger-driven self-insert (creator becomes owner)
    (user_id = auth.uid() AND role = 'owner')
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin'])
  );

DROP POLICY IF EXISTS "members_update_admin" ON public.organization_members;
CREATE POLICY "members_update_admin" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']));

DROP POLICY IF EXISTS "members_delete_admin" ON public.organization_members;
CREATE POLICY "members_delete_admin" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']));

DROP POLICY IF EXISTS "audit_select_members" ON public.organization_audit_events;
CREATE POLICY "audit_select_members" ON public.organization_audit_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
