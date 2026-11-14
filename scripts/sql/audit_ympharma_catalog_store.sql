-- Read-only diagnostic for Phase 3. Never changes products, prices or stock.
-- Run using a read-only privileged connection in the correct environment.
SELECT
  (SELECT count(*) FROM public.catalog_products) AS catalog_products,
  (SELECT count(*) FROM public.catalog_import_rows) AS catalog_import_rows,
  (SELECT count(*) FROM public.catalog_import_jobs) AS catalog_import_jobs,
  (SELECT count(*) FROM public.inv_stock_batches) AS stock_batches,
  (SELECT count(*) FROM ym.products) AS erp_products,
  (SELECT count(*) FROM ym.store_product_links) AS erp_store_links,
  (SELECT count(*) FROM public.orders) AS store_orders,
  (SELECT count(*) FROM ym.invoices) AS erp_invoices;

SELECT
  count(*) AS products,
  count(*) FILTER (WHERE nullif(btrim(name_ar), '') IS NULL) AS missing_arabic_names,
  count(*) FILTER (WHERE nullif(btrim(barcode), '') IS NULL) AS missing_barcodes,
  count(*) FILTER (WHERE nullif(btrim(generic_name), '') IS NULL) AS missing_generic_names,
  count(*) FILTER (WHERE nullif(btrim(pack_unit), '') IS NULL) AS missing_pack_units,
  count(*) FILTER (WHERE requires_prescription IS NULL) AS missing_prescription_flags,
  count(*) FILTER (WHERE status::text = 'approved' AND is_public) AS publicly_approved
FROM public.catalog_products;

SELECT
  count(*) AS stock_batches,
  count(distinct product_id) AS products_with_stock_batches,
  count(*) FILTER (WHERE selling_price IS NULL) AS batches_without_selling_price,
  count(*) FILTER (WHERE qty_on_hand < 0 OR qty_reserved < 0 OR qty_reserved > qty_on_hand) AS invalid_quantities,
  count(*) FILTER (WHERE expiry_date < current_date) AS expired_batches,
  count(*) FILTER (WHERE c.id IS NULL) AS batches_missing_catalog_product
FROM public.inv_stock_batches b
LEFT JOIN public.catalog_products c ON c.id = b.product_id;

SELECT p.oid::regprocedure::text AS routine,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('acc_next_no', 'acc_post_entry', 'inv_consume_fefo',
                   'inv_movements_apply', 'sal_approve_invoice')
ORDER BY 1;
