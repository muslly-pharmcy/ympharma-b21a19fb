-- OTC cart for Cosmic Search / storefront.
-- 1) Flag OTC vs prescription-only on catalog_products.
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false;

-- 2) Cart items table (per-user, one row per product).
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items_owner_select" ON public.cart_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cart_items_owner_insert" ON public.cart_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cart_items_owner_update" ON public.cart_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cart_items_owner_delete" ON public.cart_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) Reject Rx-only products at DB layer (defense-in-depth beyond server-fn validation).
CREATE OR REPLACE FUNCTION public.cart_items_block_rx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rx boolean;
BEGIN
  SELECT requires_prescription INTO rx FROM public.catalog_products WHERE id = NEW.product_id;
  IF rx IS TRUE THEN
    RAISE EXCEPTION 'هذا المنتج يتطلب وصفة طبية ولا يمكن إضافته للسلة مباشرة'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cart_items_block_rx ON public.cart_items;
CREATE TRIGGER trg_cart_items_block_rx
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.cart_items_block_rx();