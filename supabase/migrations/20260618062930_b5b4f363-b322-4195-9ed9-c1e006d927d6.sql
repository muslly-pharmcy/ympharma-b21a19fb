
-- 1) uptime_checks
CREATE TABLE public.uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  latency_ms int,
  region text,
  error text
);
GRANT SELECT ON public.uptime_checks TO anon, authenticated;
GRANT ALL ON public.uptime_checks TO service_role;
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uptime_checks_read_all" ON public.uptime_checks FOR SELECT USING (true);
CREATE INDEX idx_uptime_checks_checked_at ON public.uptime_checks (checked_at DESC);

-- 2) uptime_incidents
CREATE TABLE public.uptime_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  summary text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.uptime_incidents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.uptime_incidents TO authenticated;
GRANT ALL ON public.uptime_incidents TO service_role;
ALTER TABLE public.uptime_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_read_all" ON public.uptime_incidents FOR SELECT USING (true);
CREATE POLICY "incidents_admin_write" ON public.uptime_incidents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON public.uptime_incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) error_logs
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'error' CHECK (level IN ('error','warn','info')),
  source text NOT NULL CHECK (source IN ('client','server')),
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  user_id uuid,
  country text,
  extra jsonb DEFAULT '{}'::jsonb
);
GRANT INSERT ON public.error_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_logs_insert_all" ON public.error_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "error_logs_admin_read" ON public.error_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "error_logs_admin_delete" ON public.error_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_error_logs_occurred_at ON public.error_logs (occurred_at DESC);
CREATE INDEX idx_error_logs_source ON public.error_logs (source);
