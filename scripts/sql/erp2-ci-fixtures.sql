-- ONLY for disposable GitHub Actions PostgreSQL 16. Never run against Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY,
  status text NOT NULL
);
CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  status text NOT NULL,
  is_public boolean NOT NULL
);
CREATE TABLE public.wh_warehouses (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  is_active boolean NOT NULL
);
GRANT SELECT ON public.organizations, public.catalog_products, public.wh_warehouses TO service_role;
INSERT INTO public.organizations(id,status) VALUES
 ('11111111-1111-4111-8111-111111111111','active'),
 ('22222222-2222-4222-8222-222222222222','active'),
 ('33333333-3333-4333-8333-333333333333','suspended');
INSERT INTO public.catalog_products(id,organization_id,status,is_public) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','approved',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','approved',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','draft',false);
INSERT INTO public.wh_warehouses(id,organization_id,is_active) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',true),
 ('bbbbbbbb-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',true);
