
-- 1) Manual stock adjustments audit table
CREATE TABLE IF NOT EXISTS public.inventory_manual_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  before_qty integer NOT NULL,
  after_qty integer NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  performed_by uuid,
  db_user text DEFAULT current_user,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_manual_adj_product ON public.inventory_manual_adjustments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_manual_adj_actor ON public.inventory_manual_adjustments(performed_by, created_at DESC);

GRANT SELECT, INSERT ON public.inventory_manual_adjustments TO authenticated;
GRANT ALL ON public.inventory_manual_adjustments TO service_role;

ALTER TABLE public.inventory_manual_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read manual adj" ON public.inventory_manual_adjustments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service write manual adj" ON public.inventory_manual_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2) Trigger: log every stock_qty change on products
CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_source text;
BEGIN
  IF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty THEN
    v_reason := current_setting('app.adjust_reason', true);
    v_source := COALESCE(NULLIF(current_setting('app.adjust_source', true), ''), 'manual');
    INSERT INTO public.inventory_manual_adjustments
      (product_id, delta, before_qty, after_qty, reason, source, performed_by)
    VALUES (
      NEW.id,
      COALESCE(NEW.stock_qty, 0) - COALESCE(OLD.stock_qty, 0),
      COALESCE(OLD.stock_qty, 0),
      COALESCE(NEW.stock_qty, 0),
      NULLIF(v_reason, ''),
      v_source,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_stock_change ON public.products;
CREATE TRIGGER trg_log_product_stock_change
  AFTER UPDATE OF stock_qty ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_stock_change();

-- 3) Fix prescription upload: allow uploader (anon) to read their own files in uploads/
--    so createSignedUrl works right after upload. Paths use random refIds.
DROP POLICY IF EXISTS "uploader read prescription uploads" ON storage.objects;
CREATE POLICY "uploader read prescription uploads" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = 'uploads'
  );
