DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.checkout_cart_fefo(text,text,text,uuid,text,text)'::regprocedure);
  d := replace(d, 'cp.requires_prescription, cp.status, cp.is_public', 'cp.requires_prescription, cp.status, cp.is_public, cp.sbdma_official_price');
  d := replace(d, 'COALESCE(v_batch.selling_price, 0)', 'COALESCE(NULLIF(v_batch.selling_price, 0), v_cart.sbdma_official_price, 0)');
  d := replace(d, '''unit_price'', v_batch.selling_price', '''unit_price'', COALESCE(NULLIF(v_batch.selling_price, 0), v_cart.sbdma_official_price)');
  IF position('v_cart.sbdma_official_price' in d) = 0 THEN RAISE EXCEPTION 'patch failed'; END IF;
  EXECUTE d;
END
$mig$;