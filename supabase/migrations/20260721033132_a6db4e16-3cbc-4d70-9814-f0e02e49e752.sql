
-- 1. Shipping zones
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  regions text[] NOT NULL DEFAULT '{}',
  fee numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'YER',
  estimated_days text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shipping_zones TO anon, authenticated;
GRANT ALL ON public.shipping_zones TO service_role;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_zones public read" ON public.shipping_zones FOR SELECT USING (is_active = true);
CREATE POLICY "shipping_zones staff manage" ON public.shipping_zones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

-- 2. Payment methods
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  instructions_ar text,
  requires_receipt boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_methods public read" ON public.payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "payment_methods staff manage" ON public.payment_methods FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

-- 3. Orders: extend for storefront checkout
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_zone_id uuid REFERENCES public.shipping_zones(id),
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method_code text REFERENCES public.payment_methods(code),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_receipt_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);

-- Owner-side RLS on orders (staff policies already exist)
DROP POLICY IF EXISTS "orders owner read" ON public.orders;
CREATE POLICY "orders owner read" ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "orders owner insert" ON public.orders;
CREATE POLICY "orders owner insert" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "order_status_history owner read" ON public.order_status_history;
CREATE POLICY "order_status_history owner read" ON public.order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid()));

-- 4. updated_at trigger helper (reuse pattern)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS shipping_zones_touch ON public.shipping_zones;
CREATE TRIGGER shipping_zones_touch BEFORE UPDATE ON public.shipping_zones
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS payment_methods_touch ON public.payment_methods;
CREATE TRIGGER payment_methods_touch BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS orders_touch ON public.orders;
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 5. Seeds
INSERT INTO public.shipping_zones (code, name_ar, name_en, regions, fee, currency, estimated_days, sort_order) VALUES
  ('aden',    'عدن',                 'Aden',                ARRAY['عدن','Aden'],                              500,  'YER', 'خلال 24 ساعة',    1),
  ('sanaa',   'صنعاء',               'Sana''a',             ARRAY['صنعاء','Sanaa'],                          1500, 'YER', '1-2 يوم عمل',      2),
  ('other',   'باقي المحافظات',      'Other Governorates',  ARRAY['حضرموت','تعز','الحديدة','إب','لحج','أبين'], 2500, 'YER', '2-4 أيام عمل',     3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.payment_methods (code, name_ar, name_en, description_ar, instructions_ar, requires_receipt, sort_order) VALUES
  ('cod',      'الدفع عند الاستلام', 'Cash on Delivery', 'ادفع نقداً عند وصول الطلب إلى بابك.', 'جهّز المبلغ المطلوب للمندوب عند التسليم. ستصلك رسالة تأكيد قبل الوصول.', false, 1),
  ('bank',     'تحويل بنكي',        'Bank Transfer',    'حوّل المبلغ على حساب الصيدلية ثم ارفع صورة الإيصال.', 'اسم البنك: بنك الكريمي — رقم الحساب: 0000-0000-0000 — باسم صيدلية المصلي. بعد التحويل ارفع صورة الإيصال في الخطوة التالية.', true, 2),
  ('wallet',   'محفظة إلكترونية',   'Mobile Wallet',    'الدفع عبر جوالي / كاش أو محفظة أخرى.', 'حوّل المبلغ إلى الرقم 777000000 عبر جوالي أو كاش، ثم ارفع صورة إيصال العملية.', true, 3)
ON CONFLICT (code) DO NOTHING;
