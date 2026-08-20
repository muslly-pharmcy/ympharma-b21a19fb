
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.product_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_gallery_images_product_idx ON public.product_gallery_images(product_id, sort_order);

GRANT SELECT ON public.product_gallery_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_gallery_images TO authenticated;
GRANT ALL ON public.product_gallery_images TO service_role;

ALTER TABLE public.product_gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read gallery" ON public.product_gallery_images
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admins manage gallery" ON public.product_gallery_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER product_gallery_images_updated_at
  BEFORE UPDATE ON public.product_gallery_images
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
