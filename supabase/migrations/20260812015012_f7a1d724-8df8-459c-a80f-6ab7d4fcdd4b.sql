CREATE TABLE public.crm_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  category text NOT NULL,
  full_name text,
  phone text,
  details text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crm_sync_log TO authenticated;
GRANT ALL ON public.crm_sync_log TO service_role;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_sync_log_admin_read" ON public.crm_sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX crm_sync_log_status_idx ON public.crm_sync_log (status, created_at DESC);

CREATE TABLE public.kernel_module_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  latency_ms integer,
  error_rate numeric(6,3) NOT NULL DEFAULT 0,
  budget_used numeric(12,4) NOT NULL DEFAULT 0,
  runs integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kernel_module_telemetry TO authenticated;
GRANT ALL ON public.kernel_module_telemetry TO service_role;
ALTER TABLE public.kernel_module_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kernel_telemetry_staff_read" ON public.kernel_module_telemetry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX kernel_module_telemetry_module_idx ON public.kernel_module_telemetry (module_key, observed_at DESC);

CREATE TRIGGER crm_sync_log_touch BEFORE UPDATE ON public.crm_sync_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER kernel_module_telemetry_touch BEFORE UPDATE ON public.kernel_module_telemetry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();