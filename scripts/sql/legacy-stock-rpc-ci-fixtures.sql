-- Disposable PostgreSQL fixture only; never run against user data.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE public.synthetic_members (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (user_id, organization_id, permission)
);

CREATE FUNCTION public.has_org_permission(uuid,uuid,text) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.synthetic_members
    WHERE user_id = $1 AND organization_id = $2 AND permission = $3
  );
$$;

CREATE TABLE public.wh_warehouses (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL
);

CREATE TABLE public.inv_stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.wh_warehouses(id),
  product_id uuid NOT NULL,
  qty_on_hand numeric NOT NULL DEFAULT 0,
  qty_reserved numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inv_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  batch_id uuid,
  product_id uuid NOT NULL,
  movement_type text NOT NULL,
  qty_delta numeric NOT NULL,
  actor_user_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.synthetic_events (
  event_name text NOT NULL,
  organization_id uuid NOT NULL,
  movement_id uuid NOT NULL
);

CREATE FUNCTION public.inv_emit_event(text,uuid,text,uuid,jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.synthetic_events(event_name,organization_id,movement_id)
  VALUES ($1,$2,$4);
END;
$$;

INSERT INTO public.synthetic_members (user_id,organization_id,permission) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','inventory.write');

INSERT INTO public.wh_warehouses (id,organization_id) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

INSERT INTO public.inv_stock_batches (
  id,organization_id,warehouse_id,product_id,qty_on_hand,qty_reserved
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  10,8
);
