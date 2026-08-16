
-- ========== 1) idempotency_keys ==========
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  scope TEXT NOT NULL,
  request_hash TEXT,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON public.idempotency_keys (expires_at);

GRANT ALL ON public.idempotency_keys TO service_role;

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read idempotency_keys"
  ON public.idempotency_keys FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- ========== 2) retention_policies ==========
CREATE TABLE IF NOT EXISTS public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  timestamp_column TEXT NOT NULL DEFAULT 'archived_at',
  retain_days INTEGER NOT NULL CHECK (retain_days > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_deleted INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read retention_policies"
  ON public.retention_policies FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- Seed defaults (only if not already configured)
INSERT INTO public.retention_policies (table_name, timestamp_column, retain_days)
VALUES
  ('error_logs_archive', 'archived_at', 90),
  ('uptime_incidents_archive', 'archived_at', 180),
  ('idempotency_keys', 'expires_at', 7)
ON CONFLICT (table_name) DO NOTHING;

-- ========== 3) apply_retention_policies() ==========
CREATE OR REPLACE FUNCTION public.apply_retention_policies()
RETURNS TABLE (table_name TEXT, deleted INTEGER, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pol RECORD;
  v_sql TEXT;
  v_deleted INTEGER;
  v_err TEXT;
BEGIN
  FOR pol IN
    SELECT id, rp.table_name, timestamp_column, retain_days
    FROM public.retention_policies rp
    WHERE enabled = true
  LOOP
    BEGIN
      v_sql := format(
        'DELETE FROM public.%I WHERE %I < now() - interval ''%s days''',
        pol.table_name, pol.timestamp_column, pol.retain_days
      );
      EXECUTE v_sql;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

      UPDATE public.retention_policies
        SET last_run_at = now(), last_deleted = v_deleted, last_error = NULL
        WHERE id = pol.id;

      table_name := pol.table_name;
      deleted := v_deleted;
      error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      UPDATE public.retention_policies
        SET last_run_at = now(), last_error = v_err
        WHERE id = pol.id;
      table_name := pol.table_name;
      deleted := 0;
      error := v_err;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_retention_policies() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_retention_policies() TO service_role;

-- ========== 4) cleanup_idempotency_keys() ==========
CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_idempotency_keys() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_idempotency_keys() TO service_role;
