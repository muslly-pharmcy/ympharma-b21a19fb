-- Native catalog transaction/receiver checks. Synthetic fixtures; full schema; rollback.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES
('96111111-1111-4111-8111-111111111111','catalog95a@example.invalid','{}','{}'),
('96222222-2222-4222-8222-222222222222','catalog95b@example.invalid','{}','{}'),
('96333333-3333-4333-8333-333333333333','catalog95other@example.invalid','{}','{}');
INSERT INTO public.organizations(id,name,type) VALUES
('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTHETIC CATALOG95','PHARMACY'),
('96bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SYNTHETIC OTHER95','PHARMACY');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96111111-1111-4111-8111-111111111111','owner'),
('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96222222-2222-4222-8222-222222222222','owner'),
('96bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','96333333-3333-4333-8333-333333333333','owner');
INSERT INTO public.catalog_products(id,organization_id,name_ar,description_ar,status,is_public,requires_prescription)
VALUES('96444444-4444-4444-8444-444444444444','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Before','Before description','approved',true,false);
INSERT INTO public.erp_item_map(erp_item_id,product_id,unit_code,units_per_pack,source_id,verified)
VALUES('CATALOG95','96444444-4444-4444-8444-444444444444','piece',1,'ERP95_CATALOG',true);
INSERT INTO catalog_command_private.bridge_actors VALUES
('ERP95_CATALOG','96111111-1111-4111-8111-111111111111','96111111-1111-4111-8111-111111111111','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
('ERP95_CATALOG','96222222-2222-4222-8222-222222222222','96222222-2222-4222-8222-222222222222','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
('ERP95_CATALOG','96333333-3333-4333-8333-333333333333','96333333-3333-4333-8333-333333333333','96bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SET LOCAL ROLE service_role;
SAVEPOINT base;
DO $$ DECLARE r jsonb;denied boolean:=false;BEGIN
 r:=public.catalog_update_product_atomic('96111111-1111-4111-8111-111111111111','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96444444-4444-4444-8444-444444444444','native-key95','{"name_ar":"After"}',0,'native-catalog95');
 IF r->>'revision'<>'1' THEN RAISE EXCEPTION 'wrong revision';END IF;
 IF public.catalog_update_product_atomic('96111111-1111-4111-8111-111111111111','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96444444-4444-4444-8444-444444444444','native-key95','{"name_ar":"After"}',0,'native-catalog95')<>r THEN RAISE EXCEPTION 'replay unstable';END IF;
 BEGIN PERFORM public.catalog_update_product_atomic('96111111-1111-4111-8111-111111111111','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96444444-4444-4444-8444-444444444444','native-key95','{"name_ar":"Different"}',0,'native-catalog95');EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PRODUCT_IDEMPOTENCY_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'changed payload replay accepted';END IF;
 denied:=false;BEGIN PERFORM public.catalog_update_product_atomic('96111111-1111-4111-8111-111111111111','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96444444-4444-4444-8444-444444444444','stale-key95','{"name_ar":"Stale"}',0,'native-catalog95');EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PRODUCT_REVISION_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'stale edit overwritten';END IF;
 denied:=false;BEGIN PERFORM public.catalog_update_product_atomic('96333333-3333-4333-8333-333333333333','96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','96444444-4444-4444-8444-444444444444','other-key95','{"name_ar":"Other"}',1,'native-catalog95');EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CATALOG_WRITE_FORBIDDEN' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'other tenant actor accepted';END IF;
 IF (SELECT count(*) FROM public.audit_events WHERE correlation_id='native-catalog95' AND action='catalog.product.update')<>1 THEN RAISE EXCEPTION 'audit not exactly once';END IF;
 RAISE NOTICE 'PASS native product update, replay, revision conflict, tenant permission and exactly-one audit';
END $$;
ROLLBACK TO base;
DO $$ DECLARE payload text;envelope jsonb;r jsonb;denied boolean;bad jsonb;BEGIN
 payload:=jsonb_build_object('product','CATALOG95','expectedRevision','0','before',jsonb_build_object('name_ar','Before','description_ar','Before description'),'patch',jsonb_build_object('name_ar','Reviewed name'),'reason','Synthetic two-actor review')::text;
 envelope:=jsonb_build_object('sourceSystem','ERP95_CATALOG','command_id','96555555-5555-4555-8555-555555555555','editor','96111111-1111-4111-8111-111111111111','reviewer','96222222-2222-4222-8222-222222222222','payload',payload,'payload_hash',encode(sha256(convert_to(payload,'UTF8')),'hex'));
 FOREACH bad IN ARRAY ARRAY[
  envelope||'{"reviewer":"96111111-1111-4111-8111-111111111111"}',
  envelope||'{"reviewer":"96333333-3333-4333-8333-333333333333"}',
  envelope||jsonb_build_object('payload_hash',repeat('0',64))] LOOP
  denied:=false;BEGIN PERFORM public.erp_catalog_apply('ERP95_CATALOG',bad);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT IN('CATALOG_ENVELOPE_INVALID','CATALOG_BRIDGE_ACTOR_FORBIDDEN') THEN RAISE;END IF;denied:=true;END;
  IF NOT denied THEN RAISE EXCEPTION 'unapproved catalog envelope accepted';END IF;
 END LOOP;
 r:=public.erp_catalog_apply('ERP95_CATALOG',envelope);
 IF r->>'state'<>'APPLIED' OR r->>'revision'<>'1' THEN RAISE EXCEPTION 'reviewed edit not applied %',r;END IF;
 IF public.erp_catalog_apply('ERP95_CATALOG',envelope)<>r THEN RAISE EXCEPTION 'bridge receipt unstable';END IF;
 bad:=envelope||'{"command_id":"96666666-6666-4666-8666-666666666666"}';
 IF public.erp_catalog_apply('ERP95_CATALOG',bad)->>'state'<>'CONFLICT' THEN RAISE EXCEPTION 'stale bridge overwrote concurrent product';END IF;
 IF (SELECT count(*) FROM public.audit_events WHERE resource_id='96444444-4444-4444-8444-444444444444' AND action='catalog.product.bridge_approval')<>1 THEN RAISE EXCEPTION 'review approval audit not once';END IF;
 IF (SELECT name_ar FROM public.catalog_products WHERE id='96444444-4444-4444-8444-444444444444')<>'Reviewed name' THEN RAISE EXCEPTION 'product name mismatch';END IF;
 RAISE NOTICE 'PASS distinct authorized mapped actors, payload hash, immutable receipt and concurrent-edit conflict';
END $$;
ROLLBACK TO base;
DO $$ DECLARE payload text;envelope jsonb;denied boolean:=false;BEGIN
 payload:='{"product":"CATALOG95","expectedRevision":"0","before":{"name_ar":"Before","description_ar":"Before description"},"patch":{"requires_prescription":false},"reason":"Denied clinical write"}';
 envelope:=jsonb_build_object('sourceSystem','ERP95_CATALOG','command_id','96555555-5555-4555-8555-555555555555','editor','96111111-1111-4111-8111-111111111111','reviewer','96222222-2222-4222-8222-222222222222','payload',payload,'payload_hash',encode(sha256(convert_to(payload,'UTF8')),'hex'));
 BEGIN PERFORM public.erp_catalog_apply('ERP95_CATALOG',envelope);EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CATALOG_PAYLOAD_INVALID' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'clinical flag accepted';END IF;
 RAISE NOTICE 'PASS bridge refuses clinical-field edit';
END $$;
ROLLBACK;
