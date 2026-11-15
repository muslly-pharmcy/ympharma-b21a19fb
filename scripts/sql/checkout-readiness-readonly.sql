-- Metadata only. Run on the intended staging/production database before deployment.
-- No customer/cart data is returned; no grants or function definitions are modified.
WITH definition AS (
  SELECT to_regprocedure('public.checkout_cart_fefo(text,text,text,uuid,text,text)') AS oid
), checks AS (
  SELECT oid,
    coalesce(has_function_privilege('anon',oid,'EXECUTE'), false) AS anon_execute,
    coalesce(has_function_privilege('authenticated',oid,'EXECUTE'), false) AS customer_execute,
    coalesce(pg_get_functiondef(oid),'') AS body
  FROM definition
)
SELECT oid IS NOT NULL AS function_exists,
  NOT anon_execute AS anonymous_denied,
  customer_execute AS authenticated_can_execute,
  position('auth.uid()' in body)>0 AS uses_caller_identity,
  position('ci.user_id = v_user_id' in body)>0 AS cart_owner_filter_present,
  position('FOR UPDATE' in body)>0 AS stock_lock_present,
  position('v_cart.sbdma_official_price' in body)>0 AS catalog_price_patch_present,
  -- These text checks are deployment drift indicators, not proof of runtime safety.
  'Requires staging customer checkout, foreign-cart rejection and concurrent-sale tests' AS runtime_gate
FROM checks;
