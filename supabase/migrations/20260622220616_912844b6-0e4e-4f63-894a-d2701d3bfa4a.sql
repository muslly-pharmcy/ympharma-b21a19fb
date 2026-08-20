
CREATE TABLE IF NOT EXISTS public.prescription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  extracted_text TEXT,
  extracted_medicines JSONB,
  missing_medicines TEXT[],
  is_valid BOOLEAN DEFAULT TRUE,
  pharmacist_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','approved','rejected','ready_for_pickup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_orders TO authenticated;
GRANT ALL ON public.prescription_orders TO service_role;
ALTER TABLE public.prescription_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own prescription_orders" ON public.prescription_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "Users insert own prescription_orders" ON public.prescription_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update prescription_orders" ON public.prescription_orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "Admins delete prescription_orders" ON public.prescription_orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_prescription_orders_user ON public.prescription_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_prescription_orders_status ON public.prescription_orders(status);

CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('low_stock','overstock','expiry_risk','out_of_stock')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_alerts TO authenticated;
GRANT ALL ON public.inventory_alerts TO service_role;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inventory_alerts" ON public.inventory_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_branch ON public.inventory_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_resolved ON public.inventory_alerts(resolved);

CREATE TABLE IF NOT EXISTS public.customer_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','facebook','instagram','tiktok','telegram','x','email')),
  handle TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_channels TO authenticated;
GRANT ALL ON public.customer_channels TO service_role;
ALTER TABLE public.customer_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own channels" ON public.customer_channels
  FOR ALL TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_channels_customer ON public.customer_channels(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_channels_channel ON public.customer_channels(channel);

CREATE TABLE IF NOT EXISTS public.health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('healthy','degraded','unhealthy')),
  duration INTEGER,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_checks TO authenticated;
GRANT ALL ON public.health_checks TO service_role;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view health_checks" ON public.health_checks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON public.health_checks(created_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON public.health_checks(status);

CREATE TABLE IF NOT EXISTS public.inventory_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed','cancelled')),
  total_products INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  republished INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  errors TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT ON public.inventory_sync_logs TO authenticated;
GRANT ALL ON public.inventory_sync_logs TO service_role;
ALTER TABLE public.inventory_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view inventory_sync_logs" ON public.inventory_sync_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role) OR auth.uid() = actor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_actor ON public.inventory_sync_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_status ON public.inventory_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_started ON public.inventory_sync_logs(started_at);

ALTER TABLE public.agent_approval_requests
  ADD COLUMN IF NOT EXISTS extracted_medicines JSONB,
  ADD COLUMN IF NOT EXISTS missing_medicines TEXT[],
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pharmacist_notes TEXT;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_prescription_orders_updated_at ON public.prescription_orders;
CREATE TRIGGER trg_prescription_orders_updated_at BEFORE UPDATE ON public.prescription_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_channels_updated_at ON public.customer_channels;
CREATE TRIGGER trg_customer_channels_updated_at BEFORE UPDATE ON public.customer_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
