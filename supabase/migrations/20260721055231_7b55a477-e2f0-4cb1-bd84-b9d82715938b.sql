
-- 1) Main warehouse for Almosly Pharmacy under existing organization
INSERT INTO public.wh_warehouses (id, organization_id, code, name, kind, is_active)
VALUES (
  '22222222-2222-2222-2222-000000000001',
  '11111111-1111-1111-1111-000000000001',
  'ALMOSLY-MAIN',
  'صيدلية المصلي — المخزن الرئيسي',
  'central',
  true
) ON CONFLICT (organization_id, code) DO NOTHING;

-- 2) Unique index on store_code for idempotent imports (global scope)
CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_store_code_uniq
  ON public.catalog_products (store_code)
  WHERE store_code IS NOT NULL;

-- 3) "General" category fallback
INSERT INTO public.catalog_categories (slug, name_ar, name_en, sort_order, is_active)
VALUES ('general', 'عام', 'General', 99, true)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- 4) Image generation queue
CREATE TABLE IF NOT EXISTS public.image_generation_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  image_url text,
  storage_path text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

GRANT SELECT ON public.image_generation_queue TO authenticated;
GRANT ALL ON public.image_generation_queue TO service_role;

ALTER TABLE public.image_generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view image queue"
  ON public.image_generation_queue FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_image_queue_status ON public.image_generation_queue(status, requested_at);
