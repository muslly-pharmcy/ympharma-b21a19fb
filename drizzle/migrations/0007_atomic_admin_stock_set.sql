-- STAGING CANDIDATE ONLY. Apply transactionally after review and acceptance tests.
-- No fabricated lot/expiry: an increase needs exactly one existing batch.
BEGIN;
ALTER TABLE public.inv_stock_batches ADD CONSTRAINT inv_stock_batches_reserved_within_on_hand
  CHECK (qty_reserved <= qty_on_hand) NOT VALID;
ALTER TABLE public.inv_stock_batches VALIDATE CONSTRAINT inv_stock_batches_reserved_within_on_hand;
CREATE TABLE public.inv_stock_set_requests (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  idempotency_key uuid NOT NULL,
  request jsonb NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, idempotency_key)
);
REVOKE ALL ON public.inv_stock_set_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inv_stock_set_requests TO service_role;
ALTER TABLE public.inv_stock_set_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_stock_set_service ON public.inv_stock_set_requests
  TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION public.inv_set_product_stock(
  p_org uuid, p_product uuid, p_expected numeric, p_new numeric,
  p_actor uuid, p_key uuid, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_request jsonb;
  v_saved public.inv_stock_set_requests%ROWTYPE;
  v_current numeric;
  v_reserved numeric;
  v_delta numeric;
  v_remaining numeric;
  v_take numeric;
  v_count integer;
  v_batch record;
  v_response jsonb;
BEGIN
  IF p_org IS NULL OR p_product IS NULL OR p_actor IS NULL OR p_key IS NULL
     OR p_expected IS NULL OR p_new IS NULL OR p_new < 0 OR p_expected < 0
     OR p_new::text IN ('NaN','Infinity','-Infinity')
     OR p_expected::text IN ('NaN','Infinity','-Infinity')
     OR p_new > 99999999999 OR p_expected > 99999999999
     OR p_new <> trunc(p_new) OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 2 AND 200 THEN
    RAISE EXCEPTION 'INVALID_STOCK_SET' USING ERRCODE = '22023';
  END IF;
  -- The screen sets organization-wide stock: branch-limited actors must use batch workflows.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = p_actor AND m.organization_id = p_org AND m.status = 'active'
      AND coalesce(cardinality(m.branch_scope),0) = 0
  ) OR NOT public.has_org_permission(p_actor, p_org, 'inventory.write') THEN
    RAISE EXCEPTION 'STOCK_SET_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  v_request := jsonb_build_object('product',p_product,'expected',p_expected,
    'new',p_new,'actor',p_actor,'reason',p_reason);
  INSERT INTO public.inv_stock_set_requests(organization_id,idempotency_key,request)
    VALUES(p_org,p_key,v_request) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_saved FROM public.inv_stock_set_requests
    WHERE organization_id=p_org AND idempotency_key=p_key FOR UPDATE;
  IF v_saved.request <> v_request THEN
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = '22023';
  END IF;
  IF v_saved.response IS NOT NULL THEN RETURN v_saved.response; END IF;

  PERFORM 1 FROM public.catalog_products WHERE id=p_product AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_SET_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  -- Lock every existing batch before computing totals (including reserved batches).
  PERFORM id FROM public.inv_stock_batches WHERE product_id=p_product AND organization_id=p_org
    ORDER BY id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.inv_stock_batches b LEFT JOIN public.wh_warehouses w ON w.id=b.warehouse_id
    WHERE b.product_id=p_product AND b.organization_id=p_org
      AND (w.id IS NULL OR w.organization_id<>p_org OR NOT w.is_active)
  ) THEN RAISE EXCEPTION 'STOCK_WAREHOUSE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  SELECT coalesce(sum(qty_on_hand),0),coalesce(sum(qty_reserved),0),count(*)
    INTO v_current,v_reserved,v_count FROM public.inv_stock_batches
    WHERE product_id=p_product AND organization_id=p_org;
  IF v_current <> p_expected THEN RAISE EXCEPTION 'STOCK_BALANCE_CHANGED' USING ERRCODE = '40001'; END IF;
  IF p_new < v_reserved THEN RAISE EXCEPTION 'STOCK_RESERVED' USING ERRCODE = '23514'; END IF;
  v_delta := p_new-v_current;
  IF v_delta > 0 AND (v_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.inv_stock_batches WHERE product_id=p_product AND organization_id=p_org
      AND nullif(trim(batch_no),'') IS NOT NULL AND expiry_date > CURRENT_DATE
  )) THEN
    RAISE EXCEPTION 'RECEIVE_OR_SELECT_BATCH_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_remaining := abs(v_delta);
  FOR v_batch IN SELECT * FROM public.inv_stock_batches
    WHERE product_id=p_product AND organization_id=p_org ORDER BY id
  LOOP
    EXIT WHEN v_remaining=0;
    v_take := CASE WHEN v_delta>0 THEN v_remaining
      ELSE least(v_remaining, v_batch.qty_on_hand-v_batch.qty_reserved) END;
    IF v_take > 0 THEN
      PERFORM public.inv_adjust_stock(v_batch.id,
        CASE WHEN v_delta>0 THEN v_take ELSE -v_take END,
        p_reason,p_actor,p_key::text);
      v_remaining := v_remaining-v_take;
    END IF;
  END LOOP;
  IF v_remaining<>0 THEN RAISE EXCEPTION 'STOCK_SET_INCOMPLETE'; END IF;
  v_response := jsonb_build_object('ok',true,'delta',v_delta,'newBalance',p_new);
  UPDATE public.inv_stock_set_requests SET response=v_response
    WHERE organization_id=p_org AND idempotency_key=p_key;
  RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION public.inv_set_product_stock(uuid,uuid,numeric,numeric,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_set_product_stock(uuid,uuid,numeric,numeric,uuid,uuid,text)
  TO service_role;
COMMIT;
