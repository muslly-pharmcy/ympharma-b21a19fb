
-- ============ BUNDLES ============
CREATE TABLE public.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  kind text NOT NULL DEFAULT 'general',
  discount_percent numeric NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 90),
  fixed_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  sales_count int NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundles TO authenticated;
GRANT ALL ON public.bundles TO service_role;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles public read active" ON public.bundles FOR SELECT USING (is_active = true);
CREATE POLICY "bundles admin all" ON public.bundles FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));

CREATE TABLE public.bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  product_legacy_id int NOT NULL,
  qty int NOT NULL DEFAULT 1 CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bundle_items_bundle_idx ON public.bundle_items(bundle_id);
GRANT SELECT ON public.bundle_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_items TO authenticated;
GRANT ALL ON public.bundle_items TO service_role;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_items public read" ON public.bundle_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bundles b WHERE b.id = bundle_id AND b.is_active));
CREATE POLICY "bundle_items admin all" ON public.bundle_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));

CREATE TRIGGER trg_bundles_touch BEFORE UPDATE ON public.bundles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MARKETING BANNERS ============
CREATE TABLE public.marketing_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  cta_label text,
  cta_href text,
  theme text NOT NULL DEFAULT 'gradient-emerald',
  image_url text,
  placement text NOT NULL DEFAULT 'home',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketing_banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_banners TO authenticated;
GRANT ALL ON public.marketing_banners TO service_role;
ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners public read" ON public.marketing_banners FOR SELECT
  USING (is_active AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "banners admin all" ON public.marketing_banners FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));
CREATE TRIGGER trg_banners_touch BEFORE UPDATE ON public.marketing_banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CAMPAIGNS ============
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  condition_tag text,
  discount_code text,
  banner_id uuid REFERENCES public.marketing_banners(id) ON DELETE SET NULL,
  eligible_count int NOT NULL DEFAULT 0,
  redemptions_count int NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns public read" ON public.campaigns FOR SELECT USING (is_active);
CREATE POLICY "campaigns admin all" ON public.campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders'));
CREATE TRIGGER trg_campaigns_touch BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.list_bundles_public()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(b ORDER BY (b->>'sort_order')::int, b->>'name'), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', b.id, 'slug', b.slug, 'name', b.name, 'description', b.description,
      'image_url', b.image_url, 'kind', b.kind, 'discount_percent', b.discount_percent,
      'fixed_price', b.fixed_price, 'sort_order', b.sort_order,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'legacy_id', bi.product_legacy_id, 'qty', bi.qty,
          'name', p.name, 'price', p.price, 'image_url', p.image_url
        ))
        FROM public.bundle_items bi
        LEFT JOIN public.products p ON p.legacy_id = bi.product_legacy_id
        WHERE bi.bundle_id = b.id
      ), '[]'::jsonb),
      'subtotal', COALESCE((
        SELECT SUM(bi.qty * COALESCE(p.price,0))
        FROM public.bundle_items bi
        LEFT JOIN public.products p ON p.legacy_id = bi.product_legacy_id
        WHERE bi.bundle_id = b.id
      ), 0)
    ) AS b
    FROM public.bundles b WHERE b.is_active
  ) t;
  RETURN COALESCE(v, '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.track_banner_event(_banner_id uuid, _event text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _event = 'impression' THEN
    UPDATE public.marketing_banners SET impressions = impressions + 1 WHERE id = _banner_id;
  ELSIF _event = 'click' THEN
    UPDATE public.marketing_banners SET clicks = clicks + 1 WHERE id = _banner_id;
  ELSE RETURN false;
  END IF;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.track_banner_event(uuid,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_bundles_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'revenue')::numeric DESC NULLS LAST), '[]') INTO v FROM (
    SELECT jsonb_build_object(
      'id', b.id, 'slug', b.slug, 'name', b.name, 'kind', b.kind,
      'is_active', b.is_active, 'discount_percent', b.discount_percent,
      'sales_count', b.sales_count, 'revenue', b.revenue,
      'items_count', (SELECT count(*) FROM public.bundle_items bi WHERE bi.bundle_id = b.id)
    ) AS t
    FROM public.bundles b
  ) s;
  RETURN COALESCE(v, '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.campaign_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'condition_tag', c.condition_tag,
    'discount_code', c.discount_code, 'eligible_count', c.eligible_count,
    'redemptions_count', c.redemptions_count, 'revenue', c.revenue, 'is_active', c.is_active
  )), '[]') INTO v FROM public.campaigns c;
  RETURN COALESCE(v, '[]'::jsonb);
END; $$;

-- Daily/weekly revenue series for dashboard charts
CREATE OR REPLACE FUNCTION public.admin_revenue_series(_days int DEFAULT 14)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rev jsonb; v_orders jsonb; v_rx jsonb; v_top jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'orders') OR has_permission(auth.uid(),'prescriptions')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH d AS (
    SELECT generate_series((now() AT TIME ZONE 'Asia/Aden')::date - (_days-1), (now() AT TIME ZONE 'Asia/Aden')::date, '1 day')::date AS day
  ), o AS (
    SELECT (created_at AT TIME ZONE 'Asia/Aden')::date AS day, COUNT(*) AS n, COALESCE(SUM(total) FILTER (WHERE status<>'cancelled'),0) AS revenue
    FROM public.orders WHERE created_at >= now() - make_interval(days => _days) GROUP BY 1
  ), r AS (
    SELECT (created_at AT TIME ZONE 'Asia/Aden')::date AS day, COUNT(*) AS n
    FROM public.prescriptions WHERE created_at >= now() - make_interval(days => _days) GROUP BY 1
  )
  SELECT
    jsonb_agg(jsonb_build_object('day', d.day, 'revenue', COALESCE(o.revenue,0)) ORDER BY d.day),
    jsonb_agg(jsonb_build_object('day', d.day, 'orders', COALESCE(o.n,0)) ORDER BY d.day),
    jsonb_agg(jsonb_build_object('day', d.day, 'rx', COALESCE(r.n,0)) ORDER BY d.day)
  INTO v_rev, v_orders, v_rx
  FROM d LEFT JOIN o ON o.day = d.day LEFT JOIN r ON r.day = d.day;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'qty')::int DESC), '[]') INTO v_top FROM (
    SELECT jsonb_build_object('name', it->>'name', 'qty', SUM((it->>'qty')::int), 'revenue', SUM(((it->>'qty')::int * (it->>'price')::numeric))) AS t
    FROM public.orders, jsonb_array_elements(items) it
    WHERE created_at >= now() - make_interval(days => _days) AND status <> 'cancelled'
    GROUP BY it->>'name' ORDER BY SUM((it->>'qty')::int) DESC LIMIT 8
  ) s;

  RETURN jsonb_build_object('revenue', v_rev, 'orders', v_orders, 'rx', v_rx, 'top_products', v_top);
END; $$;

-- Seed default bundles
INSERT INTO public.bundles (slug, name, kind, discount_percent, description, sort_order, is_active) VALUES
('cold-flu', 'باقة البرد والإنفلونزا', 'cold_flu', 12, 'كل ما تحتاجه لعلاج نزلات البرد والإنفلونزا في باقة واحدة موفرة.', 10, true),
('diabetes', 'باقة مرضى السكري', 'diabetes', 10, 'متابعة منتظمة لمستوى السكر مع أدوية أساسية.', 20, true),
('blood-pressure', 'باقة ضغط الدم', 'blood_pressure', 10, 'أدوية ومتابعة ضغط الدم في باقة شهرية.', 30, true),
('baby-care', 'باقة العناية بالطفل', 'baby_care', 8, 'مستلزمات أساسية للأم والطفل.', 40, true),
('vitamins', 'باقة الفيتامينات', 'vitamins', 15, 'مجموعة فيتامينات يومية للصحة العامة.', 50, true),
('women-care', 'باقة العناية بالمرأة', 'women_care', 10, 'منتجات أساسية للعناية بصحة المرأة.', 60, true),
('heart-health', 'باقة صحة القلب', 'heart', 10, 'مكملات وأدوية داعمة لصحة القلب.', 70, true),
('first-aid', 'باقة الإسعافات الأولية', 'first_aid', 12, 'كل أدوات الإسعافات الأولية للمنزل والسفر.', 80, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed default banner
INSERT INTO public.marketing_banners (title, subtitle, cta_label, cta_href, theme, placement, sort_order, is_active)
VALUES ('🔥 خصم 10% على أدوية الأمراض المزمنة',
        'احصل على خصم 10% على أدوية السكري والضغط والقلب والغدة الدرقية.',
        'اطلب الآن', '/products?tag=chronic', 'gradient-emerald', 'home', 10, true)
ON CONFLICT DO NOTHING;

-- Seed default chronic campaigns
INSERT INTO public.campaigns (slug, name, condition_tag, discount_code, is_active) VALUES
('chronic-diabetes', 'حملة مرضى السكري', 'diabetes', 'CHRONIC10', true),
('chronic-bp', 'حملة ضغط الدم', 'blood_pressure', 'CHRONIC10', true),
('chronic-heart', 'حملة صحة القلب', 'heart', 'CHRONIC10', true),
('chronic-thyroid', 'حملة الغدة الدرقية', 'thyroid', 'CHRONIC10', true)
ON CONFLICT (slug) DO NOTHING;

-- Seed the CHRONIC10 discount code if missing
INSERT INTO public.discount_codes (code, kind, value, min_total, max_uses, first_order_only, active)
VALUES ('CHRONIC10', 'percent', 10, 0, NULL, false, true)
ON CONFLICT (code) DO NOTHING;
