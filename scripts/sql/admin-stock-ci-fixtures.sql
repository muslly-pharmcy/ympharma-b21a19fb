-- DISPOSABLE PostgreSQL ONLY. Never execute on Supabase or an existing database.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.organizations(id uuid PRIMARY KEY);
CREATE TABLE public.organization_members(user_id uuid, organization_id uuid, status text, role text, branch_scope uuid[]);
CREATE TABLE public.catalog_products(id uuid PRIMARY KEY, organization_id uuid REFERENCES public.organizations(id));
CREATE TABLE public.wh_warehouses(id uuid PRIMARY KEY, organization_id uuid REFERENCES public.organizations(id), is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.inv_stock_batches(
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, warehouse_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.catalog_products(id), batch_no text, expiry_date date,
 qty_on_hand numeric(14,3) NOT NULL CHECK(qty_on_hand>=0),
 qty_reserved numeric(14,3) NOT NULL CHECK(qty_reserved>=0), updated_at timestamptz
);
CREATE TABLE public.inv_stock_movements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, warehouse_id uuid,
 batch_id uuid, product_id uuid, movement_type text, qty_delta numeric(14,3),
 actor_user_id uuid, reason text, metadata jsonb
);
CREATE TABLE public.test_events(payload jsonb);
CREATE FUNCTION public.has_org_permission(p_user uuid,p_org uuid,p_permission text)
RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS (
 SELECT 1 FROM public.organization_members WHERE user_id=p_user AND organization_id=p_org
 AND status='active' AND role='manager' AND p_permission='inventory.write'
) $$;
CREATE FUNCTION public.inv_emit(p_event text,p_payload jsonb,p_correlation text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF p_payload->>'batch_id'=current_setting('test.fail_batch',true) THEN RAISE EXCEPTION 'SYNTHETIC_EVENT_FAILURE'; END IF;
 INSERT INTO public.test_events VALUES(p_payload);
END $$;
INSERT INTO public.organizations VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO public.organization_members VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','active','manager','{}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','active','manager','{}');
INSERT INTO public.catalog_products VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222');
INSERT INTO public.wh_warehouses(id,organization_id) VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111');
INSERT INTO public.inv_stock_batches VALUES
 ('00000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','LOT-1','2099-01-01',10,8,now()),
 ('00000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','LOT-2','2099-02-01',5,0,now());
