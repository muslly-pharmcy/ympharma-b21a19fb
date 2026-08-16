CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT UNIQUE NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('web','ios','android')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own devices" ON public.user_devices;
CREATE POLICY "Users manage own devices" ON public.user_devices FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read approved reviews" ON public.reviews;
CREATE POLICY "Anyone can read approved reviews" ON public.reviews FOR SELECT
  USING (is_approved = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users insert own reviews" ON public.reviews;
CREATE POLICY "Users insert own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own reviews" ON public.reviews;
CREATE POLICY "Users update own reviews" ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own reviews" ON public.reviews;
CREATE POLICY "Users delete own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins moderate reviews" ON public.reviews;
CREATE POLICY "Admins moderate reviews" ON public.reviews FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.audit_logs_unified;
CREATE VIEW public.audit_logs_unified
WITH (security_invoker = true) AS
SELECT 'activity_logs'::text AS source, al.id::text AS source_id, al.created_at AS occurred_at, to_jsonb(al) AS details
FROM public.activity_logs al WHERE public.has_role(auth.uid(), 'admin')
UNION ALL
SELECT 'inventory_audit_log', ial.id::text, ial.created_at, to_jsonb(ial)
FROM public.inventory_audit_log ial WHERE public.has_role(auth.uid(), 'admin')
UNION ALL
SELECT 'supplier_link_audit', sla.id::text, sla.created_at, to_jsonb(sla)
FROM public.supplier_link_audit sla WHERE public.has_role(auth.uid(), 'admin')
UNION ALL
SELECT 'transfer_audit_log', tal.id::text, tal.created_at, to_jsonb(tal)
FROM public.transfer_audit_log tal WHERE public.has_role(auth.uid(), 'admin')
UNION ALL
SELECT 'error_logs', el.id::text, el.occurred_at, to_jsonb(el)
FROM public.error_logs el WHERE public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.audit_logs_unified TO authenticated;
