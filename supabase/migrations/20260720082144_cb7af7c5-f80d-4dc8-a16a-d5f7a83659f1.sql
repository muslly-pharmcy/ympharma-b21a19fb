
-- Indexes for search/list performance
CREATE INDEX IF NOT EXISTS idx_catalog_products_status_org
  ON public.catalog_products (status, organization_id)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_catalog_products_category
  ON public.catalog_products (category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_products_name_ar
  ON public.catalog_products USING gin (to_tsvector('simple', coalesce(name_ar,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(brand,'')));

CREATE INDEX IF NOT EXISTS idx_inv_stock_batches_product_expiry
  ON public.inv_stock_batches (product_id, expiry_date NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_inv_stock_batches_org_wh
  ON public.inv_stock_batches (organization_id, warehouse_id);

-- Canonical domain event emitter used by catalog / inventory / supplier services
CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_event_type text,
  p_source     text,
  p_payload    jsonb DEFAULT '{}'::jsonb,
  p_priority   text  DEFAULT 'normal',
  p_correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_events (
    event_type, source, payload, priority, status, correlation_id, created_at
  )
  VALUES (
    p_event_type,
    p_source,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_priority, 'normal'),
    'pending',
    p_correlation_id,
    now()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_domain_event(text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_domain_event(text, text, jsonb, text, text) TO authenticated, service_role;
