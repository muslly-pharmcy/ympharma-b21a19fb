-- Atomic draft claim creation. No settlement, dispense, or payment is implied.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Keep historical numbers and the existing format; every writer reaches this
-- trigger. At READ COMMITTED this VOLATILE function's SELECT takes a fresh
-- snapshot after waiting for the allocator lock, including concurrent commits.
CREATE OR REPLACE FUNCTION public.insv2_gen_claim_no()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  today_prefix text := 'CLM-' || to_char(now(), 'YYYYMMDD') || '-';
  seq int;
BEGIN
  IF NEW.claim_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('insv2-create-claim-number', 0));
    SELECT coalesce(max(CAST(regexp_replace(claim_no, '^CLM-\d+-', '') AS int)), 0) + 1
      INTO seq FROM public.insv2_claims WHERE claim_no LIKE today_prefix || '%';
    IF seq > 999999 THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'Daily claim number range exhausted';
    END IF;
    NEW.claim_no := today_prefix || lpad(seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.insv2_claim_create_receipts (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_payload jsonb NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  claim_id uuid NOT NULL REFERENCES public.insv2_claims(id),
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, actor_id, idempotency_key)
);
ALTER TABLE public.insv2_claim_create_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.insv2_claim_create_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.insv2_claim_create_receipts TO service_role;

CREATE FUNCTION public.insv2_create_claim_atomic(
  p_actor_id uuid, p_branch_id uuid, p_request jsonb, p_correlation_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid := (p_request->>'organizationId')::uuid;
  v_key text := p_request->>'idempotencyKey';
  v_payload jsonb := p_request - 'idempotencyKey' - 'correlationId';
  v_receipt public.insv2_claim_create_receipts%ROWTYPE;
  v_scope uuid[];
  v_org_role text;
  v_item jsonb;
  v_claim uuid;
  v_total numeric := 0;
  v_qty numeric;
  v_unit numeric;
  v_billed numeric;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Trusted insurance service required';
  END IF;
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR v_org IS NULL
     OR v_key IS NULL OR length(v_key) NOT BETWEEN 8 AND 128
     OR p_correlation_id IS NULL OR length(p_correlation_id) NOT BETWEEN 4 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid claim request identity';
  END IF;
  SELECT m.branch_scope, m.role::text INTO v_scope, v_org_role FROM public.organization_members m
    WHERE m.organization_id = v_org AND m.user_id = p_actor_id
      AND m.status = 'active'
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active insurance writer membership required';
  END IF;
  IF v_org_role NOT IN ('owner','admin','manager','pharmacist') THEN
    -- Match actorPermissions: app admin/superadmin still needs active membership.
    PERFORM 1 FROM public.user_roles WHERE user_id = p_actor_id
      AND role::text IN ('admin','superadmin') FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Insurance writer permission required';
    END IF;
  END IF;
  IF cardinality(v_scope) > 0 AND (p_branch_id IS NULL OR NOT p_branch_id = ANY(v_scope)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Insurance branch is outside actor scope';
  END IF;
  IF p_branch_id IS NOT NULL THEN
    PERFORM 1 FROM public.branches WHERE id = p_branch_id AND organization_id = v_org FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Insurance branch is outside organization';
    END IF;
  END IF;
  -- Transaction lock survives until commit, including lost HTTP acknowledgements.
  PERFORM pg_advisory_xact_lock(hashtextextended('insv2-create:' || v_org::text || ':' || p_actor_id::text || ':' || v_key, 0));
  SELECT * INTO v_receipt FROM public.insv2_claim_create_receipts
    WHERE organization_id = v_org AND actor_id = p_actor_id AND idempotency_key = v_key;
  IF FOUND THEN
    IF v_receipt.request_payload IS DISTINCT FROM v_payload OR v_receipt.branch_id IS DISTINCT FROM p_branch_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Idempotency key already used with different claim payload';
    END IF;
    RETURN jsonb_build_object('id', v_receipt.claim_id, 'correlationId', v_receipt.correlation_id);
  END IF;
  IF jsonb_typeof(p_request->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Claim items required';
  END IF;
  IF jsonb_array_length(p_request->'items') NOT BETWEEN 1 AND 200
     OR length(coalesce(p_request->>'currency', 'YER')) <> 3
     OR length(p_request->>'diagnosis') > 500 OR length(p_request->>'notes') > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid claim fields';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_request->'items') LOOP
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_unit := coalesce((v_item->>'unitBilled')::numeric, 0);
    v_billed := coalesce((v_item->>'billedAmount')::numeric, 0);
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR (v_item ? 'quantity' AND jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number')
       OR (v_item ? 'unitBilled' AND jsonb_typeof(v_item->'unitBilled') IS DISTINCT FROM 'number')
       OR (v_item ? 'billedAmount' AND jsonb_typeof(v_item->'billedAmount') IS DISTINCT FROM 'number')
       OR length(coalesce(v_item->>'description', '')) NOT BETWEEN 1 AND 300
       OR length(v_item->>'notes') > 500
       OR v_qty <= 0 OR v_qty >= 1000000000 OR v_qty <> trunc(v_qty, 3)
       OR v_unit < 0 OR v_unit >= 10000000000 OR v_unit <> trunc(v_unit, 2)
       OR v_billed < 0 OR v_billed >= 10000000000 OR v_billed <> trunc(v_billed, 2) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid claim item precision, range or description';
    END IF;
    v_total := v_total + v_billed;
  END LOOP;
  -- Allocation is serialized by the shared generator for RPC and direct writes.
  INSERT INTO public.insv2_claims (
    organization_id, branch_id, patient_id, provider_id, plan_id, dispense_id,
    prescription_id, authorization_id, status, total_billed, currency,
    diagnosis, notes, correlation_id, created_by
  ) VALUES (
    v_org, p_branch_id, (p_request->>'patientId')::uuid, (p_request->>'providerId')::uuid,
    (p_request->>'planId')::uuid, (p_request->>'dispenseId')::uuid,
    (p_request->>'prescriptionId')::uuid, (p_request->>'authorizationId')::uuid,
    'draft', v_total, coalesce(p_request->>'currency','YER'), p_request->>'diagnosis',
    p_request->>'notes', p_correlation_id, p_actor_id
  ) RETURNING id INTO v_claim;
  INSERT INTO public.insv2_claim_items (
    claim_id, dispense_item_id, product_id, description, quantity, unit_billed, billed_amount, notes
  ) SELECT v_claim, (i->>'dispenseItemId')::uuid, (i->>'productId')::uuid,
    i->>'description', coalesce((i->>'quantity')::numeric,1), coalesce((i->>'unitBilled')::numeric,0),
    coalesce((i->>'billedAmount')::numeric,0), i->>'notes'
    FROM jsonb_array_elements(p_request->'items') AS x(i);
  -- Header reconciliation uses the stored item amounts, never JS floating point.
  SELECT sum(billed_amount) INTO v_total FROM public.insv2_claim_items WHERE claim_id = v_claim;
  UPDATE public.insv2_claims SET total_billed = v_total WHERE id = v_claim;
  INSERT INTO public.insv2_claim_status_history(claim_id, from_status, to_status, changed_by)
    VALUES(v_claim, NULL, 'draft', p_actor_id);
  PERFORM public.emit_domain_event('InsuranceClaimCreated','insurance',
    jsonb_build_object('claim_id',v_claim,'total_billed',v_total,'organization_id',v_org), 'normal', p_correlation_id);
  INSERT INTO public.audit_events(actor_user_id,organization_id,branch_id,action,resource_type,resource_id,correlation_id,payload)
    VALUES(p_actor_id,v_org,p_branch_id,'insurance.claim.create','insv2_claim',v_claim,p_correlation_id,
      jsonb_build_object('items',jsonb_array_length(p_request->'items'),'total_billed',v_total));
  INSERT INTO public.insv2_claim_create_receipts(organization_id,actor_id,idempotency_key,request_payload,branch_id,claim_id,correlation_id)
    VALUES(v_org,p_actor_id,v_key,v_payload,p_branch_id,v_claim,p_correlation_id);
  RETURN jsonb_build_object('id',v_claim,'correlationId',p_correlation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.insv2_create_claim_atomic(uuid,uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insv2_create_claim_atomic(uuid,uuid,jsonb,text) TO service_role;
COMMENT ON FUNCTION public.insv2_create_claim_atomic(uuid,uuid,jsonb,text) IS
  'Trusted server actor; atomically creates draft header/items/history/event/audit/receipt. No settlement or clinical approval.';
COMMIT;
