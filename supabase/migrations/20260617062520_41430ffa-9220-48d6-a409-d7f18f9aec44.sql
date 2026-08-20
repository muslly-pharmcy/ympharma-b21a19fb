
-- Backups table to store periodic snapshots
CREATE TABLE IF NOT EXISTS public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('daily','weekly','manual')),
  orders_count int NOT NULL DEFAULT 0,
  rx_count int NOT NULL DEFAULT 0,
  payload jsonb NOT NULL
);

GRANT SELECT, INSERT, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read backups" ON public.backups FOR SELECT
  TO authenticated USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "owners insert backups" ON public.backups FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "owners delete backups" ON public.backups FOR DELETE
  TO authenticated USING (has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS backups_created_at_idx ON public.backups(created_at DESC);

-- Function that produces a full snapshot (owner/admin only)
CREATE OR REPLACE FUNCTION public.create_backup(_kind text DEFAULT 'manual')
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
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _kind NOT IN ('daily','weekly','manual') THEN _kind := 'manual'; END IF;

  SELECT COUNT(*) INTO v_orders FROM public.orders;
  SELECT COUNT(*) INTO v_rx FROM public.prescriptions;

  v_payload := jsonb_build_object(
    'generated_at', now(),
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.orders o), '[]'::jsonb),
    'prescriptions', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.prescriptions p), '[]'::jsonb),
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.products p), '[]'::jsonb),
    'offers', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.offers o), '[]'::jsonb)
  );

  INSERT INTO public.backups(kind, orders_count, rx_count, payload)
  VALUES (_kind, v_orders, v_rx, v_payload)
  RETURNING id INTO v_id;

  -- Retention: keep last 14 daily, last 8 weekly, last 30 manual
  DELETE FROM public.backups WHERE id IN (
    SELECT id FROM public.backups WHERE kind='daily'
    ORDER BY created_at DESC OFFSET 14
  );
  DELETE FROM public.backups WHERE id IN (
    SELECT id FROM public.backups WHERE kind='weekly'
    ORDER BY created_at DESC OFFSET 8
  );
  DELETE FROM public.backups WHERE id IN (
    SELECT id FROM public.backups WHERE kind='manual'
    ORDER BY created_at DESC OFFSET 30
  );

  RETURN v_id;
END; $$;

-- Scheduled daily + weekly backups via pg_cron (security definer bypass: use a dedicated function that doesn't need auth.uid)
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
BEGIN
  IF _kind NOT IN ('daily','weekly') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  SELECT COUNT(*) INTO v_orders FROM public.orders;
  SELECT COUNT(*) INTO v_rx FROM public.prescriptions;
  v_payload := jsonb_build_object(
    'generated_at', now(),
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.orders o), '[]'::jsonb),
    'prescriptions', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.prescriptions p), '[]'::jsonb),
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.products p), '[]'::jsonb),
    'offers', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.offers o), '[]'::jsonb)
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

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing if any
DO $$
BEGIN
  PERFORM cron.unschedule('backup-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='backup-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('backup-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='backup-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('backup-daily', '0 2 * * *', $$SELECT public.create_scheduled_backup('daily');$$);
SELECT cron.schedule('backup-weekly', '0 3 * * 0', $$SELECT public.create_scheduled_backup('weekly');$$);
