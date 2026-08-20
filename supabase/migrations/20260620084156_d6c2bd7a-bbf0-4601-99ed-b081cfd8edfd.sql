-- 1) product_classifications: drop anon SELECT, expose safe public view
DROP POLICY IF EXISTS "public read approved classifications" ON public.product_classifications;

CREATE OR REPLACE VIEW public.product_classifications_public
WITH (security_invoker = true) AS
SELECT
  id, related_legacy_ids, pharmacological_class, conditions,
  requires_prescription, status, updated_at
FROM public.product_classifications
WHERE status = 'approved';

GRANT SELECT ON public.product_classifications_public TO anon, authenticated;

-- Re-allow narrow anon SELECT on the underlying table only via the view's invoker policy:
CREATE POLICY "anon read safe classification columns"
ON public.product_classifications
FOR SELECT TO anon
USING (status = 'approved');
-- Note: the broad SELECT is intentional at row-level; column-level restriction is enforced
-- by funnelling client code through product_classifications_public view (no SELECT on ai_raw).
-- Revoke direct anon table SELECT on sensitive columns:
REVOKE SELECT ON public.product_classifications FROM anon;
GRANT SELECT (id, related_legacy_ids, pharmacological_class, conditions, requires_prescription, status, updated_at)
  ON public.product_classifications TO anon;

-- 2) uptime_incidents: restrict public SELECT to admin/owner only
DROP POLICY IF EXISTS "incidents_read_all" ON public.uptime_incidents;
CREATE POLICY "incidents_read_admin"
ON public.uptime_incidents
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));
