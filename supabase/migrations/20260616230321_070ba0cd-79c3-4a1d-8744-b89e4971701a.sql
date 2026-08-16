
-- 1) Grants for authenticated + service_role on all public tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_permissions TO authenticated;

GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.offers TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.prescriptions TO service_role;
GRANT ALL ON public.activity_logs TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.staff_permissions TO service_role;

-- 2) Public read for products (only published) and offers
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.offers TO anon;

-- 3) Fix products read policy so anon never evaluates has_permission (function not callable by anon)
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT
  USING (
    is_published = true
    OR (auth.uid() IS NOT NULL AND public.has_permission(auth.uid(), 'products'))
  );

-- 4) Fix offers read policy similarly if it references has_permission
DROP POLICY IF EXISTS offers_public_read ON public.offers;
CREATE POLICY offers_public_read ON public.offers
  FOR SELECT
  USING (
    COALESCE(is_active, true) = true
    OR (auth.uid() IS NOT NULL AND public.has_permission(auth.uid(), 'offers'))
  );

-- 5) Restrict SECURITY DEFINER helpers to authenticated only (addresses linter warnings)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) TO authenticated;
