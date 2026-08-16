
-- Uploads must live under `<product_id>/...`; verify caller can upload for that product's org.
CREATE POLICY "catalog_media_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-media'
    AND EXISTS (
      SELECT 1 FROM public.catalog_products p
      WHERE p.id::text = split_part(name, '/', 1)
        AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.media.upload', NULL)
    )
  );

CREATE POLICY "catalog_media_org_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND EXISTS (
      SELECT 1 FROM public.catalog_products p
      WHERE p.id::text = split_part(name, '/', 1)
        AND public.is_org_member(p.organization_id, auth.uid())
    )
  );

CREATE POLICY "catalog_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND EXISTS (
      SELECT 1 FROM public.catalog_products p
      WHERE p.id::text = split_part(name, '/', 1)
        AND public.has_org_permission(auth.uid(), p.organization_id, 'catalog.write', NULL)
    )
  );
