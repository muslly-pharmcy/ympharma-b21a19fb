
-- 1) Missing performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_product
  ON public.cart_items (user_id, product_id);

-- 2) Index-def helper (admin-only) used by Phoenix probe
CREATE OR REPLACE FUNCTION public.pg_get_indexdef_by_name(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT indexdef FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = p_name
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.pg_get_indexdef_by_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pg_get_indexdef_by_name(text) TO authenticated, service_role;

-- 3) ensure_user_organization: auto-heal missing org membership
CREATE OR REPLACE FUNCTION public.ensure_user_organization(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, type, status)
    VALUES ('Default Organization', 'pharmacy', 'active')
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, p_user_id, 'owner', 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';

  RETURN v_org_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_user_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_organization(uuid) TO authenticated, service_role;

-- 4) Backfill: admins without a membership get one now
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = ur.user_id AND om.status = 'active'
      )
  LOOP
    PERFORM public.ensure_user_organization(r.user_id);
  END LOOP;
END $$;
