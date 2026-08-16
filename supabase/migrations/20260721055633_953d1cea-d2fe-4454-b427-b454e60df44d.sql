
-- Load products from external tsv (already in /tmp on sandbox — but migration runs in DB, not sandbox).
-- Since we can't COPY from a file the DB can't see, we use a helper: create staging table,
-- then the SANDBOX psql session (running under postgres-equivalent) loads it.
CREATE TABLE IF NOT EXISTS public._import_products_stage (
  id uuid, org uuid, owner_org uuid, category_id uuid,
  name_ar text, pack_unit text, store_code text, sell_price numeric,
  status text, is_public boolean
);
CREATE TABLE IF NOT EXISTS public._import_batches_stage (
  id uuid, org uuid, wh uuid, product_id uuid,
  qty numeric, cost numeric, sell numeric, expiry date
);
GRANT ALL ON public._import_products_stage, public._import_batches_stage TO authenticated, service_role, anon;
ALTER TABLE public._import_products_stage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public._import_batches_stage DISABLE ROW LEVEL SECURITY;
