
-- 1) RLS read tightening
DROP POLICY IF EXISTS "app_settings read auth" ON public.app_settings;
CREATE POLICY "app_settings read admin"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "uptime_checks_read_auth" ON public.uptime_checks;
CREATE POLICY "uptime_checks read admin"
  ON public.uptime_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "wa_tpl read auth" ON public.whatsapp_notification_templates;
CREATE POLICY "wa_tpl read staff"
  ON public.whatsapp_notification_templates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'prescriptions'::text)
    OR public.has_permission(auth.uid(), 'orders'::text)
  );

-- 2) inventory_manual_adjustments insert
DROP POLICY IF EXISTS "service write manual adj" ON public.inventory_manual_adjustments;
CREATE POLICY "staff insert manual adj"
  ON public.inventory_manual_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'products'::text)
  );

-- 3) staff_alerts ack: tighten WITH CHECK
DROP POLICY IF EXISTS "staff ack alerts" ON public.staff_alerts;
CREATE POLICY "staff ack alerts"
  ON public.staff_alerts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'orders'::text)
    OR public.has_permission(auth.uid(), 'prescriptions'::text)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'orders'::text)
    OR public.has_permission(auth.uid(), 'prescriptions'::text)
  );

-- 4) insurance_claims: scrub staff-only fields on anon insert
CREATE OR REPLACE FUNCTION public._scrub_insurance_claim_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
        public.has_role(auth.uid(), 'owner'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_permission(auth.uid(), 'prescriptions'::text)
     )
  THEN
    NEW.staff_notes := NULL;
    NEW.validation_notes := NULL;
    NEW.status := 'pending';
    BEGIN NEW.validated_at := NULL; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.validated_by := NULL; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.claim_id     := NULL; EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scrub_insurance_claim_insert ON public.insurance_claims;
CREATE TRIGGER trg_scrub_insurance_claim_insert
  BEFORE INSERT ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public._scrub_insurance_claim_insert();

-- 5) Internal-only tables: minimal admin-read policies (RLS already enabled)
CREATE POLICY "tracking_lookups admin read"
  ON public.tracking_lookups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "img_rate_limit admin read"
  ON public.img_rate_limit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Remove always-true policies on service-role-only tables.
DROP POLICY IF EXISTS "ai_tool_events service writes" ON public.ai_tool_events;
DROP POLICY IF EXISTS "service role manages prescription files" ON public.prescription_files;
DROP POLICY IF EXISTS "Service role manages blobs" ON public.prescription_image_blobs;
-- service_role bypasses RLS; these tables remain accessible to background workers.

-- 7) Storage policies
DROP POLICY IF EXISTS "anyone_uploads_insurance_constrained" ON storage.objects;
CREATE POLICY "anyone_uploads_insurance_constrained"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'insurance'
    AND (storage.foldername(name))[1] = 'uploads'
    AND (
      lower(coalesce(metadata->>'mimetype','')) LIKE 'image/%'
      OR lower(coalesce(metadata->>'mimetype','')) = 'application/pdf'
    )
    AND coalesce((metadata->>'size')::bigint, 0) <= 26214400
  );

DROP POLICY IF EXISTS "uploader read prescription uploads" ON storage.objects;

-- 8) Pin search_path
ALTER FUNCTION public._therapeutic_label_ar(text) SET search_path = public;
ALTER FUNCTION public.wa_touch_updated_at() SET search_path = public;

-- 9) SECURITY DEFINER ACL sweep
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

DO $$
DECLARE
  fn text;
  anon_auth text[] := ARRAY[
    'has_role(uuid, app_role)',
    'has_permission(uuid, text)',
    'has_branch_access(uuid, uuid)',
    'is_branch_manager_of(uuid, uuid)',
    'is_owner_or_admin(uuid)',
    'get_order_public(text, text, text)',
    'get_order_history_public(text, text, text)',
    'list_approved_classifications_public()',
    'list_bundles_public()',
    'pharmacy_homepage_sections()',
    'pharmacy_related_products(integer)',
    'pharmacy_search(text)',
    'pharmacy_taxonomy_stats()',
    'pharmacy_chronic_legacy_ids()',
    'conditions_catalog()',
    'place_order(text, jsonb, jsonb)',
    'place_order(text, jsonb, jsonb, text)',
    'submit_prescription(text, jsonb, text[])',
    'validate_discount(text, numeric, text)',
    'track_banner_event(uuid, text)',
    'prescription_file_count(text)',
    'customer_notification_get_status(text)',
    'customer_notification_set_optout(text, boolean)',
    'check_img_rate_limit(text, integer, integer)',
    'check_tracking_rate_limit(text, integer, integer)',
    'consume_rate_limit(text, integer, integer)'
  ];
BEGIN
  FOREACH fn IN ARRAY anon_auth LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'skip missing function %', fn;
    END;
  END LOOP;
END $$;

DO $$
DECLARE
  fn text;
  auth_only text[] := ARRAY[
    'ack_staff_alert(uuid)',
    'admin_stats()',
    'admin_bundles_report()',
    'admin_revenue_series(integer)',
    'agent_runs_list(integer)',
    'agent_workforce_summary()',
    'agent_events_dlq_stats()',
    'bootstrap_owner()',
    'create_backup(text)',
    'log_activity(text, text, text, jsonb)',
    'ai_get_branch_availability(text)',
    'ai_get_order_status(text, text)',
    'ai_get_prescription_status(text, text)',
    'ai_list_branches()',
    'ai_search_products(text, integer)',
    'approve_classification(uuid, jsonb)',
    'reject_classification(uuid)',
    'upsert_classification(jsonb)',
    'list_classifications_admin(text, text, integer)',
    'cancel_transfer(uuid, text)',
    'commit_transfer_receipt(uuid)',
    'release_transfer_reservation(uuid, text)',
    'reserve_transfer_stock(uuid)',
    'marketing_queue_approve(uuid)',
    'marketing_queue_list(text, integer)',
    'marketing_queue_mark_sent(uuid, text, text)',
    'marketing_queue_skip(uuid)',
    'save_customer_ai_insight(text, text)',
    'set_inventory_pilot(integer[], text)',
    'inventory_intel()',
    'inventory_pilot_report()',
    'inventory_readiness_report()',
    'inventory_report()',
    'exec_dashboard()',
    'executive_alerts()',
    'latest_executive_report()',
    'sales_opportunities()',
    'declining_products()',
    'customers_for_enrichment(integer)',
    'branch_reorder_suggestions(uuid, integer, integer, integer, integer)',
    'chronic_overdue(numeric)',
    'current_inventory_write_mode()',
    'cto_health()',
    'campaign_report()',
    'auto_bundle_candidates(integer)',
    'detect_stale_transfers(integer)',
    'get_backup_schedule()',
    'get_event_consumer_schedule()',
    'release_order_stock(text, text, text)',
    'reserve_order_stock(text, text, text)',
    'rebuild_customer_intel()',
    'reconcile_inventory_mismatch()'
  ];
BEGIN
  FOREACH fn IN ARRAY auth_only LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'skip missing function %', fn;
    END;
  END LOOP;
END $$;
