
-- staff permissions table
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('orders','prescriptions','users')),
  created_at timestamptz not null default now(),
  unique(user_id, permission)
);

GRANT SELECT ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own permissions" ON public.staff_permissions;
CREATE POLICY "users read own permissions" ON public.staff_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

-- has_permission: owner has all
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner')
      OR EXISTS (SELECT 1 FROM public.staff_permissions
                  WHERE user_id = _user_id AND permission = _perm);
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon, authenticated;

-- bootstrap_owner: first admin can self-promote when no owner exists
CREATE OR REPLACE FUNCTION public.bootstrap_owner()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE has_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'owner') INTO has_owner;
  IF has_owner THEN RETURN false; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner() TO authenticated;

-- Update orders/prescriptions policies to grant access to staff with permission
DROP POLICY IF EXISTS "admins read orders" ON public.orders;
CREATE POLICY "staff read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'orders'));

DROP POLICY IF EXISTS "admins update orders" ON public.orders;
CREATE POLICY "staff update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'orders'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'orders'));

DROP POLICY IF EXISTS "admins read prescriptions" ON public.prescriptions;
CREATE POLICY "staff read prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'prescriptions'));

DROP POLICY IF EXISTS "admins update prescriptions" ON public.prescriptions;
CREATE POLICY "staff update prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'prescriptions'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'prescriptions'));
