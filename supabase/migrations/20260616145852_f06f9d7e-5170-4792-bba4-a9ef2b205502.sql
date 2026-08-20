
DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
END
$$;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, required_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = $1 AND ur.role = $2
  )
$$;

CREATE TABLE public.orders (
  id text PRIMARY KEY,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  notes text,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can create order" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.prescriptions (
  id text PRIMARY KEY,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  notes text,
  image_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.prescriptions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone create prescription" ON public.prescriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update prescriptions" ON public.prescriptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_order_public(_id text)
RETURNS TABLE(id text, status text, total numeric, created_at timestamptz, customer_name text, items jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, total, created_at, customer_name, items FROM public.orders WHERE id = _id
$$;
GRANT EXECUTE ON FUNCTION public.get_order_public(text) TO anon, authenticated;
