-- SECDEF-HARDENING v2 — revoke anon EXECUTE on 43 privileged SECURITY DEFINER functions
-- Idempotent. Only affects the anon role. authenticated/service_role untouched.
DO $$
DECLARE
  target text;
  targets text[] := ARRAY[
    -- Billing (4)
    'billing_activate_plan(billing_audience, uuid, text, uuid, integer)',
    'billing_cancel_subscription(uuid, boolean)',
    'billing_issue_invoice(uuid, date, date)',
    'billing_record_payment(uuid, numeric, text)',
    -- Org / identity (10)
    'current_org()',
    'is_org_member(uuid, uuid)',
    'has_org_role(uuid, uuid, text[])',
    'list_my_org_permissions(uuid)',
    'org_feature_enabled(uuid, text)',
    'org_within_limit(uuid, text, bigint)',
    'log_org_event(uuid, uuid, text, jsonb)',
    'emit_identity_event(text, uuid, uuid, uuid, uuid, jsonb)',
    'handle_new_user_profile()',
    'patient_belongs_to_current_user(uuid)',
    -- Healthcare admin (10)
    'hc_approve_join_submission(uuid)',
    'hc_reject_join_submission(uuid, text)',
    'hc_flag_join_photo(uuid, text, text)',
    'hc_detect_doctor_duplicates(text, text)',
    'hc_doctors_guard_verify()',
    'hc_normalize_doctor_row(uuid)',
    'hc_recompute_profile_completeness(uuid)',
    'hc_recompute_trust_score(uuid)',
    'hc_healthcare_kpis()',
    'hc_touch_doctor_scores()',
    -- Pharmacy network writes (5)
    'pn_request_transfer(uuid, uuid, uuid, numeric, pn_transfer_reason, text)',
    'pn_submit_verification(uuid, jsonb, text)',
    'pn_upsert_stock(uuid, uuid, pn_availability, numeric, boolean, date, text)',
    'pn_verify_pharmacy(uuid, boolean, text)',
    'pn_flag_near_expiry(integer)',
    -- Consent (1)
    'has_consent(uuid, text, uuid, text)',
    -- Inventory / email / recs (4)
    'inv_intel_snapshot()',
    'email_queue_dispatch()',
    'email_queue_wake()',
    'emit_purchase_recommendation_event()',
    -- Trigger functions never meant as RPC (9)
    'tg_ai_actions_audit()',
    'tg_branch_assignments_events()',
    'tg_branches_events()',
    'tg_med_to_timeline()',
    'tg_org_members_events()',
    'tg_organization_members_audit()',
    'tg_organizations_after_insert()',
    'tg_profiles_events()',
    'tg_vault_to_timeline()'
  ];
  n_revoked int := 0;
BEGIN
  FOREACH target IN ARRAY targets LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', target);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC', target);
      n_revoked := n_revoked + 1;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip (not found): %', target;
    END;
  END LOOP;
  RAISE NOTICE 'SECDEF-HARDENING v2: revoked anon EXECUTE on % function(s)', n_revoked;
END $$;

-- Verification: expect exactly 4 anon-executable SECURITY DEFINER functions remaining (public read helpers).
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  RAISE NOTICE 'SECDEF anon-executable remaining: % (expected 4)', remaining;
END $$;
