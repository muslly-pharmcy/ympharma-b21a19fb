CREATE OR REPLACE FUNCTION public.public_feature_flags()
RETURNS TABLE (key TEXT, value JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value
  FROM public.app_settings s
  WHERE s.key IN (
    'enable_medication_vault',
    'enable_ai_marketing',
    'enable_delivery_orders',
    'enable_clinical_inspector',
    'maintenance_mode',
    'pharmacy_status',
    'custom_announcement'
  );
$$;

REVOKE ALL ON FUNCTION public.public_feature_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_feature_flags() TO anon, authenticated, service_role;