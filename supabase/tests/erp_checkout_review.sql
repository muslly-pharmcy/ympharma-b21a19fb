-- Full-store-schema review checkout acceptance; fixtures and mode change roll back.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES
('95111111-1111-4111-8111-111111111111','checkout95a@example.invalid','{}','{}'),
('95222222-2222-4222-8222-222222222222','checkout95b@example.invalid','{}','{}');
INSERT INTO public.catalog_products(id,name_ar,status,is_public,requires_prescription)
VALUES('95333333-3333-4333-8333-333333333333','Synthetic review product','approved',true,false);
INSERT INTO public.erp_v2_control VALUES(true,'ERP95_CHECKOUT','EPOCH95_CHECKOUT');
INSERT INTO public.erp_item_map(erp_item_id,product_id,unit_code,units_per_pack,source_id,verified)
VALUES('CHECKOUT95','95333333-3333-4333-8333-333333333333','piece',1,'ERP95_CHECKOUT',true);
UPDATE erp_checkout_private.control SET mode='erp',source_id='ERP95_CHECKOUT';
SET LOCAL ROLE service_role;
SELECT public.erp_bridge_ingest_projection('ERP95_CHECKOUT','checkout-init95',repeat('a',64),
jsonb_build_object('sourceSystem','ERP95_CHECKOUT','sourceEpoch','EPOCH95_CHECKOUT','projection',jsonb_build_object('version','1','watermark','0','observed_at',clock_timestamp(),'coverage','[]'::jsonb,'rows','[{"product_id":"CHECKOUT95","unit_code":"piece","factor":"1","qty_available_base":"1","selling_price":"10.0000","currency":"YER"}]'::jsonb)));
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','95111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"95111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.cart_items(user_id,product_id,quantity) VALUES(auth.uid(),'95333333-3333-4333-8333-333333333333',1);
RESET ROLE;
SAVEPOINT cart;
UPDATE public.catalog_products SET requires_prescription=true WHERE id='95333333-3333-4333-8333-333333333333';
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false;BEGIN
 BEGIN PERFORM public.erp_checkout_quote();EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PRODUCT_NOT_REVIEWABLE' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'prescription cart accepted';END IF;
 RAISE NOTICE 'PASS prescription item excluded from automatic review quote';
END $$;
ROLLBACK TO cart;
UPDATE public.erp_item_map SET verified=false WHERE source_id='ERP95_CHECKOUT';
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false;BEGIN
 BEGIN PERFORM public.erp_checkout_quote();EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PRODUCT_MAPPING_REVIEW_REQUIRED' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'unverified mapping accepted';END IF;
 RAISE NOTICE 'PASS unverified mapping blocks review quote';
END $$;
ROLLBACK TO cart;
SET LOCAL ROLE authenticated;
DO $$ DECLARE q jsonb;r jsonb;s jsonb;denied boolean:=false;BEGIN
 q:=public.erp_checkout_quote();
 IF q->>'subtotal'<>'10.0000' OR q->>'payment_collected'<>'false' OR q#>>'{lines,0,unit_price}'<>'10.0000' THEN RAISE EXCEPTION 'wrong authoritative quote %',q;END IF;
 BEGIN PERFORM public.checkout_cart_fefo('x','x','x',NULL,'cash',NULL);EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ERP_MANAGED_CHECKOUT_REQUIRED' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'legacy checkout bypass';END IF;
 denied:=false;BEGIN PERFORM public.checkout_cart_fefo_legacy('x','x','x',NULL,'cash',NULL);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'direct legacy execution bypass';END IF;
 r:=public.erp_checkout_submit('95444444-4444-4444-8444-444444444444',q->>'hash');
 s:=public.erp_checkout_submit('95444444-4444-4444-8444-444444444444',q->>'hash');
 IF r->>'order_id' IS DISTINCT FROM s->>'order_id' OR r->>'state'<>'PENDING_REVIEW' OR r->>'payment_collected'<>'false' THEN RAISE EXCEPTION 'unstable review request';END IF;
 IF EXISTS(SELECT 1 FROM public.cart_items WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'cart not atomically cleared';END IF;
 denied:=false;BEGIN PERFORM public.erp_checkout_submit('95444444-4444-4444-8444-444444444444',repeat('0',64));EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CHECKOUT_REQUEST_CONFLICT' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'changed replay hash accepted';END IF;
 RAISE NOTICE 'PASS server quote, legacy bypass denial, atomic cart clear and request replay';
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.erp_bridge_events WHERE source_id='ERP95_CHECKOUT')<>1 OR (SELECT count(*) FROM erp_checkout_private.requests WHERE source_id='ERP95_CHECKOUT')<>1 THEN RAISE EXCEPTION 'duplicate review effect';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','95222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"sub":"95222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false;BEGIN
 BEGIN PERFORM public.erp_checkout_status('95444444-4444-4444-8444-444444444444');EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'REVIEW_ORDER_NOT_FOUND' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'cross-user status exposed';END IF;
 denied:=false;BEGIN PERFORM public.erp_checkout_cancel('95444444-4444-4444-8444-444444444444');EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'REVIEW_ORDER_NOT_FOUND' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'cross-user cancel accepted';END IF;
 RAISE NOTICE 'PASS populated other-user status and cancellation denied';
END $$;
RESET ROLE;
DO $$ DECLARE denied boolean:=false;BEGIN
 BEGIN UPDATE erp_checkout_private.control SET mode='legacy';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ERP_ORDERS_REQUIRE_RECONCILIATION' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'unreconciled fallback permitted';END IF;
END $$;
UPDATE erp_checkout_private.control SET mode='paused';
SELECT set_config('request.jwt.claim.sub','95111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"95111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false;r jsonb;BEGIN
 BEGIN PERFORM public.erp_checkout_quote();EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ERP_CHECKOUT_DISABLED' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'paused quote accepted';END IF;
 r:=public.erp_checkout_cancel('95444444-4444-4444-8444-444444444444');
 r:=public.erp_checkout_cancel('95444444-4444-4444-8444-444444444444');
 IF r->>'version'<>'2' OR r->>'state'<>'CANCEL_PENDING' THEN RAISE EXCEPTION 'paused cancellation incorrect';END IF;
 RAISE NOTICE 'PASS mode transition guard, paused quote denial and idempotent cancellation';
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.erp_bridge_events WHERE source_id='ERP95_CHECKOUT')<>2 THEN RAISE EXCEPTION 'duplicate cancellation effect';END IF;
END $$;
ROLLBACK;
