
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS sbdma_official_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_country TEXT;

CREATE INDEX IF NOT EXISTS idx_catalog_products_agent_name
  ON public.catalog_products (agent_name)
  WHERE agent_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_products_sbdma_price
  ON public.catalog_products (sbdma_official_price)
  WHERE sbdma_official_price IS NOT NULL;
