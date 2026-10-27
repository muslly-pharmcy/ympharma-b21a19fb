-- Close direct Data API media approval and raw-metadata disclosure paths.
-- Additive restrictions preserve the existing upload/review permission policies.
-- Target: the owner's selected project ybhrmcdlgyccywpmiucz.
BEGIN;

-- Public presentation uses the server's approved-media DTO/signer, never raw rows.
REVOKE SELECT ON public.catalog_product_media FROM anon;
ALTER POLICY cat_media_read ON public.catalog_product_media
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.catalog_products p
      WHERE p.id = catalog_product_media.product_id
        AND public.is_org_member(p.organization_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY cat_media_insert_integrity ON public.catalog_product_media
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND uploaded_by = (SELECT auth.uid())
    AND storage_bucket IN ('product-images', 'catalog-media')
    AND length(storage_path) <= 500
    AND storage_path ~ ('^' || product_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,240}$')
    AND strpos(storage_path, '..') = 0
    AND (
      (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (
        status = 'approved'
        AND reviewed_by = (SELECT auth.uid())
        AND reviewed_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.catalog_products p
          WHERE p.id = catalog_product_media.product_id
            AND public.has_org_permission((SELECT auth.uid()), p.organization_id, 'catalog.media.review', NULL)
        )
      )
    )
  );

CREATE POLICY cat_media_update_integrity ON public.catalog_product_media
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK (
    storage_bucket IN ('product-images', 'catalog-media')
    AND length(storage_path) <= 500
    AND storage_path ~ ('^' || product_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,240}$')
    AND strpos(storage_path, '..') = 0
    AND (
      (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (
        status IN ('approved', 'rejected')
        AND reviewed_by = (SELECT auth.uid())
        AND reviewed_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.catalog_products p
          WHERE p.id = catalog_product_media.product_id
            AND public.has_org_permission((SELECT auth.uid()), p.organization_id, 'catalog.media.review', NULL)
        )
      )
    )
  );

-- RLS predicates cannot compare NEW and OLD without a self-query. A small
-- invoker trigger preserves provenance/object identity without extra privileges.
CREATE FUNCTION public.catalog_media_preserve_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  IF ROW(NEW.id, NEW.product_id, NEW.storage_bucket, NEW.storage_path, NEW.uploaded_by, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id, OLD.product_id, OLD.storage_bucket, OLD.storage_path, OLD.uploaded_by, OLD.created_at)
  THEN
    RAISE EXCEPTION 'Catalog media identity and storage reference are immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.catalog_media_preserve_reference() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_catalog_media_preserve_reference
  BEFORE UPDATE ON public.catalog_product_media
  FOR EACH ROW EXECUTE FUNCTION public.catalog_media_preserve_reference();

COMMIT;
