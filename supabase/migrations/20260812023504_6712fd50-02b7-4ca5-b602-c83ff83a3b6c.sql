-- === Prescription uploads ===
CREATE TABLE public.store_prescription_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  notes text,
  file_path text,
  file_name text,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.store_prescription_uploads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.store_prescription_uploads TO authenticated;
GRANT ALL ON public.store_prescription_uploads TO service_role;
ALTER TABLE public.store_prescription_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rx_uploads_public_insert" ON public.store_prescription_uploads
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rx_uploads_admin_select" ON public.store_prescription_uploads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "rx_uploads_admin_update" ON public.store_prescription_uploads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- === Chronic refill subscriptions ===
CREATE TABLE public.store_refill_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  product_id uuid,
  product_name text,
  condition_tag text,
  interval_days integer NOT NULL DEFAULT 30,
  next_reminder_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.store_refill_subscriptions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.store_refill_subscriptions TO authenticated;
GRANT ALL ON public.store_refill_subscriptions TO service_role;
ALTER TABLE public.store_refill_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refills_public_insert" ON public.store_refill_subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "refills_admin_select" ON public.store_refill_subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "refills_admin_update" ON public.store_refill_subscriptions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- === Health bundles ===
CREATE TABLE public.store_health_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  description_ar text,
  bundle_price numeric(12,2),
  discount_label text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_health_bundles TO anon, authenticated;
GRANT ALL ON public.store_health_bundles TO service_role;
ALTER TABLE public.store_health_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles_public_select" ON public.store_health_bundles
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "bundles_admin_all" ON public.store_health_bundles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.store_health_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.store_health_bundles(id) ON DELETE CASCADE,
  product_id uuid,
  label_ar text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_health_bundle_items TO anon, authenticated;
GRANT ALL ON public.store_health_bundle_items TO service_role;
ALTER TABLE public.store_health_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_items_public_select" ON public.store_health_bundle_items
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bundle_items_admin_all" ON public.store_health_bundle_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- === Bundle orders ===
CREATE TABLE public.store_bundle_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid REFERENCES public.store_health_bundles(id) ON DELETE SET NULL,
  bundle_title text,
  full_name text NOT NULL,
  phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.store_bundle_orders TO anon, authenticated;
GRANT SELECT, UPDATE ON public.store_bundle_orders TO authenticated;
GRANT ALL ON public.store_bundle_orders TO service_role;
ALTER TABLE public.store_bundle_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_orders_public_insert" ON public.store_bundle_orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bundle_orders_admin_select" ON public.store_bundle_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "bundle_orders_admin_update" ON public.store_bundle_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- === Storefront AI / tools usage telemetry ===
CREATE TABLE public.ai_widget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  session_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.ai_widget_events TO anon, authenticated;
GRANT SELECT ON public.ai_widget_events TO authenticated;
GRANT ALL ON public.ai_widget_events TO service_role;
ALTER TABLE public.ai_widget_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "widget_events_public_insert" ON public.ai_widget_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "widget_events_admin_select" ON public.ai_widget_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE INDEX idx_ai_widget_events_created ON public.ai_widget_events (created_at DESC);

-- === updated_at triggers ===
CREATE TRIGGER trg_rx_uploads_updated BEFORE UPDATE ON public.store_prescription_uploads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_refills_updated BEFORE UPDATE ON public.store_refill_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bundles_updated BEFORE UPDATE ON public.store_health_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bundle_items_updated BEFORE UPDATE ON public.store_health_bundle_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bundle_orders_updated BEFORE UPDATE ON public.store_bundle_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === Seed bundles ===
INSERT INTO public.store_health_bundles (slug, title_ar, description_ar, bundle_price, discount_label, sort_order)
VALUES
  ('daily-skincare', 'باقة العناية اليومية بالبشرة', 'غسول لطيف + مرطب + واقٍ شمسي SPF50 لروتين يومي متكامل.', 18500, 'خصم 15%', 1),
  ('immunity-pack', 'باقة المناعة الموسمية', 'فيتامين C + زنك + فيتامين D3 لدعم المناعة خلال تغيّر الفصول.', 14900, 'خصم 12%', 2),
  ('chronic-care', 'باقة العناية بالأمراض المزمنة', 'جهاز قياس ضغط + شرائط سكر + منظّم جرعات أسبوعي.', 42000, 'خصم 10%', 3);

INSERT INTO public.store_health_bundle_items (bundle_id, label_ar, quantity)
SELECT b.id, x.label, 1 FROM public.store_health_bundles b
JOIN (VALUES
  ('daily-skincare', 'غسول وجه لطيف'),
  ('daily-skincare', 'مرطب يومي'),
  ('daily-skincare', 'واقٍ شمسي SPF50'),
  ('immunity-pack', 'فيتامين C 1000mg'),
  ('immunity-pack', 'زنك 50mg'),
  ('immunity-pack', 'فيتامين D3 5000IU'),
  ('chronic-care', 'جهاز قياس ضغط رقمي'),
  ('chronic-care', 'شرائط قياس سكر'),
  ('chronic-care', 'منظّم جرعات أسبوعي')
) AS x(slug, label) ON x.slug = b.slug;