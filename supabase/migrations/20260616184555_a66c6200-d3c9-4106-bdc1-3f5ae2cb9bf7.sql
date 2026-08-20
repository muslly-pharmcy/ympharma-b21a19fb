
-- 1) Revoke direct EXECUTE on has_role from public roles (RLS evaluator still uses it as definer)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- 2) Tighten permissive INSERT policies with input validation
DROP POLICY IF EXISTS "anyone can create order" ON public.orders;
CREATE POLICY "anyone can create order"
ON public.orders FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(customer_name)) BETWEEN 2 AND 120
  AND length(trim(customer_phone)) BETWEEN 6 AND 30
  AND length(trim(customer_address)) BETWEEN 3 AND 500
  AND (notes IS NULL OR length(notes) <= 1000)
  AND total >= 0 AND total <= 10000000
  AND jsonb_typeof(items) = 'array'
  AND status = 'pending'
);

DROP POLICY IF EXISTS "anyone create prescription" ON public.prescriptions;
CREATE POLICY "anyone create prescription"
ON public.prescriptions FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(customer_name)) BETWEEN 2 AND 120
  AND length(trim(customer_phone)) BETWEEN 6 AND 30
  AND length(trim(customer_address)) BETWEEN 3 AND 500
  AND (notes IS NULL OR length(notes) <= 1000)
  AND array_length(image_urls, 1) IS NOT NULL
  AND array_length(image_urls, 1) <= 10
  AND status = 'pending'
);
