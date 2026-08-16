
-- Restrict permissions catalog to admins
DROP POLICY IF EXISTS "permissions_read_all" ON public.permissions;
CREATE POLICY "permissions_admin_read" ON public.permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict role_permissions mapping to admins
DROP POLICY IF EXISTS "role_permissions_read_all" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_read" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten push_subscriptions insert (remove always-true WITH CHECK)
DROP POLICY IF EXISTS "anyone can subscribe" ON public.push_subscriptions;
CREATE POLICY "subscribe with own identity" ON public.push_subscriptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND visitor_token IS NOT NULL AND length(visitor_token) > 0)
  );
