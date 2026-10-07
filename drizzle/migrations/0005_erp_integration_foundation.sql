CREATE TABLE public.erp_item_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_item_id text NOT NULL UNIQUE,
  product_id uuid,
  unit_code text NOT NULL DEFAULT 'BOX',
  units_per_pack numeric NOT NULL DEFAULT 1 CHECK (units_per_pack > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_branch_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_branch_id text NOT NULL UNIQUE,
  warehouse_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_idempotency (
  idempotency_key text PRIMARY KEY,
  content_hash text NOT NULL,
  endpoint text NOT NULL,
  response jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_inbound_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('catalog','stock','order_ack')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_outbound_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending_erp_review',
  erp_ack_status text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erp_stock_snapshots (
  erp_item_id text NOT NULL,
  erp_branch_id text NOT NULL,
  source_version bigint NOT NULL,
  qty_available numeric NOT NULL CHECK (qty_available >= 0),
  unit_code text NOT NULL,
  selling_price numeric,
  official_reference_price numeric,
  purchase_cost numeric,
  currency text NOT NULL DEFAULT 'YER' CHECK (currency IN ('YER','SAR','USD')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (erp_item_id, erp_branch_id)
);
CREATE TABLE public.erp_sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  erp_item_id text,
  erp_branch_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.erp_item_map, public.erp_branch_map, public.erp_idempotency, public.erp_inbound_queue,
  public.erp_outbound_queue, public.erp_stock_snapshots, public.erp_sync_conflicts TO service_role;
GRANT SELECT ON public.erp_item_map, public.erp_branch_map, public.erp_outbound_queue,
  public.erp_stock_snapshots, public.erp_sync_conflicts TO authenticated;

ALTER TABLE public.erp_item_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_branch_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_inbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read erp_item_map" ON public.erp_item_map FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read erp_branch_map" ON public.erp_branch_map FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read erp_outbound" ON public.erp_outbound_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read erp_snapshots" ON public.erp_stock_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read erp_conflicts" ON public.erp_sync_conflicts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Idempotency claim: new | replay | conflict
CREATE OR REPLACE FUNCTION public.erp_claim_idempotency(p_key text, p_hash text, p_endpoint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.erp_idempotency;
BEGIN
  INSERT INTO public.erp_idempotency(idempotency_key, content_hash, endpoint)
  VALUES (p_key, p_hash, p_endpoint) ON CONFLICT DO NOTHING;
  IF FOUND THEN RETURN jsonb_build_object('state','new'); END IF;
  SELECT * INTO r FROM public.erp_idempotency WHERE idempotency_key = p_key;
  IF r.content_hash <> p_hash OR r.endpoint <> p_endpoint THEN
    INSERT INTO public.erp_sync_conflicts(kind, detail) VALUES ('idempotency_mismatch', jsonb_build_object('endpoint', p_endpoint));
    RETURN jsonb_build_object('state','conflict');
  END IF;
  IF r.status = 'done' THEN RETURN jsonb_build_object('state','replay','response', r.response); END IF;
  RETURN jsonb_build_object('state','in_progress');
END $$;

CREATE OR REPLACE FUNCTION public.erp_finish_idempotency(p_key text, p_response jsonb, p_ok boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_ok THEN
    UPDATE public.erp_idempotency SET status='done', response=p_response WHERE idempotency_key=p_key;
  ELSE
    DELETE FROM public.erp_idempotency WHERE idempotency_key=p_key AND status='processing';
  END IF;
END $$;

-- Snapshot apply: per-row version guard, stale rows recorded, never touches inv ledger.
CREATE OR REPLACE FUNCTION public.erp_apply_stock_snapshots(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; applied int := 0; stale int := 0; invalid int := 0; cur bigint;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    IF coalesce(r->>'erp_item_id','')='' OR coalesce(r->>'erp_branch_id','')=''
       OR (r->>'source_version') IS NULL OR coalesce((r->>'qty_available')::numeric,-1) < 0
       OR coalesce(r->>'unit_code','')='' THEN
      invalid := invalid + 1;
      INSERT INTO public.erp_sync_conflicts(kind, erp_item_id, erp_branch_id, detail)
      VALUES ('invalid_row', r->>'erp_item_id', r->>'erp_branch_id', '{}'::jsonb);
      CONTINUE;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext((r->>'erp_item_id')||'|'||(r->>'erp_branch_id')));
    SELECT source_version INTO cur FROM public.erp_stock_snapshots
      WHERE erp_item_id=r->>'erp_item_id' AND erp_branch_id=r->>'erp_branch_id';
    IF cur IS NOT NULL AND cur >= (r->>'source_version')::bigint THEN
      stale := stale + 1;
      INSERT INTO public.erp_sync_conflicts(kind, erp_item_id, erp_branch_id, detail)
      VALUES ('stale_version', r->>'erp_item_id', r->>'erp_branch_id',
        jsonb_build_object('current', cur, 'incoming', (r->>'source_version')::bigint));
      CONTINUE;
    END IF;
    INSERT INTO public.erp_stock_snapshots AS s(erp_item_id, erp_branch_id, source_version, qty_available, unit_code,
      selling_price, official_reference_price, purchase_cost, currency, applied_at)
    VALUES (r->>'erp_item_id', r->>'erp_branch_id', (r->>'source_version')::bigint, (r->>'qty_available')::numeric,
      r->>'unit_code', (r->>'selling_price')::numeric, (r->>'official_reference_price')::numeric,
      (r->>'purchase_cost')::numeric, coalesce(r->>'currency','YER'), now())
    ON CONFLICT (erp_item_id, erp_branch_id) DO UPDATE SET
      source_version=excluded.source_version, qty_available=excluded.qty_available, unit_code=excluded.unit_code,
      selling_price=excluded.selling_price, official_reference_price=excluded.official_reference_price,
      purchase_cost=excluded.purchase_cost, currency=excluded.currency, applied_at=now();
    applied := applied + 1;
  END LOOP;
  RETURN jsonb_build_object('applied', applied, 'stale', stale, 'invalid', invalid);
END $$;

REVOKE ALL ON FUNCTION public.erp_claim_idempotency(text,text,text), public.erp_finish_idempotency(text,jsonb,boolean),
  public.erp_apply_stock_snapshots(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_claim_idempotency(text,text,text), public.erp_finish_idempotency(text,jsonb,boolean),
  public.erp_apply_stock_snapshots(jsonb) TO service_role;