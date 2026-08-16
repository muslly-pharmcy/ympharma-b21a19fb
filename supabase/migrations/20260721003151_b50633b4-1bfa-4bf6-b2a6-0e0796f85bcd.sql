
CREATE TYPE public.catalog_import_status AS ENUM ('analyzing','analyzed','committing','committed','failed');
CREATE TYPE public.catalog_import_decision AS ENUM ('matched','new','ambiguous','invalid');

CREATE TABLE public.catalog_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dry_run boolean NOT NULL DEFAULT true,
  status public.catalog_import_status NOT NULL DEFAULT 'analyzing',
  total_rows int NOT NULL DEFAULT 0,
  matched_count int NOT NULL DEFAULT 0,
  new_count int NOT NULL DEFAULT 0,
  ambiguous_count int NOT NULL DEFAULT 0,
  invalid_count int NOT NULL DEFAULT 0,
  error text,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.catalog_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.catalog_import_jobs(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  payload jsonb NOT NULL,
  decision public.catalog_import_decision NOT NULL,
  matched_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  candidate_ids uuid[] NOT NULL DEFAULT '{}',
  confidence numeric(4,3),
  reason text,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_import_rows_job ON public.catalog_import_rows(job_id, decision);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_import_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_import_rows TO authenticated;
GRANT ALL ON public.catalog_import_jobs TO service_role;
GRANT ALL ON public.catalog_import_rows TO service_role;

ALTER TABLE public.catalog_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_import_jobs_admin_all" ON public.catalog_import_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "cat_import_rows_admin_all" ON public.catalog_import_rows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_cat_import_jobs_updated
  BEFORE UPDATE ON public.catalog_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
