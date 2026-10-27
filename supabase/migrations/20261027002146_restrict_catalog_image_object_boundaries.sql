-- Restrict existing authenticated Storage permissions for the two catalog image
-- buckets only. Other buckets retain their current policies and permissions.
BEGIN;

CREATE FUNCTION public.catalog_image_object_access(_bucket text, _name text, _operation text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN _bucket NOT IN ('product-images', 'catalog-media') THEN true
    ELSE (SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.catalog_products p
      WHERE p.id::text = split_part(_name, '/', 1)
        AND length(_name) <= 500
        AND _name ~ ('^' || p.id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,240}$')
        AND strpos(_name, '..') = 0
        AND public.is_org_member(p.organization_id, (SELECT auth.uid()))
        AND CASE _operation
          WHEN 'read' THEN true
          WHEN 'delete' THEN public.has_org_permission((SELECT auth.uid()), p.organization_id, 'catalog.write', NULL)
          WHEN 'write' THEN
            public.has_org_permission((SELECT auth.uid()), p.organization_id, 'catalog.media.upload', NULL)
            AND (
              public.has_org_permission((SELECT auth.uid()), p.organization_id, 'catalog.media.review', NULL)
              OR NOT EXISTS (
                SELECT 1 FROM public.catalog_product_media m
                WHERE m.storage_bucket = _bucket AND m.storage_path = _name
                  AND m.status = 'approved'
              )
            )
          ELSE false
        END
    )
  END;
$$;
-- The helper uses caller RLS. Own-organization media rows are visible to every
-- authorized image uploader, including approved references checked above.
REVOKE ALL ON FUNCTION public.catalog_image_object_access(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_image_object_access(text,text,text) TO authenticated;

CREATE POLICY catalog_image_read_integrity ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.catalog_image_object_access(bucket_id, name, 'read'));

CREATE POLICY catalog_image_insert_integrity ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.catalog_image_object_access(bucket_id, name, 'write'));

CREATE POLICY catalog_image_update_integrity ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.catalog_image_object_access(bucket_id, name, 'write'))
  WITH CHECK (public.catalog_image_object_access(bucket_id, name, 'write'));

CREATE POLICY catalog_image_delete_integrity ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.catalog_image_object_access(bucket_id, name, 'delete'));

-- Anonymous callers never obtain raw image-bucket access through a separate
-- permissive Storage policy. Signed URLs remain issued by the trusted signer.
CREATE POLICY catalog_image_anon_isolation ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon
  USING (bucket_id NOT IN ('product-images', 'catalog-media'))
  WITH CHECK (bucket_id NOT IN ('product-images', 'catalog-media'));

COMMIT;
