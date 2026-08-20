
CREATE TABLE IF NOT EXISTS public.prescription_image_blobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rx_id text NOT NULL,
  storage_path text NOT NULL,
  content_bytes bytea NOT NULL,
  content_type text NOT NULL DEFAULT 'image/jpeg',
  byte_size integer NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rx_id, sha256)
);

CREATE INDEX IF NOT EXISTS prescription_image_blobs_rx_idx ON public.prescription_image_blobs(rx_id);
CREATE INDEX IF NOT EXISTS prescription_image_blobs_created_idx ON public.prescription_image_blobs(created_at DESC);

GRANT SELECT ON public.prescription_image_blobs TO authenticated;
GRANT ALL ON public.prescription_image_blobs TO service_role;

ALTER TABLE public.prescription_image_blobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view image blobs"
  ON public.prescription_image_blobs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Service role manages blobs"
  ON public.prescription_image_blobs
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.verify_prescription_image_coverage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_with_blob int;
  v_blob_count int;
  v_total_bytes bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COUNT(*) INTO v_total FROM public.prescriptions;
  SELECT COUNT(DISTINCT rx_id) INTO v_with_blob FROM public.prescription_image_blobs;
  SELECT COUNT(*), COALESCE(SUM(byte_size),0) INTO v_blob_count, v_total_bytes FROM public.prescription_image_blobs;
  RETURN jsonb_build_object(
    'prescriptions_total', v_total,
    'prescriptions_with_backup', v_with_blob,
    'coverage_pct', CASE WHEN v_total=0 THEN 100 ELSE round((v_with_blob::numeric / v_total) * 100, 2) END,
    'blob_count', v_blob_count,
    'total_bytes', v_total_bytes,
    'checked_at', now()
  );
END; $$;

CREATE OR REPLACE FUNCTION public.create_scheduled_backup(_kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_payload jsonb;
  v_orders int;
  v_rx int;
  v_blobs int;
BEGIN
  IF _kind NOT IN ('daily','weekly') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  SELECT COUNT(*) INTO v_orders FROM public.orders;
  SELECT COUNT(*) INTO v_rx FROM public.prescriptions;
  SELECT COUNT(*) INTO v_blobs FROM public.prescription_image_blobs;
  v_payload := jsonb_build_object(
    'generated_at', now(),
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.orders o), '[]'::jsonb),
    'prescriptions', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.prescriptions p), '[]'::jsonb),
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.products p), '[]'::jsonb),
    'offers', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.offers o), '[]'::jsonb),
    'image_blob_count', v_blobs
  );
  INSERT INTO public.backups(kind, orders_count, rx_count, payload)
  VALUES (_kind, v_orders, v_rx, v_payload)
  RETURNING id INTO v_id;
  DELETE FROM public.backups WHERE id IN (
    SELECT id FROM public.backups WHERE kind=_kind ORDER BY created_at DESC
    OFFSET CASE WHEN _kind='daily' THEN 14 ELSE 8 END
  );
  RETURN v_id;
END; $$;
