INSERT INTO public.app_settings (key, value)
VALUES ('enable_phone_auth', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.public_feature_flags()
RETURNS TABLE(key text, value jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.key, s.value
  FROM public.app_settings s
  WHERE s.key IN (
    'enable_medication_vault',
    'enable_ai_marketing',
    'enable_delivery_orders',
    'enable_clinical_inspector',
    'enable_phone_auth',
    'maintenance_mode',
    'pharmacy_status',
    'custom_announcement'
  );
$function$;