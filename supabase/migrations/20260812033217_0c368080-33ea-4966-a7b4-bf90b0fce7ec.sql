CREATE TABLE public.family_health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  relation text NOT NULL DEFAULT 'self',
  birth_date date,
  weight_kg numeric,
  blood_type text,
  allergies text[] NOT NULL DEFAULT '{}',
  chronic_conditions text[] NOT NULL DEFAULT '{}',
  current_medicines text[] NOT NULL DEFAULT '{}',
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fhp_user ON public.family_health_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_health_profiles TO authenticated;
GRANT ALL ON public.family_health_profiles TO service_role;

ALTER TABLE public.family_health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY fhp_owner_all ON public.family_health_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_fhp_updated_at
  BEFORE UPDATE ON public.family_health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_watch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone text NOT NULL,
  full_name text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_swr_product ON public.stock_watch_requests(product_id);

GRANT SELECT, INSERT ON public.stock_watch_requests TO authenticated;
GRANT ALL ON public.stock_watch_requests TO service_role;

ALTER TABLE public.stock_watch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY swr_owner_select ON public.stock_watch_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY swr_owner_insert ON public.stock_watch_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_swr_updated_at
  BEFORE UPDATE ON public.stock_watch_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();