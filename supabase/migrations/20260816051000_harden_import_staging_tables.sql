-- Import staging tables are service-only implementation details and must not
-- be exposed through PostgREST to anonymous or signed-in browser clients.
ALTER TABLE public._import_products_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._import_batches_stage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public._import_products_stage FROM anon, authenticated;
REVOKE ALL ON public._import_batches_stage FROM anon, authenticated;

GRANT ALL ON public._import_products_stage TO service_role;
GRANT ALL ON public._import_batches_stage TO service_role;
