
-- Products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_id integer UNIQUE,
  name text NOT NULL,
  brand text,
  price numeric NOT NULL DEFAULT 0,
  old_price numeric,
  category text NOT NULL,
  image_url text,
  badge text,
  description text,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read" ON public.products
  FOR SELECT TO anon, authenticated USING (is_published = true OR public.has_permission(auth.uid(), 'products'));

CREATE POLICY "products_admin_insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'products'));

CREATE POLICY "products_admin_update" ON public.products
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'products') OR public.has_permission(auth.uid(), 'pricing'))
  WITH CHECK (public.has_permission(auth.uid(), 'products') OR public.has_permission(auth.uid(), 'pricing'));

CREATE POLICY "products_admin_delete" ON public.products
  FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'products'));

CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_published ON public.products(is_published);

-- Offers table
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  discount_percent numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_public_read" ON public.offers
  FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_permission(auth.uid(), 'pricing'));

CREATE POLICY "offers_admin_all" ON public.offers
  FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'pricing'))
  WITH CHECK (public.has_permission(auth.uid(), 'pricing'));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER offers_touch BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Activity logging
CREATE TRIGGER products_activity AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();
CREATE TRIGGER offers_activity AFTER INSERT OR UPDATE OR DELETE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();
