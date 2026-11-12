-- YmPharma ERP v2: STAGING CANDIDATE ONLY. NOT APPLIED TO PRODUCTION.
-- Existing v1 migration 0005 is not safe for multiple organizations; this is
-- a fully separate schema/contract with no v1 data or inventory updates.
-- Run as one transaction on an isolated, backed-up PostgreSQL staging branch.
BEGIN;

CREATE TABLE public.erp2_item_map (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  external_item text NOT NULL CHECK (length(external_item) BETWEEN 1 AND 120),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  unit_code text NOT NULL CHECK (length(unit_code) BETWEEN 1 AND 20),
  units_per_pack numeric(15,4) NOT NULL CHECK (units_per_pack > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, external_item),
  UNIQUE (org_id, product_id, unit_code)
);

CREATE TABLE public.erp2_branch_map (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  external_branch text NOT NULL CHECK (length(external_branch) BETWEEN 1 AND 120),
  warehouse_id uuid NOT NULL REFERENCES public.wh_warehouses(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, external_branch),
  UNIQUE (org_id, warehouse_id)
);

CREATE TABLE public.erp2_stock_snapshots (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  external_item text NOT NULL,
  external_branch text NOT NULL,
  source_version bigint NOT NULL CHECK (source_version >= 0),
  qty_available numeric(15,4) NOT NULL CHECK (qty_available >= 0),
  unit_code text NOT NULL,
  selling_price numeric(15,4) CHECK (selling_price IS NULL OR selling_price >= 0),
  official_reference_price numeric(15,4)
    CHECK (official_reference_price IS NULL OR official_reference_price >= 0),
  currency text NOT NULL CHECK (currency IN ('YER','SAR','USD')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, external_item, external_branch),
  FOREIGN KEY (org_id, external_item)
    REFERENCES public.erp2_item_map(org_id, external_item) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, external_branch)
    REFERENCES public.erp2_branch_map(org_id, external_branch) ON DELETE RESTRICT
);

CREATE TABLE public.erp2_idempotency (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[a-zA-Z0-9_-]{16,128}$'),
  endpoint text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (org_id, idempotency_key)
);

-- order_id is TEXT in public.orders, not UUID. Nothing inserts into
-- this queue automatically until an organization-verified producer is reviewed.
CREATE TABLE public.erp2_outbound_queue (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  order_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending_erp_review'
    CHECK (status IN ('pending_erp_review','reviewed','cancelled')),
  erp_ack_status text CHECK (erp_ack_status IN ('received','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, order_id)
);
CREATE INDEX erp2_outbound_pending ON public.erp2_outbound_queue
 (org_id, status, created_at, order_id);

CREATE TABLE public.erp2_sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp2_conflicts_org_time ON public.erp2_sync_conflicts(org_id, created_at DESC);

-- All ERP integration tables remain invisible to browser roles.
-- service_role is trusted server-only; it bypasses RLS. Do not expose its key.
ALTER TABLE public.erp2_item_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp2_branch_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp2_stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp2_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp2_outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp2_sync_conflicts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.erp2_item_map, public.erp2_branch_map,
  public.erp2_stock_snapshots, public.erp2_idempotency,
  public.erp2_outbound_queue, public.erp2_sync_conflicts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.erp2_item_map, public.erp2_branch_map,
  public.erp2_stock_snapshots, public.erp2_idempotency,
  public.erp2_outbound_queue, public.erp2_sync_conflicts
  TO service_role;

CREATE FUNCTION public.erp2_claim_idempotency(
  p_org_id uuid, p_key text, p_hash text, p_endpoint text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE existing public.erp2_idempotency%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ERP_ORGANIZATION_INACTIVE' USING ERRCODE = '22023';
  END IF;
  IF p_key !~ '^[a-zA-Z0-9_-]{16,128}$'
     OR p_hash !~ '^[0-9a-f]{64}$'
     OR p_endpoint NOT LIKE '/api/public/erp/v2/%'
     OR length(p_endpoint) > 200 THEN
    RAISE EXCEPTION 'ERP_INVALID_IDEMPOTENCY_INPUT' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.erp2_idempotency(org_id,idempotency_key,content_hash,endpoint)
  VALUES(p_org_id,p_key,p_hash,p_endpoint)
  ON CONFLICT (org_id,idempotency_key) DO NOTHING;
  IF FOUND THEN RETURN jsonb_build_object('state','new'); END IF;

  SELECT * INTO STRICT existing
  FROM public.erp2_idempotency
  WHERE org_id = p_org_id AND idempotency_key = p_key
  FOR UPDATE;
  IF existing.content_hash <> p_hash OR existing.endpoint <> p_endpoint THEN
    RETURN jsonb_build_object('state','conflict');
  END IF;
  IF existing.status = 'done' THEN
    RETURN jsonb_build_object('state','replay','response',existing.response);
  END IF;
  -- Fail closed: processing claims have no automatic replay/expiry.
  RETURN jsonb_build_object('state','in_progress');
END $$;

CREATE FUNCTION public.erp2_finish_idempotency(
  p_org_id uuid, p_key text, p_response jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Missing/null statuses must be rejected explicitly; NULL comparisons
  -- cannot guard the transition to done. Validate before any integer cast.
  IF jsonb_typeof(p_response) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_response->'status') IS DISTINCT FROM 'number'
     OR COALESCE(p_response->>'status', '') !~ '^[2-4][0-9]{2}$' THEN
    RAISE EXCEPTION 'ERP_INVALID_IDEMPOTENCY_COMPLETION' USING ERRCODE = '22023';
  END IF;
  UPDATE public.erp2_idempotency
     SET status = 'done', response = p_response, completed_at = now()
   WHERE org_id = p_org_id AND idempotency_key = p_key AND status = 'processing';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERP_IDEMPOTENCY_CLAIM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END $$;

-- Data is a website-facing snapshot ONLY: no physical batch, order, sale,
-- purchase_cost, or financial journal table is touched by this RPC.
CREATE FUNCTION public.erp2_apply_stock_snapshots(
  p_org_id uuid, p_rows jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  r jsonb;
  v_applied integer := 0;
  v_stale integer := 0;
  v_affected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ERP_ORGANIZATION_INACTIVE' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'ERP_INVALID_BATCH' USING ERRCODE = '22023';
  END IF;

  -- Order all rows deterministically to reduce concurrent upsert deadlocks.
  FOR r IN
    SELECT value FROM jsonb_array_elements(p_rows) AS source(value)
     ORDER BY value->>'external_item', value->>'external_branch', value->>'source_version'
  LOOP
    IF jsonb_typeof(r) IS DISTINCT FROM 'object'
       OR COALESCE(r->>'external_item','') = ''
       OR length(r->>'external_item') > 120
       OR COALESCE(r->>'external_branch','') = ''
       OR length(r->>'external_branch') > 120
       OR COALESCE(r->>'unit_code','') = ''
       OR length(r->>'unit_code') > 20
       OR COALESCE(r->>'source_version','') !~ '^[0-9]{1,15}$'
       OR COALESCE(r->>'qty_available','') !~ '^[0-9]{1,11}(\.[0-9]{1,4})?$'
       OR (r->>'currency') NOT IN ('YER','SAR','USD')
       OR ((r ? 'selling_price') AND r->>'selling_price' IS NOT NULL
           AND r->>'selling_price' !~ '^[0-9]{1,11}(\.[0-9]{1,4})?$')
       OR ((r ? 'official_reference_price') AND r->>'official_reference_price' IS NOT NULL
           AND r->>'official_reference_price' !~ '^[0-9]{1,11}(\.[0-9]{1,4})?$')
    THEN
      RAISE EXCEPTION 'ERP_INVALID_STOCK_ROW' USING ERRCODE = '22023';
    END IF;

    -- Reject unmapped and other-org identities, and any unreviewed or
    -- unpublished product; global catalog products require explicit approval
    -- and organization assignment before ERP synchronization.
    IF NOT EXISTS (
      SELECT 1 FROM public.erp2_item_map im
      JOIN public.catalog_products cp ON cp.id = im.product_id
      JOIN public.erp2_branch_map bm ON bm.org_id = im.org_id
      JOIN public.wh_warehouses wh ON wh.id = bm.warehouse_id
      WHERE im.org_id = p_org_id
        AND im.external_item = r->>'external_item'
        AND im.unit_code = r->>'unit_code'
        AND cp.organization_id = p_org_id
        AND cp.status::text = 'approved' AND cp.is_public = true
        AND bm.external_branch = r->>'external_branch'
        AND wh.organization_id = p_org_id AND wh.is_active = true
    ) THEN
      RAISE EXCEPTION 'ERP_ORGANIZATION_MAPPING_NOT_APPROVED'
        USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.erp2_stock_snapshots AS snapshot(
      org_id,external_item,external_branch,source_version,
      qty_available,unit_code,selling_price,official_reference_price,currency
    ) VALUES (
      p_org_id,r->>'external_item',r->>'external_branch',
      (r->>'source_version')::bigint,(r->>'qty_available')::numeric,
      r->>'unit_code',(r->>'selling_price')::numeric,
      (r->>'official_reference_price')::numeric,r->>'currency'
    )
    ON CONFLICT (org_id,external_item,external_branch) DO UPDATE
      SET source_version = excluded.source_version,
          qty_available = excluded.qty_available,
          unit_code = excluded.unit_code,
          selling_price = excluded.selling_price,
          official_reference_price = excluded.official_reference_price,
          currency = excluded.currency,
          applied_at = now()
      WHERE snapshot.source_version < excluded.source_version;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected = 1 THEN v_applied := v_applied + 1;
    ELSE v_stale := v_stale + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('applied',v_applied,'stale',v_stale);
END $$;

REVOKE ALL ON FUNCTION
  public.erp2_claim_idempotency(uuid,text,text,text),
  public.erp2_finish_idempotency(uuid,text,jsonb),
  public.erp2_apply_stock_snapshots(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.erp2_claim_idempotency(uuid,text,text,text),
  public.erp2_finish_idempotency(uuid,text,jsonb),
  public.erp2_apply_stock_snapshots(uuid,jsonb)
  TO service_role;

COMMIT;
