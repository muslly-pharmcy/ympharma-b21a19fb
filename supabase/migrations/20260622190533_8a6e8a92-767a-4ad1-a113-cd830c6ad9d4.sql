
CREATE TABLE IF NOT EXISTS public.stock_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_subscriptions TO authenticated;
GRANT ALL ON public.stock_subscriptions TO service_role;
ALTER TABLE public.stock_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stock_subscriptions"
ON public.stock_subscriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX IF NOT EXISTS idx_stock_subs_product_active
  ON public.stock_subscriptions(product_id) WHERE active;

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('reactivation','loyalty_reminder','restock','promotion')),
  sent_to integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read marketing_campaigns"
ON public.marketing_campaigns FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins insert marketing_campaigns"
ON public.marketing_campaigns FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));
