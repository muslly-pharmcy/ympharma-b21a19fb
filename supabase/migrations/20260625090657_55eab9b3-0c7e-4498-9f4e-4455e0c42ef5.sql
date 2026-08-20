
-- alert_settings: singleton row (id=1)
CREATE TABLE IF NOT EXISTS public.alert_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  uptime_threshold_pct integer NOT NULL DEFAULT 50,
  growth_threshold_pct integer NOT NULL DEFAULT -25,
  overdue_orders_threshold integer NOT NULL DEFAULT 5,
  errors_threshold integer NOT NULL DEFAULT 50,
  enable_uptime boolean NOT NULL DEFAULT true,
  enable_growth boolean NOT NULL DEFAULT true,
  enable_overdue boolean NOT NULL DEFAULT true,
  enable_errors boolean NOT NULL DEFAULT true,
  enable_slack boolean NOT NULL DEFAULT true,
  enable_sms boolean NOT NULL DEFAULT false,
  enable_whatsapp boolean NOT NULL DEFAULT false,
  enable_email boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.alert_settings TO authenticated;
GRANT ALL ON public.alert_settings TO service_role;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read alert_settings" ON public.alert_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "admins write alert_settings" ON public.alert_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));
INSERT INTO public.alert_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- alert_subscribers
CREATE TABLE IF NOT EXISTS public.alert_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  phone_e164 text NOT NULL,
  receive_sms boolean NOT NULL DEFAULT true,
  receive_whatsapp boolean NOT NULL DEFAULT true,
  min_severity text NOT NULL DEFAULT 'high',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,15}$'),
  CHECK (min_severity IN ('low','medium','high','critical'))
);
CREATE UNIQUE INDEX IF NOT EXISTS alert_subscribers_phone_uq ON public.alert_subscribers(phone_e164);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_subscribers TO authenticated;
GRANT ALL ON public.alert_subscribers TO service_role;
ALTER TABLE public.alert_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage alert_subscribers" ON public.alert_subscribers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- Update get_agent_alerts to honor thresholds + toggles
CREATE OR REPLACE FUNCTION public.get_agent_alerts()
RETURNS TABLE(alert_key text, agent text, severity text, message text, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.alert_settings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.alert_settings WHERE id=1;
  IF NOT FOUND THEN
    s.uptime_threshold_pct := 50;
    s.growth_threshold_pct := -25;
    s.overdue_orders_threshold := 5;
    s.errors_threshold := 50;
    s.enable_uptime := true; s.enable_growth := true; s.enable_overdue := true; s.enable_errors := true;
  END IF;

  -- Uptime alerts (latest CTO run)
  IF s.enable_uptime THEN
    RETURN QUERY
    WITH latest AS (
      SELECT details FROM public.agent_runs
      WHERE agent::text='cto' AND created_at > now() - interval '6 hours'
      ORDER BY created_at DESC LIMIT 1
    )
    SELECT
      'uptime_low_'||to_char(now(),'YYYYMMDDHH24'),
      'cto'::text,
      CASE WHEN COALESCE((details->>'uptime_pct')::numeric,0) = 0 THEN 'critical' ELSE 'high' END,
      'Uptime منخفض: '||COALESCE(details->>'uptime_pct','?')||'%',
      details
    FROM latest
    WHERE COALESCE((details->>'uptime_pct')::numeric, 100) < s.uptime_threshold_pct;
  END IF;

  -- Errors threshold (last 24h from agent_runs failure summary)
  IF s.enable_errors THEN
    RETURN QUERY
    SELECT
      'errors_high_'||to_char(now(),'YYYYMMDDHH24'),
      'system'::text,
      'high'::text,
      'عدد أخطاء مرتفع: '||c::text||' في 24 ساعة',
      jsonb_build_object('errors_24h', c)
    FROM (
      SELECT count(*)::int AS c FROM public.error_logs WHERE created_at > now() - interval '24 hours'
    ) q
    WHERE c > s.errors_threshold;
  END IF;

  -- Overdue orders
  IF s.enable_overdue THEN
    RETURN QUERY
    SELECT
      'overdue_orders_'||to_char(now(),'YYYYMMDDHH24'),
      'operations'::text,
      'high'::text,
      'طلبات متأخرة: '||c::text,
      jsonb_build_object('overdue', c)
    FROM (
      SELECT count(*)::int AS c FROM public.orders
      WHERE status IN ('pending','processing') AND created_at < now() - interval '24 hours'
    ) q
    WHERE c >= s.overdue_orders_threshold;
  END IF;

  -- Growth (CEO agent latest)
  IF s.enable_growth THEN
    RETURN QUERY
    WITH latest AS (
      SELECT details FROM public.agent_runs
      WHERE agent::text='ceo' AND created_at > now() - interval '24 hours'
      ORDER BY created_at DESC LIMIT 1
    )
    SELECT
      'growth_negative_'||to_char(now(),'YYYYMMDD'),
      'ceo'::text,
      CASE WHEN COALESCE((details->>'growth_pct')::numeric,0) <= -50 THEN 'critical' ELSE 'high' END,
      'نمو سلبي: '||COALESCE(details->>'growth_pct','?')||'%',
      details
    FROM latest
    WHERE COALESCE((details->>'growth_pct')::numeric, 0) <= s.growth_threshold_pct;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_alerts() TO authenticated, service_role;
