-- 1) Storage: remove anonymous/unbound uploads to sensitive buckets
DROP POLICY IF EXISTS "anyone_uploads_insurance_constrained" ON storage.objects;
DROP POLICY IF EXISTS "anyone upload prescription images" ON storage.objects;

CREATE POLICY "insurance_owner_scoped_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'insurance'
  AND (storage.foldername(name))[1] = 'uploads'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    lower(coalesce(metadata ->> 'mimetype', '')) LIKE 'image/%'
    OR lower(coalesce(metadata ->> 'mimetype', '')) = 'application/pdf'
  )
  AND coalesce((metadata ->> 'size')::bigint, 0) <= 26214400
);

CREATE POLICY "insurance_owner_scoped_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'insurance'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "insurance_owner_scoped_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'insurance'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "prescriptions_owner_scoped_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = 'uploads'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    lower(coalesce(metadata ->> 'mimetype', '')) LIKE 'image/%'
    OR lower(coalesce(metadata ->> 'mimetype', '')) = 'application/pdf'
  )
  AND coalesce((metadata ->> 'size')::bigint, 0) <= 26214400
);

CREATE POLICY "prescriptions_owner_scoped_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "prescriptions_owner_scoped_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 2) Revoke anon EXECUTE from SECURITY DEFINER functions that no anonymous flow uses
REVOKE ALL ON FUNCTION public.public_pharmacy_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pn_list_pharmacy_products(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pn_search_medicine_nearby(text, double precision, double precision, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pn_get_pharmacy_public(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_medicines_public(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_pharmacy_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pn_list_pharmacy_products(text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pn_search_medicine_nearby(text, double precision, double precision, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pn_get_pharmacy_public(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_medicines_public(text, integer) TO authenticated, service_role;

-- 3) Lock internal maintenance / queue / event / loyalty SECURITY DEFINER RPCs to service_role only
DO $$
DECLARE
  r record;
  locked text[] := ARRAY[
    'apply_retention_policies','auto_populate_bundle_items','claim_agent_events',
    'claim_customer_rx_notifications','clean_old_telemetry','cleanup_idempotency_keys',
    'consume_rate_limit','check_img_rate_limit','check_tracking_rate_limit',
    'create_scheduled_backup','create_backup','delete_email','email_queue_dispatch','enqueue_email',
    'emit_agent_event','emit_identity_event','emit_order_event','emit_prescription_event',
    'fail_agent_event','generate_agent_actions','generate_marketing_campaigns',
    'detect_stale_transfers','crm_loyalty_apply_txn','crm_loyalty_recompute_balance',
    'crm_loyalty_recompute_tier','crm_loyalty_seed_tiers','crm_segment_recalc',
    'crm_coupon_redeem','add_loyalty_points','enqueue_chronic_refill_action',
    'customers_for_enrichment','get_agent_alerts','get_backup_schedule',
    'get_event_consumer_schedule','generate_invoice_number','generate_mrn',
    'checkout_cart_fefo','crm_campaign_transition'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname = ANY(locked)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;