DO $$
DECLARE
  r record;
  allowlist text[] := ARRAY[
    'pn_get_pharmacy_public(text)',
    'pn_list_pharmacy_products(text,text,integer,integer)',
    'pn_search_medicine_nearby(text,double precision,double precision,integer,integer)',
    'public_feature_flags()',
    'public_pharmacy_status()',
    'search_medicines_public(text,integer)'
  ];
  fnname text;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig,
           pg_get_function_result(p.oid) = 'trigger' AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    fnname := regexp_replace(r.sig, '^public\.', '');
    IF r.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon, authenticated', fnname);
    ELSIF NOT (fnname = ANY(allowlist)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fnname);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "wa_tpl read staff" ON public.whatsapp_notification_templates;
DROP POLICY IF EXISTS "wa_tpl admin write" ON public.whatsapp_notification_templates;

CREATE POLICY "wa_tpl read staff" ON public.whatsapp_notification_templates
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'prescriptions')
    OR has_permission(auth.uid(), 'orders')
  )
);

CREATE POLICY "wa_tpl admin write" ON public.whatsapp_notification_templates
FOR ALL TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  )
);

REVOKE ALL ON public.whatsapp_notification_templates FROM anon;

DROP POLICY IF EXISTS pn_stock_public_read ON public.pn_pharmacy_stock;

CREATE POLICY pn_stock_public_read ON public.pn_pharmacy_stock
FOR SELECT TO anon, authenticated
USING (
  price_visible = true
  AND EXISTS (
    SELECT 1 FROM public.pn_pharmacies p
    WHERE p.id = pn_pharmacy_stock.pharmacy_id
      AND p.is_public = true
      AND p.verification_status = 'verified'::pn_verification_status
  )
);